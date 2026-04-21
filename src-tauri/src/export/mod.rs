//! Sprite sheet + JSON atlas export.
//!
//! Pipeline:
//!   1. Decode each asset's PNG (data URL or file path) into an RGBA image.
//!   2. Trim transparent borders, remembering the offset so consumers can
//!      reconstruct the original footprint.
//!   3. For each requested output scale, resize trimmed images and shelf-pack
//!      them into an atlas bitmap. Write `atlas@<scale>x.png`.
//!   4. Write `atlas.json` with skeletons, animations, and atlas entries.
//!      Entry positions are reported in 1x atlas pixels; other scales follow
//!      the same layout for straight consumer math.

mod packer;

use std::fs;
use std::path::PathBuf;

use base64::Engine as _;
use image::{imageops, DynamicImage, ImageBuffer, Rgba, RgbaImage};
use serde::{Deserialize, Serialize};

use crate::project::{Animation, Project, Skeleton};

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
    pub atlas_width: u32,
    pub atlas_height: u32,
    pub entries: u32,
    pub warnings: Vec<String>,
}

#[derive(thiserror::Error, Debug)]
pub enum ExportError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serde error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("image error: {0}")]
    Image(#[from] image::ImageError),
    #[error("base64 decode error: {0}")]
    Base64(#[from] base64::DecodeError),
    #[error("{0}")]
    Other(String),
}

pub fn export(
    project: Project,
    output_dir: PathBuf,
    options: ExportOptions,
) -> Result<ExportResult, ExportError> {
    fs::create_dir_all(&output_dir)?;
    let mut warnings: Vec<String> = Vec::new();

    let scales = if options.scales.is_empty() {
        vec![1.0_f32]
    } else {
        options.scales.clone()
    };
    let max_size = if options.max_size == 0 { 4096 } else { options.max_size };

    // 1. Decode + trim all assets.
    let mut trimmed: Vec<TrimmedAsset> = Vec::with_capacity(project.assets.len());
    for asset in &project.assets {
        match decode_asset(&asset.path) {
            Ok(img) => {
                let (cropped, tx, ty) = trim_alpha(&img);
                trimmed.push(TrimmedAsset {
                    id: asset.id.clone(),
                    name: asset.name.clone(),
                    original_width: asset.width,
                    original_height: asset.height,
                    trim_x: tx,
                    trim_y: ty,
                    image: cropped,
                });
            }
            Err(e) => {
                warnings.push(format!(
                    "Skipped asset '{}': {}",
                    asset.name, e
                ));
            }
        }
    }

    if trimmed.is_empty() {
        warnings.push("No assets to pack; writing metadata-only atlas.".into());
    }

    // 2. For each scale, resize + pack + compose + write.
    let mut atlas_entries: Vec<AtlasEntry> = Vec::new();
    let mut primary_atlas_path = PathBuf::new();
    let mut primary_width = 0u32;
    let mut primary_height = 0u32;

    for (idx, &scale) in scales.iter().enumerate() {
        if !scale.is_finite() || scale <= 0.0 {
            warnings.push(format!("Ignoring invalid scale {scale}"));
            continue;
        }
        let is_primary = idx == 0;

        // Resize each trimmed asset at this scale. Lanczos3 for downscales,
        // triangle for upscales (fewer ringing artifacts on pixel art).
        let scaled: Vec<(String, RgbaImage)> = trimmed
            .iter()
            .map(|t| {
                let w = ((t.image.width() as f32) * scale).round().max(1.0) as u32;
                let h = ((t.image.height() as f32) * scale).round().max(1.0) as u32;
                let filter = if scale < 1.0 {
                    imageops::FilterType::Lanczos3
                } else {
                    imageops::FilterType::Triangle
                };
                let img = t.image.resize_exact(w, h, filter).to_rgba8();
                (t.id.clone(), img)
            })
            .collect();

        // Input to the packer: apply padding to each rect so neighbours don't
        // bleed during linear filtering.
        let pad = options.padding;
        let rects: Vec<(String, u32, u32)> = scaled
            .iter()
            .map(|(id, img)| (id.clone(), img.width() + pad * 2, img.height() + pad * 2))
            .collect();

        let pack = packer::shelf_pack(rects, max_size, options.power_of_two);

        if pack.width > max_size || pack.height > max_size {
            warnings.push(format!(
                "Atlas @{scale}x exceeds max_size ({}x{} vs {})",
                pack.width, pack.height, max_size
            ));
        }

        // Compose.
        let mut atlas: RgbaImage = ImageBuffer::from_pixel(
            pack.width,
            pack.height,
            Rgba([0, 0, 0, 0]),
        );
        for placement in &pack.placements {
            let Some((_, img)) = scaled.iter().find(|(id, _)| id == &placement.id) else {
                continue;
            };
            let px = placement.x + pad;
            let py = placement.y + pad;
            imageops::overlay(&mut atlas, img, px as i64, py as i64);

            if is_primary {
                let trimmed = trimmed.iter().find(|t| t.id == placement.id);
                if let Some(t) = trimmed {
                    atlas_entries.push(AtlasEntry {
                        asset_id: t.id.clone(),
                        asset_name: t.name.clone(),
                        x: px,
                        y: py,
                        width: img.width(),
                        height: img.height(),
                        trim: TrimInfo {
                            left: t.trim_x,
                            top: t.trim_y,
                            original_width: t.original_width,
                            original_height: t.original_height,
                        },
                    });
                }
            }
        }

        let file_name = scale_filename(scale);
        let atlas_path = output_dir.join(&file_name);
        atlas.save(&atlas_path)?;

        if is_primary {
            primary_atlas_path = atlas_path;
            primary_width = pack.width;
            primary_height = pack.height;
        }
    }

    // 3. JSON atlas.
    let json_doc = AtlasJson {
        meta: AtlasMeta {
            exporter: format!("2d-modeler {}", env!("CARGO_PKG_VERSION")),
            format_version: 1,
            project_name: project.meta.name.clone(),
            scales,
            atlas_size: [primary_width, primary_height],
            padding: options.padding,
        },
        skeletons: project.skeletons.clone(),
        animations: project.animations.clone(),
        atlas: atlas_entries.clone(),
    };
    let json_path = output_dir.join("atlas.json");
    fs::write(&json_path, serde_json::to_string_pretty(&json_doc)?)?;

    Ok(ExportResult {
        atlas_path: primary_atlas_path.to_string_lossy().into_owned(),
        json_path: json_path.to_string_lossy().into_owned(),
        atlas_width: primary_width,
        atlas_height: primary_height,
        entries: atlas_entries.len() as u32,
        warnings,
    })
}

// ──────────────────────────────────────────────────────────────────

struct TrimmedAsset {
    id: String,
    name: String,
    original_width: u32,
    original_height: u32,
    trim_x: u32,
    trim_y: u32,
    image: DynamicImage,
}

fn decode_asset(path: &str) -> Result<DynamicImage, ExportError> {
    if let Some(bytes) = data_url_bytes(path)? {
        Ok(image::load_from_memory(&bytes)?)
    } else {
        let bytes = fs::read(path)?;
        Ok(image::load_from_memory(&bytes)?)
    }
}

/// Decode the data-URL payload. Returns None when `path` isn't a data URL.
fn data_url_bytes(path: &str) -> Result<Option<Vec<u8>>, ExportError> {
    if !path.starts_with("data:") {
        return Ok(None);
    }
    let comma = path
        .find(',')
        .ok_or_else(|| ExportError::Other("malformed data URL: missing comma".into()))?;
    let header = &path[..comma];
    let body = &path[comma + 1..];
    if header.contains(";base64") {
        Ok(Some(base64::engine::general_purpose::STANDARD.decode(body)?))
    } else {
        // URL-encoded data URL; unusual but cheap to handle.
        let decoded: Vec<u8> = body
            .bytes()
            .scan(None::<u8>, |state, b| {
                if let Some(hi) = state.take() {
                    let lo = hex_digit(b as char).unwrap_or(0);
                    Some(Some((hi << 4) | lo))
                } else if b == b'%' {
                    *state = Some(0);
                    Some(None)
                } else {
                    Some(Some(b))
                }
            })
            .flatten()
            .collect();
        Ok(Some(decoded))
    }
}

fn hex_digit(c: char) -> Option<u8> {
    c.to_digit(16).map(|n| n as u8)
}

fn trim_alpha(img: &DynamicImage) -> (DynamicImage, u32, u32) {
    let rgba = img.to_rgba8();
    let w = rgba.width();
    let h = rgba.height();
    let mut min_x = w;
    let mut min_y = h;
    let mut max_x: i64 = -1;
    let mut max_y: i64 = -1;
    for y in 0..h {
        for x in 0..w {
            if rgba.get_pixel(x, y)[3] > 0 {
                if x < min_x {
                    min_x = x;
                }
                if y < min_y {
                    min_y = y;
                }
                if (x as i64) > max_x {
                    max_x = x as i64;
                }
                if (y as i64) > max_y {
                    max_y = y as i64;
                }
            }
        }
    }
    if max_x < 0 || max_y < 0 {
        // Fully transparent — keep the original to preserve authored size.
        return (img.clone(), 0, 0);
    }
    let tw = (max_x as u32) - min_x + 1;
    let th = (max_y as u32) - min_y + 1;
    (img.crop_imm(min_x, min_y, tw, th), min_x, min_y)
}

fn scale_filename(scale: f32) -> String {
    if (scale - 1.0).abs() < 1e-4 {
        "atlas.png".to_string()
    } else {
        let s = if scale.fract() == 0.0 {
            format!("{}", scale as u32)
        } else {
            format!("{scale}")
        };
        format!("atlas@{s}x.png")
    }
}

// ──────────────────────────────────────────────────────────────────
// JSON output types
// ──────────────────────────────────────────────────────────────────

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct AtlasJson {
    meta: AtlasMeta,
    skeletons: Vec<Skeleton>,
    animations: Vec<Animation>,
    atlas: Vec<AtlasEntry>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct AtlasMeta {
    exporter: String,
    format_version: u32,
    project_name: String,
    scales: Vec<f32>,
    atlas_size: [u32; 2],
    padding: u32,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct AtlasEntry {
    asset_id: String,
    asset_name: String,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    trim: TrimInfo,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct TrimInfo {
    left: u32,
    top: u32,
    original_width: u32,
    original_height: u32,
}
