use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub meta: ProjectMeta,
    pub assets: Vec<Asset>,
    pub skeletons: Vec<Skeleton>,
    pub animations: Vec<Animation>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    pub name: String,
    pub version: String,
    pub canvas_width: u32,
    pub canvas_height: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub name: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Skeleton {
    pub id: String,
    pub name: String,
    pub bones: Vec<Bone>,
    pub slots: Vec<Slot>,
    pub skins: Vec<Skin>,
    pub ik_constraints: Vec<IkConstraint>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Bone {
    pub id: String,
    pub name: String,
    pub parent: Option<String>,
    pub x: f32,
    pub y: f32,
    pub rotation: f32,
    pub scale_x: f32,
    pub scale_y: f32,
    pub length: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Slot {
    pub id: String,
    pub name: String,
    pub bone: String,
    pub draw_order: i32,
    pub attachment: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Skin {
    pub id: String,
    pub name: String,
    pub attachments: Vec<Attachment>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Attachment {
    Region {
        id: String,
        slot: String,
        asset_id: String,
        x: f32,
        y: f32,
        rotation: f32,
        scale_x: f32,
        scale_y: f32,
    },
    Mesh {
        id: String,
        slot: String,
        asset_id: String,
        vertices: Vec<f32>,
        uvs: Vec<f32>,
        triangles: Vec<u16>,
        weights: Vec<Vec<BoneWeight>>,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BoneWeight {
    pub bone: String,
    pub weight: f32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct IkConstraint {
    pub id: String,
    pub name: String,
    pub bones: Vec<String>,
    pub target: String,
    pub mix: f32,
    pub bend_positive: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Animation {
    pub id: String,
    pub name: String,
    pub skeleton: String,
    pub duration: f32,
    pub fps: u32,
    pub tracks: Vec<Track>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Track {
    BoneRotate {
        bone: String,
        keyframes: Vec<Keyframe<f32>>,
    },
    BoneTranslate {
        bone: String,
        keyframes: Vec<Keyframe<[f32; 2]>>,
    },
    BoneScale {
        bone: String,
        keyframes: Vec<Keyframe<[f32; 2]>>,
    },
    SlotAttachment {
        slot: String,
        keyframes: Vec<Keyframe<Option<String>>>,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Keyframe<T> {
    pub time: f32,
    pub value: T,
    #[serde(default)]
    pub curve: Curve,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Curve {
    #[default]
    Linear,
    Stepped,
    Bezier {
        cx1: f32,
        cy1: f32,
        cx2: f32,
        cy2: f32,
    },
}
