import type { DesignSpec } from "../shared/design.js";
import {
  add,
  sub,
  mul,
  cross,
  dot,
  norm,
  mean,
  ordered,
  type V3,
} from "./math.js";
import type { Geometry, MeshPart, Fidelity } from "./mesh.js";

/** Derive all faces from a single regular icosahedron. No hand-placed patches. */
export function ballTopology() {
  const t = (1 + Math.sqrt(5)) / 2;
  const base: V3[] = [];
  for (const a of [-1, 1])
    for (const b of [-t, t]) base.push([0, a, b], [a, b, 0], [b, 0, a]);
  const adjacent = (i: number, j: number) =>
    Math.abs(Math.hypot(...sub(base[i], base[j])) - 2) < 1e-8;
  const vertices: V3[] = [];
  const directed = new Map<string, number>();
  for (let i = 0; i < 12; i++)
    for (let j = 0; j < 12; j++)
      if (adjacent(i, j)) {
        directed.set(`${i}:${j}`, vertices.length);
        vertices.push(norm(mul(add(mul(base[i], 2), base[j]), 1 / 3)));
      }
  const faces: { id: string; vertices: number[] }[] = [];
  for (let i = 0; i < 12; i++)
    faces.push({
      id: `pentagon-${i + 1}`,
      vertices: ordered(
        vertices,
        base.flatMap((_, j) =>
          adjacent(i, j) ? [directed.get(`${i}:${j}`)!] : [],
        ),
      ),
    });
  let hex = 0;
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++)
        if (adjacent(i, j) && adjacent(j, k) && adjacent(k, i))
          faces.push({
            id: `hexagon-${++hex}`,
            vertices: ordered(vertices, [
              directed.get(`${i}:${j}`)!,
              directed.get(`${j}:${i}`)!,
              directed.get(`${j}:${k}`)!,
              directed.get(`${k}:${j}`)!,
              directed.get(`${k}:${i}`)!,
              directed.get(`${i}:${k}`)!,
            ]),
          });
  return { vertices, faces };
}
export function buildBall(spec: DesignSpec, fidelity: Fidelity): Geometry {
  const topology = ballTopology(),
    radius = spec.parameters.diameter / 2,
    depth = spec.parameters.seamDepth;
  // Keep chord interiors above the recessed backing even for a very shallow
  // seam on a large ball. Fidelity never changes the logical panel topology.
  const minimum = Math.ceil(
    Math.log2(0.5 / (2 * Math.acos(1 - (depth * 0.7) / radius))),
  );
  const subdivisions = Math.max(fidelity === "coarse" ? 2 : 4, minimum);
  const parts: MeshPart[] = [];
  for (const face of topology.faces) {
    const points = face.vertices.map((i) => topology.vertices[i]);
    const center = norm(mean(points));
    const edgeAngle = Math.acos(dot(center, norm(add(points[0], points[1]))));
    const inset = Math.min(
      0.2,
      spec.parameters.seamWidth / 2 / radius / edgeAngle,
    );
    const boundary = points.map((v) =>
      norm(add(mul(v, 1 - inset), mul(center, inset))),
    );
    const part: MeshPart = {
      id: face.id,
      material: face.vertices.length === 5 ? "accent" : "body",
      positions: [],
      indices: [],
      normals: [],
      closed: false,
    };
    const triangle = (a: V3, b: V3, c: V3, n: number) => {
      if (n > 0) {
        const ab = norm(add(a, b)),
          bc = norm(add(b, c)),
          ca = norm(add(c, a));
        triangle(a, ab, ca, n - 1);
        triangle(ab, b, bc, n - 1);
        triangle(ca, bc, c, n - 1);
        triangle(ab, bc, ca, n - 1);
        return;
      }
      if (dot(cross(sub(b, a), sub(c, a)), a) < 0) [b, c] = [c, b];
      const index = part.positions.length / 3;
      part.positions.push(
        ...mul(a, radius),
        ...mul(b, radius),
        ...mul(c, radius),
      );
      part.normals!.push(...a, ...b, ...c);
      part.indices.push(index, index + 1, index + 2);
    };
    for (let i = 0; i < boundary.length; i++)
      triangle(
        center,
        boundary[i],
        boundary[(i + 1) % boundary.length],
        subdivisions,
      );
    // Recessed sidewalls follow exactly the same tessellated boundary. Outer
    // triangles remain spherical; the seam backing cannot cover panel centres.
    const segments = 2 ** subdivisions;
    const splitEdge = (a: V3, b: V3, n: number): V3[] =>
      n
        ? [
            ...splitEdge(a, norm(add(a, b)), n - 1).slice(0, -1),
            ...splitEdge(norm(add(a, b)), b, n - 1),
          ]
        : [a, b];
    for (let i = 0; i < boundary.length; i++)
      for (let j = 0; j < segments; j++) {
        const edge = splitEdge(
            boundary[i],
            boundary[(i + 1) % boundary.length],
            subdivisions,
          ),
          a = edge[j],
          b = edge[j + 1];
        const v = [
          mul(a, radius),
          mul(b, radius),
          mul(b, radius - depth),
          mul(a, radius - depth),
        ];
        const normal = norm(cross(sub(v[1], v[0]), sub(v[2], v[0])));
        const start = part.positions.length / 3;
        part.positions.push(...v.flat());
        part.normals!.push(...normal, ...normal, ...normal, ...normal);
        part.indices.push(
          start,
          start + 1,
          start + 2,
          start,
          start + 2,
          start + 3,
        );
      }
    parts.push(part);
  }
  // Small inner octasphere fills gaps, not the visible panel surface.
  const backing: MeshPart = {
    id: "seam-backing",
    material: "accent",
    positions: [],
    indices: [],
    normals: [],
    closed: true,
  };
  const oct: V3[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const tri = (a: V3, b: V3, c: V3, n: number) => {
    if (n) {
      const ab = norm(add(a, b)),
        bc = norm(add(b, c)),
        ca = norm(add(c, a));
      tri(a, ab, ca, n - 1);
      tri(ab, b, bc, n - 1);
      tri(ca, bc, c, n - 1);
      tri(ab, bc, ca, n - 1);
      return;
    }
    if (dot(cross(sub(b, a), sub(c, a)), a) < 0) [b, c] = [c, b];
    const i = backing.positions.length / 3;
    backing.positions.push(
      ...mul(a, radius - depth),
      ...mul(b, radius - depth),
      ...mul(c, radius - depth),
    );
    backing.normals!.push(...a, ...b, ...c);
    backing.indices.push(i, i + 1, i + 2);
  };
  for (const x of [0, 1])
    for (const y of [2, 3])
      for (const z of [4, 5]) tri(oct[x], oct[y], oct[z], subdivisions + 1);
  parts.push(backing);
  return { parts, topology };
}
