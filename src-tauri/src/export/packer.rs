//! Shelf-style rectangle packer.
//!
//! Sort rectangles by descending height, then lay them left-to-right on
//! shelves of the current row. When the next rectangle would overflow the
//! max width, start a new shelf below. Not optimal (maxrects would be
//! tighter) but predictable, stable under small changes, and fast.

#[derive(Debug, Clone)]
pub struct Placement {
    pub id: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

pub struct PackResult {
    pub placements: Vec<Placement>,
    pub width: u32,
    pub height: u32,
}

/// `rects` is (id, width, height). `max_width` caps the atlas width; height
/// grows as needed. If `power_of_two` is set, the final dimensions round up
/// to the next power of two (capped at `max_width` for width).
pub fn shelf_pack(
    mut rects: Vec<(String, u32, u32)>,
    max_width: u32,
    power_of_two: bool,
) -> PackResult {
    rects.sort_by(|a, b| b.2.cmp(&a.2).then(b.1.cmp(&a.1)));

    let mut placements = Vec::with_capacity(rects.len());
    let mut cursor_x: u32 = 0;
    let mut cursor_y: u32 = 0;
    let mut shelf_height: u32 = 0;
    let mut used_width: u32 = 0;

    for (id, w, h) in rects {
        // An item wider than the cap gets clamped to max_width so the atlas
        // stays rectangular; the caller should warn when this happens.
        let clamped_w = w.min(max_width.max(1));

        if cursor_x + clamped_w > max_width {
            cursor_y += shelf_height;
            cursor_x = 0;
            shelf_height = 0;
        }

        placements.push(Placement {
            id,
            x: cursor_x,
            y: cursor_y,
            width: clamped_w,
            height: h,
        });
        cursor_x += clamped_w;
        if cursor_x > used_width {
            used_width = cursor_x;
        }
        if h > shelf_height {
            shelf_height = h;
        }
    }

    let mut width = used_width.max(1);
    let mut height = (cursor_y + shelf_height).max(1);

    if power_of_two {
        width = next_pow2(width).min(max_width.max(1));
        height = next_pow2(height);
    }

    PackResult { placements, width, height }
}

fn next_pow2(n: u32) -> u32 {
    if n <= 1 {
        return 1;
    }
    let mut v = n - 1;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    v + 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn packs_simple() {
        let rects = vec![
            ("a".into(), 10, 10),
            ("b".into(), 20, 5),
            ("c".into(), 15, 12),
        ];
        let r = shelf_pack(rects, 64, false);
        assert_eq!(r.placements.len(), 3);
        // Tallest first.
        assert_eq!(r.placements[0].id, "c");
    }

    #[test]
    fn pot_rounds_up() {
        let rects = vec![("a".into(), 30, 20)];
        let r = shelf_pack(rects, 64, true);
        assert_eq!(r.width, 32);
        assert_eq!(r.height, 32);
    }
}
