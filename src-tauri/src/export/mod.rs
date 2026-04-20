//! Sprite sheet + JSON atlas export.
//!
//! For now this is a stub: it writes the project JSON next to the chosen output
//! directory and creates a placeholder atlas.png. M9 will replace this with the
//! real rasterize + pack + write pipeline using the `image` and `rectangle-pack`
//! crates.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::project::Project;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub scales: Vec<f32>,
    pub padding: u32,
    pub power_of_two: bool,
    pub max_size: u32,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub atlas_path: String,
    pub json_path: String,
}

#[derive(thiserror::Error, Debug)]
pub enum ExportError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serde error: {0}")]
    Serde(#[from] serde_json::Error),
}

pub fn export(
    project: Project,
    output_dir: PathBuf,
    _options: ExportOptions,
) -> Result<ExportResult, ExportError> {
    fs::create_dir_all(&output_dir)?;
    let atlas_path = output_dir.join("atlas.png");
    let json_path = output_dir.join("atlas.json");

    // Placeholder PNG (1x1 transparent) until M9 implements real packing.
    let pixel: [u8; 4] = [0, 0, 0, 0];
    image::save_buffer(
        &atlas_path,
        &pixel,
        1,
        1,
        image::ExtendedColorType::Rgba8,
    )
    .map_err(|e| ExportError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

    fs::write(&json_path, serde_json::to_string_pretty(&project)?)?;

    Ok(ExportResult {
        atlas_path: atlas_path.to_string_lossy().into_owned(),
        json_path: json_path.to_string_lossy().into_owned(),
    })
}
