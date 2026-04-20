#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod export;
mod project;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::save_project,
            commands::load_project,
            commands::export_spritesheet,
        ])
        .run(tauri::generate_context!())
        .expect("error while running 2d-modeler");
}
