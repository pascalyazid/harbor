use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Duration, Instant};

use librqbit::api::TorrentIdOrHash;
use librqbit::{AddTorrent, AddTorrentOptions, Session};
use serde::Serialize;
use tauri::AppHandle;
use tokio::time::{sleep, timeout};

use super::{current_port, ensure_session};

#[derive(Serialize)]
pub struct SelfTestResult {
    pass: bool,
    steps: Vec<SelfTestStep>,
}

#[derive(Serialize)]
pub struct SelfTestStep {
    label: String,
    ok: bool,
    detail: String,
}

const MAGNET: &str = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel";

fn trackers() -> Vec<String> {
    [
        "udp://tracker.opentrackr.org:1337/announce",
        "udp://tracker.openbittorrent.com:6969/announce",
        "udp://open.tracker.cl:1337/announce",
        "udp://exodus.desync.com:6969/announce",
        "udp://tracker.torrent.eu.org:451/announce",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect()
}

fn step(label: &str, ok: bool, detail: impl Into<String>) -> SelfTestStep {
    SelfTestStep {
        label: label.to_string(),
        ok,
        detail: detail.into(),
    }
}

fn finish(steps: Vec<SelfTestStep>) -> SelfTestResult {
    SelfTestResult {
        pass: steps.iter().all(|s| s.ok),
        steps,
    }
}

pub async fn run(app: AppHandle) -> SelfTestResult {
    let mut steps = Vec::new();
    let session = match ensure_session(&app).await {
        Ok(s) => s,
        Err(e) => {
            steps.push(step("engine up", false, e));
            return finish(steps);
        }
    };
    let Some(port) = current_port() else {
        steps.push(step("engine up", false, "no port bound"));
        return finish(steps);
    };
    let client = reqwest::Client::new();
    match client.get(format!("http://127.0.0.1:{port}/health")).send().await {
        Ok(r) if r.status().is_success() => {
            steps.push(step("engine up", true, format!("port {port}, /health ok")));
        }
        Ok(r) => {
            steps.push(step("engine up", false, format!("/health {}", r.status())));
            return finish(steps);
        }
        Err(e) => {
            steps.push(step("engine up", false, e.to_string()));
            return finish(steps);
        }
    }

    let opts = AddTorrentOptions {
        overwrite: true,
        trackers: Some(trackers()),
        ..Default::default()
    };
    let added = timeout(
        Duration::from_secs(40),
        session.add_torrent(AddTorrent::from_url(MAGNET), Some(opts)),
    )
    .await;
    let handle = match added {
        Ok(Ok(r)) => match r.into_handle() {
            Some(h) => h,
            None => {
                steps.push(step("metadata", false, "list-only response"));
                return finish(steps);
            }
        },
        Ok(Err(e)) => {
            steps.push(step("metadata", false, format!("{e:#}")));
            return finish(steps);
        }
        Err(_) => {
            steps.push(step("metadata", false, "add timed out after 40s"));
            return finish(steps);
        }
    };
    let hash = format!("{:?}", handle.info_hash());
    let meta_started = Instant::now();
    match timeout(Duration::from_secs(60), handle.wait_until_initialized()).await {
        Ok(Ok(())) => {}
        Ok(Err(e)) => {
            steps.push(step("metadata", false, format!("{e:#}")));
            cleanup(&session, &hash).await;
            return finish(steps);
        }
        Err(_) => {
            steps.push(step("metadata", false, "timed out after 60s"));
            cleanup(&session, &hash).await;
            return finish(steps);
        }
    }
    let lengths = handle
        .with_metadata(|m| m.file_infos.iter().map(|fi| fi.len).collect::<Vec<_>>())
        .unwrap_or_default();
    if lengths.is_empty() {
        steps.push(step("metadata", false, "no files in torrent"));
        cleanup(&session, &hash).await;
        return finish(steps);
    }
    steps.push(step(
        "metadata",
        true,
        format!("{} file(s) in {:.1}s", lengths.len(), meta_started.elapsed().as_secs_f64()),
    ));
    let idx = lengths
        .iter()
        .enumerate()
        .max_by_key(|(_, l)| **l)
        .map(|(i, _)| i)
        .unwrap_or(0);

    let peers_started = Instant::now();
    let mut peers = 0usize;
    while peers_started.elapsed() < Duration::from_secs(60) {
        if let Some(live) = handle.stats().live {
            let live_peers = live.snapshot.peer_stats.live;
            if live_peers > 0 {
                peers = live_peers;
                break;
            }
        }
        sleep(Duration::from_millis(500)).await;
    }
    if peers == 0 {
        steps.push(step("peers", false, "no peers within 60s"));
        cleanup(&session, &hash).await;
        return finish(steps);
    }
    steps.push(step("peers", true, format!("{peers} connected")));

    let only: HashSet<usize> = HashSet::from([idx]);
    if let Err(e) = session.update_only_files(&handle, &only).await {
        steps.push(step("first byte", false, format!("select: {e:#}")));
        cleanup(&session, &hash).await;
        return finish(steps);
    }

    let byte_started = Instant::now();
    let url = format!("http://127.0.0.1:{port}/stream/{hash}/{idx}");
    match client
        .get(&url)
        .header(reqwest::header::RANGE, "bytes=0-65535")
        .send()
        .await
    {
        Ok(resp) => {
            let status = resp.status();
            let content_range = resp
                .headers()
                .get(reqwest::header::CONTENT_RANGE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string();
            let read = resp.bytes().await.map(|b| b.len()).unwrap_or(0);
            if status.as_u16() == 206 && read == 65536 {
                steps.push(step(
                    "first byte",
                    true,
                    format!("HTTP 206, {read} B, {:.1}s", byte_started.elapsed().as_secs_f64()),
                ));
                let detail = if content_range.is_empty() {
                    "bytes 0-65535".to_string()
                } else {
                    content_range
                };
                steps.push(step("range", true, detail));
            } else {
                steps.push(step(
                    "first byte",
                    false,
                    format!("status {status}, {read} B (expected 206 / 65536)"),
                ));
            }
        }
        Err(e) => steps.push(step("first byte", false, e.to_string())),
    }

    match TorrentIdOrHash::parse(&hash) {
        Ok(id) => match session.delete(id, true).await {
            Ok(()) => steps.push(step("cleanup", true, "torrent removed")),
            Err(e) => steps.push(step("cleanup", false, format!("{e:#}"))),
        },
        Err(e) => steps.push(step("cleanup", false, e.to_string())),
    }

    finish(steps)
}

async fn cleanup(session: &Arc<Session>, hash: &str) {
    if let Ok(id) = TorrentIdOrHash::parse(hash) {
        let _ = session.delete(id, true).await;
    }
}
