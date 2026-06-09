use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, State, WebviewUrl, WebviewWindowBuilder};
use tokio::sync::Mutex;

const PIP_LABEL: &str = "harbor-pip";

#[derive(Debug, Clone)]
struct WindowSnapshot {
    width: f64,
    height: f64,
    x: f64,
    y: f64,
    always_on_top: bool,
    maximized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipSubtitle {
    pub url: String,
    pub lang: Option<String>,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipSession {
    pub url: String,
    pub start_at_sec: f64,
    pub playing: bool,
    pub volume: f64,
    pub muted: bool,
    pub title: Option<String>,
    pub subtitle: Option<String>,
    pub subtitles: Vec<PipSubtitle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PipExitState {
    pub position_sec: f64,
    pub playing: bool,
}

pub struct PipState {
    session: Arc<Mutex<Option<PipSession>>>,
    snapshot: Arc<Mutex<Option<WindowSnapshot>>>,
}

impl PipState {
    pub fn new() -> Self {
        Self {
            session: Arc::new(Mutex::new(None)),
            snapshot: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
pub async fn pip_open(
    app: AppHandle,
    state: State<'_, PipState>,
    session: PipSession,
) -> Result<(), String> {
    {
        let mut g = state.session.lock().await;
        *g = Some(session);
    }

    if let Some(existing) = app.get_webview_window(PIP_LABEL) {
        let _ = existing.set_focus();
        let _ = app.emit_to(PIP_LABEL, "pip://session-replaced", ());
        return Ok(());
    }

    let app_for_main = app.clone();
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
    app.run_on_main_thread(move || {
        eprintln!("[pip] >>> building window on main thread");
        let url = WebviewUrl::App("index.html".into());
        let result = WebviewWindowBuilder::new(&app_for_main, PIP_LABEL, url)
            .title("Harbor PiP")
            .inner_size(560.0, 360.0)
            .position(200.0, 200.0)
            .resizable(true)
            .always_on_top(true)
            .decorations(true)
            .skip_taskbar(false)
            .visible(true)
            .focused(true)
            .build();
        match result {
            Ok(window) => {
                eprintln!("[pip] window built on main thread, label={}", window.label());
                let _ = window.show();
                let _ = window.set_focus();
                #[cfg(debug_assertions)]
                {
                    window.open_devtools();
                    eprintln!("[pip] devtools opened (debug build)");
                }
                window.on_window_event(|event| {
                    eprintln!("[pip] window event: {:?}", event);
                });
                eprintln!("[pip] show + focus dispatched");
                let _ = tx.send(Ok(()));
            }
            Err(e) => {
                eprintln!("[pip] BUILD FAILED on main thread: {}", e);
                let _ = tx.send(Err(format!("build: {}", e)));
            }
        }
    })
    .map_err(|e| format!("run_on_main_thread: {}", e))?;

    match rx.recv() {
        Ok(Ok(())) => {
            eprintln!("[pip] open complete");
            Ok(())
        }
        Ok(Err(e)) => Err(e),
        Err(e) => {
            eprintln!("[pip] channel recv error: {}", e);
            Err(format!("channel: {}", e))
        }
    }
}

#[tauri::command]
pub async fn pip_get_session(state: State<'_, PipState>) -> Result<Option<PipSession>, String> {
    let g = state.session.lock().await;
    Ok(g.clone())
}

#[tauri::command]
pub async fn pip_close(
    app: AppHandle,
    state: State<'_, PipState>,
    exit: Option<PipExitState>,
) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(PIP_LABEL) {
        let _ = w.close();
    }
    {
        let mut g = state.session.lock().await;
        *g = None;
    }
    if let Some(e) = exit {
        let _ = app.emit_to("main", "pip://closed", e);
    } else {
        let _ = app.emit_to(
            "main",
            "pip://closed",
            PipExitState {
                position_sec: 0.0,
                playing: false,
            },
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn pip_publish_state(app: AppHandle, exit: PipExitState) -> Result<(), String> {
    let _ = app.emit_to("main", "pip://state", exit);
    Ok(())
}

#[tauri::command]
pub async fn window_pip_enter(
    app: AppHandle,
    state: State<'_, PipState>,
) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;

    let scale = main.scale_factor().unwrap_or(1.0);
    let size = main
        .outer_size()
        .map_err(|e| format!("outer_size: {}", e))?
        .to_logical::<f64>(scale);
    let pos = main
        .outer_position()
        .map_err(|e| format!("outer_position: {}", e))?
        .to_logical::<f64>(scale);
    let on_top = main.is_always_on_top().unwrap_or(false);
    let maximized = main.is_maximized().unwrap_or(false);

    {
        let mut g = state.snapshot.lock().await;
        *g = Some(WindowSnapshot {
            width: size.width,
            height: size.height,
            x: pos.x,
            y: pos.y,
            always_on_top: on_top,
            maximized,
        });
    }

    if maximized {
        let _ = main.unmaximize();
    }

    let pip_w = 480.0_f64;
    let pip_h = 320.0_f64;
    let monitor = main.current_monitor().ok().flatten();
    let (mon_x, mon_y, mon_w, mon_h) = if let Some(m) = monitor {
        let mp = m.position().to_logical::<f64>(scale);
        let ms = m.size().to_logical::<f64>(scale);
        (mp.x, mp.y, ms.width, ms.height)
    } else {
        (0.0, 0.0, 1920.0, 1080.0)
    };
    let target_x = mon_x + mon_w - pip_w - 24.0;
    let target_y = mon_y + mon_h - pip_h - 56.0;

    main.set_min_size(Some(LogicalSize::new(360.0, 240.0)))
        .map_err(|e| format!("set_min_size: {}", e))?;
    main.set_always_on_top(true)
        .map_err(|e| format!("set_always_on_top: {}", e))?;
    main.set_size(LogicalSize::new(pip_w, pip_h))
        .map_err(|e| format!("set_size: {}", e))?;
    main.set_position(LogicalPosition::new(target_x, target_y))
        .map_err(|e| format!("set_position: {}", e))?;
    let _ = main.set_focus();

    #[cfg(target_os = "macos")]
    {
        if let Ok(ns) = main.ns_window() {
            let ptr = ns as i64;
            let _ = app.run_on_main_thread(move || crate::pip_mac::enter_pip_window(ptr));
        }
    }

    let _ = app.emit_to("main", "pip://entered", ());

    Ok(())
}

#[tauri::command]
pub async fn window_pip_exit(
    app: AppHandle,
    state: State<'_, PipState>,
) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "main window missing".to_string())?;

    let saved = {
        let mut g = state.snapshot.lock().await;
        g.take()
    };

    if let Some(s) = saved {
        let _ = main.set_always_on_top(s.always_on_top);
        if s.maximized {
            let _ = main.set_min_size(Some(LogicalSize::new(960.0, 600.0)));
            let _ = main.maximize();
        } else {
            let _ = main.set_size(LogicalSize::new(s.width.max(960.0), s.height.max(600.0)));
            let _ = main.set_position(LogicalPosition::new(s.x, s.y));
            let _ = main.set_min_size(Some(LogicalSize::new(960.0, 600.0)));
        }
    } else {
        let _ = main.set_always_on_top(false);
        let _ = main.set_size(LogicalSize::new(1280.0, 800.0));
        let _ = main.set_min_size(Some(LogicalSize::new(960.0, 600.0)));
        let _ = main.center();
    }
    let _ = main.set_focus();

    #[cfg(target_os = "macos")]
    {
        if let Ok(ns) = main.ns_window() {
            let ptr = ns as i64;
            let _ = app.run_on_main_thread(move || crate::pip_mac::exit_pip_window(ptr));
        }
    }

    let _ = app.emit_to("main", "pip://exited", ());
    Ok(())
}
