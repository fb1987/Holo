import { io } from "./gltf.js";
/** Minimum loadability gate for custom agent-generated assemblies. Recipe
 * geometry has much stronger, independent structural validation. */
export async function checkCustomModel(data: Buffer, filename: string) {
  if (filename.toLowerCase().endsWith(".glb")) {
    const doc = await io().readBinary(data);
    let triangles = 0;
    const scene =
      doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    if (!scene) throw new Error("GLB contains no scene.");
    scene.traverse((node) => {
      for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
        const positions = primitive.getAttribute("POSITION"),
          indices = primitive.getIndices();
        if (
          !positions ||
          positions.getCount() < 3 ||
          !Array.from(positions.getArray() ?? []).every(Number.isFinite)
        )
          throw new Error("GLB contains invalid vertex data.");
        if (primitive.getMode() !== 4)
          throw new Error("Model must use triangle primitives.");
        const count = indices?.getCount() ?? positions.getCount();
        if (count % 3 !== 0) throw new Error("Incomplete GLB triangles.");
        if (
          indices &&
          !Array.from(indices.getArray() ?? []).every(
            (i) => i >= 0 && i < positions.getCount(),
          )
        )
          throw new Error("GLB index is out of range.");
        triangles += count / 3;
      }
    });
    if (!triangles) throw new Error("GLB has no model triangles.");
    return;
  }
  if (data.length >= 84 && 84 + data.readUInt32LE(80) * 50 === data.length) {
    const count = data.readUInt32LE(80);
    if (!count) throw new Error("STL contains no triangles.");
    for (let i = 84; i < data.length; i += 50)
      for (let n = 0; n < 12; n++)
        if (!Number.isFinite(data.readFloatLE(i + n * 4)))
          throw new Error("Invalid STL coordinates.");
    return;
  }
  const text = data.toString("utf8"),
    vertices = [
      ...text.matchAll(
        /\bvertex\s+([-+\deE.]+)\s+([-+\deE.]+)\s+([-+\deE.]+)/g,
      ),
    ];
  if (
    !/^\s*solid\b/.test(text) ||
    vertices.length < 3 ||
    vertices.length % 3 !== 0 ||
    !vertices.every((v) => v.slice(1).every((n) => Number.isFinite(Number(n))))
  )
    throw new Error("STL contains no loadable triangle geometry.");
}
