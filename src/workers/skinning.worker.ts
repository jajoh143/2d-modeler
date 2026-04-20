/// <reference lib="webworker" />
/**
 * Mesh skinning worker. Takes bone world transforms + a mesh's rest-pose
 * vertices/weights and returns deformed vertices. Keeps the main thread free
 * during heavy weighted deform.
 *
 * Wired up in M5.
 */

interface SkinRequest {
  vertices: Float32Array; // flat x,y pairs, rest pose
  weights: Float32Array;  // 4 bones per vertex: [idx, w, idx, w, idx, w, idx, w]
  boneMatrices: Float32Array; // 6 floats per bone: a,b,c,d,tx,ty
}

self.onmessage = (e: MessageEvent<SkinRequest>) => {
  const { vertices, weights, boneMatrices } = e.data;
  const out = new Float32Array(vertices.length);
  const vCount = vertices.length / 2;

  for (let i = 0; i < vCount; i++) {
    const rx = vertices[i * 2];
    const ry = vertices[i * 2 + 1];
    let x = 0;
    let y = 0;
    for (let j = 0; j < 4; j++) {
      const bi = weights[i * 8 + j * 2];
      const w = weights[i * 8 + j * 2 + 1];
      if (w === 0) continue;
      const m = bi * 6;
      const a = boneMatrices[m];
      const b = boneMatrices[m + 1];
      const c = boneMatrices[m + 2];
      const d = boneMatrices[m + 3];
      const tx = boneMatrices[m + 4];
      const ty = boneMatrices[m + 5];
      x += (rx * a + ry * c + tx) * w;
      y += (rx * b + ry * d + ty) * w;
    }
    out[i * 2] = x;
    out[i * 2 + 1] = y;
  }

  (self as unknown as Worker).postMessage(out, [out.buffer]);
};
