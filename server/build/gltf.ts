import { Document, NodeIO } from "@gltf-transform/core";
import type { DesignSpec } from "../../shared/design.js";
import type { Geometry } from "../../recipes/mesh.js";
import { sub, cross, norm, type V3 } from "../../recipes/math.js";
export const io = () => new NodeIO().setAllowNetwork(false);
const linear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
export async function serializeGLB(
  geometry: Geometry,
  spec: DesignSpec,
  specHash: string,
) {
  const doc = new Document(),
    buffer = doc.createBuffer(),
    scene = doc.createScene("Holo assembly");
  doc.getRoot().setDefaultScene(scene);
  scene.setExtras({
    format: "holo-model",
    specHash,
    recipe: spec.recipe,
    recipeVersion: spec.recipeVersion,
    logicalTopology: geometry.topology ?? null,
    units: "metres",
  });
  const materials = Object.fromEntries(
    Object.entries(spec.materials).map(([name, color]) => [
      name,
      doc
        .createMaterial(name)
        .setBaseColorFactor([
          linear(parseInt(color.slice(1, 3), 16) / 255),
          linear(parseInt(color.slice(3, 5), 16) / 255),
          linear(parseInt(color.slice(5, 7), 16) / 255),
          1,
        ])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.68),
    ]),
  );
  for (const part of geometry.parts) {
    let positions = part.positions,
      normals = part.normals,
      indices = part.indices;
    if (!normals) {
      positions = [];
      normals = [];
      indices = [];
      for (let t = 0; t < part.indices.length; t += 3) {
        const v = part.indices
          .slice(t, t + 3)
          .map((i) => part.positions.slice(i * 3, i * 3 + 3) as V3);
        const normal = norm(cross(sub(v[1], v[0]), sub(v[2], v[0])));
        const i = positions.length / 3;
        positions.push(...v.flat());
        normals.push(...normal, ...normal, ...normal);
        indices.push(i, i + 1, i + 2);
      }
    }
    const primitive = doc
      .createPrimitive()
      .setAttribute(
        "POSITION",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(positions.map((v) => v / 1000)))
          .setBuffer(buffer),
      )
      .setAttribute(
        "NORMAL",
        doc
          .createAccessor()
          .setType("VEC3")
          .setArray(new Float32Array(normals))
          .setBuffer(buffer),
      )
      .setIndices(
        doc
          .createAccessor()
          .setType("SCALAR")
          .setArray(new Uint32Array(indices))
          .setBuffer(buffer),
      )
      .setMaterial(materials[part.material]);
    scene.addChild(
      doc
        .createNode(part.id)
        .setMesh(doc.createMesh(part.id).addPrimitive(primitive))
        .setExtras({ componentId: part.id, closed: part.closed }),
    );
  }
  return io().writeBinary(doc);
}
export function serializeSTL(geometry: Geometry) {
  const triangles = geometry.parts.reduce(
      (sum, part) => sum + part.indices.length / 3,
      0,
    ),
    data = Buffer.alloc(84 + 50 * triangles);
  data.write("Holo mm; visual meshes require fabrication review", 0, "ascii");
  data.writeUInt32LE(triangles, 80);
  let offset = 84;
  for (const part of geometry.parts)
    for (let t = 0; t < part.indices.length; t += 3) {
      const v = part.indices
          .slice(t, t + 3)
          .map((i) => part.positions.slice(i * 3, i * 3 + 3) as V3),
        n = norm(cross(sub(v[1], v[0]), sub(v[2], v[0])));
      for (const value of [...n, ...v.flat()]) {
        data.writeFloatLE(value, offset);
        offset += 4;
      }
      offset += 2;
    }
  return data;
}
