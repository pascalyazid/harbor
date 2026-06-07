import { invoke } from "@tauri-apps/api/core";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type EngineStatus = {
  ready: boolean;
  port: number | null;
  active_torrents: number;
  last_error: string | null;
};

export type EngineFile = {
  idx: number;
  name: string;
  length: number;
};

export type AddResult = {
  info_hash: string;
  files: EngineFile[];
  stream_base: string;
};

export type TorrentEngineStats = {
  peers: number;
  unchoked: number;
  downloaded: number;
  downloadSpeed: number;
  streamProgress: number;
  streamLen: number;
  peerSearchRunning: boolean;
  finished: boolean;
  state: string;
};

export type SelfTestStep = {
  label: string;
  ok: boolean;
  detail: string;
};

export type SelfTestResult = {
  pass: boolean;
  steps: SelfTestStep[];
};

export async function torrentEngineStatus(): Promise<EngineStatus | null> {
  if (!isTauri) return null;
  try {
    return await invoke<EngineStatus>("torrent_engine_status");
  } catch {
    return null;
  }
}

export async function torrentEngineAdd(
  magnet: string,
  trackers: string[],
): Promise<AddResult | null> {
  if (!isTauri) return null;
  try {
    return await invoke<AddResult>("torrent_engine_add", { magnet, trackers });
  } catch (e) {
    console.warn("[engine] add failed", e);
    return null;
  }
}

export async function torrentEngineSelect(infoHash: string, fileIdx: number): Promise<void> {
  if (!isTauri) return;
  await invoke("torrent_engine_select", { infoHash, fileIdx }).catch((e) =>
    console.warn("[engine] select failed", e),
  );
}

export async function torrentEngineStats(
  infoHash: string,
  fileIdx: number | null,
): Promise<TorrentEngineStats | null> {
  if (!isTauri) return null;
  try {
    return await invoke<TorrentEngineStats>("torrent_engine_stats", { infoHash, fileIdx });
  } catch {
    return null;
  }
}

export async function torrentEngineRemove(infoHash: string, deleteFiles: boolean): Promise<void> {
  if (!isTauri) return;
  await invoke("torrent_engine_remove", { infoHash, deleteFiles }).catch((e) =>
    console.warn("[engine] remove failed", e),
  );
}

export async function torrentEngineSelfTest(): Promise<SelfTestResult | null> {
  if (!isTauri) return null;
  try {
    return await invoke<SelfTestResult>("torrent_engine_selftest");
  } catch (e) {
    console.warn("[engine] selftest failed", e);
    return null;
  }
}

export async function torrentEngineRestart(): Promise<EngineStatus | null> {
  if (!isTauri) return null;
  try {
    return await invoke<EngineStatus>("torrent_engine_restart");
  } catch (e) {
    console.warn("[engine] restart failed", e);
    return null;
  }
}

export function isLocalEngineEnabled(): boolean {
  try {
    const raw = localStorage.getItem("harbor.settings");
    if (!raw) return true;
    return (JSON.parse(raw) as { localEngine?: boolean }).localEngine !== false;
  } catch {
    return true;
  }
}
