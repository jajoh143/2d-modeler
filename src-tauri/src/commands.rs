use std::fs;
use std::path::PathBuf;

use crate::export::{ExportOptions, ExportResult};
use crate::project::Project;

#[tauri::command]
pub fn save_project(path: String, project: Project) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&project).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_project(path: String) -> Result<Project, String> {
    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_spritesheet(
    project: Project,
    output_dir: String,
    options: ExportOptions,
) -> Result<ExportResult, String> {
    crate::export::export(project, PathBuf::from(output_dir), options).map_err(|e| e.to_string())
}
