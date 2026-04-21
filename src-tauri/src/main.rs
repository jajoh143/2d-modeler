#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod export;
mod project;

use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let log_path = app
                .path()
                .app_data_dir()
                .ok()
                .map(|d| d.join("crash.log"));
            install_panic_hook(log_path);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_project,
            commands::load_project,
            commands::export_spritesheet,
        ])
        .run(tauri::generate_context!())
        .expect("error while running 2d-modeler");
}

/// Append a minimal crash record to `crash.log` in the app data dir. Set once,
/// so if anything in the editor panics (bone math, export, etc.) the user
/// has a file to send back rather than a blank window.
fn install_panic_hook(log_path: Option<PathBuf>) {
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if let Some(path) = &log_path {
            let _ = write_crash_entry(path, info);
        }
        prev(info);
    }));
}

fn write_crash_entry(path: &PathBuf, info: &std::panic::PanicHookInfo<'_>) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let location = info
        .location()
        .map(|l| format!("{}:{}", l.file(), l.line()))
        .unwrap_or_else(|| "<unknown>".into());
    let payload = info
        .payload()
        .downcast_ref::<&str>()
        .map(|s| s.to_string())
        .or_else(|| info.payload().downcast_ref::<String>().cloned())
        .unwrap_or_else(|| "<unknown payload>".into());
    let mut f = fs::OpenOptions::new().create(true).append(true).open(path)?;
    writeln!(f, "[{ts}] panic at {location}: {payload}")
}


