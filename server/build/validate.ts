import { io } from "./gltf.js";
import type { DesignSpec } from "../../shared/design.js";
import { cross, sub, dot, mean, norm, type V3 } from "../../recipes/math.js";
export interface ValidationReport {
  valid: boolean;
  checks: { name: string; passed: boolean; detail: string }[];
  triangles: number;
  components: number;
  boundsMM: [V3, V3];
  fabrication: "unassessed";
}
/** Read the exported GLB independently. Generator success is not validation. */
export async function validateGLB(
  bytes: Uint8Array,
  spec: DesignSpec,
  specHash?: string,
): Promise<ValidationReport> {
  const checks: ValidationReport["checks"] = [];
  const check = (name: string, passed: boolean, detail: string) =>
    checks.push({ name, passed, detail });
  const doc = await io().readBinary(bytes),
    scene = doc.getRoot().getDefaultScene();
  check("scene", !!scene, "Default assembly scene must be loadable.");
  const nodes = scene?.listChildren() ?? [],
    extras = scene?.getExtras();
  if (specHash)
    check(
      "specification",
      extras?.specHash === specHash,
      "Artifact belongs to this exact specification.",
    );
  const low: V3 = [Infinity, Infinity, Infinity],
    high: V3 = [-Infinity, -Infinity, -Infinity];
  let triangles = 0,
    finite = true,
    validIndices = true,
    nondegenerate = true;
  const components = new Map<
    string,
    {
      positions: number[];
      indices: number[];
      material: string;
      color: number[];
    }
  >();
  for (const node of nodes) {
    const primitive = node.getMesh()?.listPrimitives()[0],
      positions = Array.from(
        primitive?.getAttribute("POSITION")?.getArray() ?? [],
        (v) => Number(v) * 1000,
      ),
      indices = Array.from(primitive?.getIndices()?.getArray() ?? [], Number);
    finite &&= positions.length > 0 && positions.every(Number.isFinite);
    validIndices &&=
      indices.length > 0 &&
      indices.length % 3 === 0 &&
      indices.every(
        (i) => Number.isInteger(i) && i >= 0 && i < positions.length / 3,
      );
    for (let i = 0; i < positions.length; i++) {
      low[i % 3] = Math.min(low[i % 3], positions[i]);
      high[i % 3] = Math.max(high[i % 3], positions[i]);
    }
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = indices
        .slice(i, i + 3)
        .map((v) => positions.slice(v * 3, v * 3 + 3) as V3);
      nondegenerate &&= Math.hypot(...cross(sub(b, a), sub(c, a))) > 1e-9;
    }
    triangles += indices.length / 3;
    components.set(node.getName(), {
      positions,
      indices,
      material: primitive?.getMaterial()?.getName() ?? "",
      color: primitive?.getMaterial()?.getBaseColorFactor() ?? [],
    });
    check(
      `frame:${node.getName()}`,
      node.getTranslation().every((v) => v === 0) &&
        node.getScale().every((v) => v === 1),
      "Geometry is baked into the canonical assembly frame.",
    );
  }
  check(
    "finite-geometry",
    finite && validIndices && nondegenerate,
    "Finite vertices, valid triangles and nonzero surface area.",
  );
  check(
    "component-ids",
    components.size === nodes.length && nodes.length > 0,
    "Stable unique components.",
  );
  check(
    "resource-budget",
    triangles <= 250000 && bytes.byteLength <= 32 * 1024 * 1024,
    "At most 250k triangles and 32 MiB GLB.",
  );
  const expected = spec.interfaces[0].dimensions;
  check(
    "dimensions",
    expected.every(
      (n, i) => Math.abs(high[i] - low[i] - n) <= Math.max(0.15, n * 0.008),
    ),
    `Observed ${high.map((v, i) => (v - low[i]).toFixed(3)).join(" × ")} mm; expected ${expected.join(" × ")} mm.`,
  );
  const linear = (v: number) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  for (const [key, color] of Object.entries(spec.materials)) {
    const found = [...components.values()].filter((c) => c.material === key);
    if (found.length)
      check(
        `material:${key}`,
        found.every((c) =>
          c.color
            .slice(0, 3)
            .every(
              (v, i) =>
                Math.abs(
                  v -
                    linear(
                      parseInt(color.slice(1 + i * 2, 3 + i * 2), 16) / 255,
                    ),
                ) < 1e-5,
            ),
        ),
        "Requested color preserved through GLB reload.",
      );
  }
  if (spec.recipe === "paneled-ball") {
    const topology = extras?.logicalTopology as
      | { vertices: V3[]; faces: { id: string; vertices: number[] }[] }
      | undefined;
    const faces = topology?.faces ?? [],
      vertices = topology?.vertices ?? [];
    check(
      "logical-panels",
      vertices.length === 60 &&
        faces.filter((f) => f.vertices.length === 5).length === 12 &&
        faces.filter((f) => f.vertices.length === 6).length === 20 &&
        components.size === 33,
      "60 shared vertices, 12 pentagons, 20 hexagons and recessed backing.",
    );
    const edges = new Map<string, number[]>();
    faces.forEach((face, index) =>
      face.vertices.forEach((v, i) => {
        const b = face.vertices[(i + 1) % face.vertices.length],
          key = [v, b].sort((a, b) => a - b).join(":");
        edges.set(key, [...(edges.get(key) ?? []), index]);
      }),
    );
    check(
      "adjacency",
      edges.size === 90 &&
        [...edges.values()].every(
          (list) =>
            list.length === 2 &&
            !(
              faces[list[0]].vertices.length === 5 &&
              faces[list[1]].vertices.length === 5
            ),
        ) &&
        vertices.length - edges.size + faces.length === 2,
      "Closed truncated-icosahedron topology; no pentagon touches another pentagon.",
    );
    const radius = spec.parameters.diameter / 2,
      backingRadius = radius - spec.parameters.seamDepth;
    let surfaces = faces.length === 32,
      normalsOut = true,
      alignment = true;
    for (const face of faces) {
      const mesh = components.get(face.id);
      if (!mesh) {
        surfaces = false;
        continue;
      }
      const center = norm(mean(face.vertices.map((i) => vertices[i])));
      const points = Array.from(
        { length: mesh.positions.length / 3 },
        (_, i) => mesh.positions.slice(i * 3, i * 3 + 3) as V3,
      );
      surfaces &&= points.every(
        (v) =>
          Math.abs(Math.hypot(...v) - radius) < 0.001 ||
          Math.abs(Math.hypot(...v) - backingRadius) < 0.001,
      );
      alignment &&=
        dot(norm(mean(points)), center) > 0.995 &&
        mesh.material === (face.vertices.length === 5 ? "accent" : "body");
      let visibleArea = 0;
      for (let t = 0; t < mesh.indices.length; t += 3) {
        const [a, b, c] = mesh.indices.slice(t, t + 3).map((i) => points[i]);
        if (
          [a, b, c].every((v) => Math.abs(Math.hypot(...v) - radius) < 0.001)
        ) {
          const n = cross(sub(b, a), sub(c, a));
          normalsOut &&= dot(n, a) > 0;
          visibleArea += Math.hypot(...n) / 2;
          surfaces &&= Math.hypot(...mean([a, b, c])) > backingRadius + 0.01;
        }
      }
      surfaces &&= visibleArea > radius * radius * 0.1;
    }
    const backing = components.get("seam-backing");
    check(
      "spherical-panels",
      surfaces && alignment,
      "Actual panel surfaces follow the sphere and align with logical polygons; every panel has substantial visible area.",
    );
    check(
      "outward-winding",
      normalsOut,
      "All outer panel triangles face outward.",
    );
    check(
      "recessed-seams",
      !!backing &&
        Array.from({ length: backing.positions.length / 3 }, (_, i) =>
          Math.hypot(...backing.positions.slice(i * 3, i * 3 + 3)),
        ).every((r) => r <= backingRadius + 0.001),
      "Backing lies beneath every visible panel triangle.",
    );
  } else {
    // Weld equal exported positions and count directed edge incidence. This
    // catches holes even when the exporter duplicates vertices for hard normals.
    for (const [id, mesh] of components) {
      const vertexKeys = Array.from(
        { length: mesh.positions.length / 3 },
        (_, i) =>
          mesh.positions
            .slice(i * 3, i * 3 + 3)
            .map((v) => Math.round(v * 10000))
            .join(","),
      );
      const edges = new Map<string, { count: number; balance: number }>();
      let volume = 0;
      for (let t = 0; t < mesh.indices.length; t += 3) {
        const ids = mesh.indices.slice(t, t + 3);
        const [a, b, c] = ids.map(
          (i) => mesh.positions.slice(i * 3, i * 3 + 3) as V3,
        );
        volume += dot(a, cross(b, c)) / 6;
        for (let j = 0; j < 3; j++) {
          const a = vertexKeys[ids[j]],
            b = vertexKeys[ids[(j + 1) % 3]],
            key = [a, b].sort().join("|");
          const value = edges.get(key) ?? { count: 0, balance: 0 };
          value.count++;
          value.balance += a < b ? 1 : -1;
          edges.set(key, value);
        }
      }
      check(
        `closed-solid:${id}`,
        [...edges.values()].every((e) => e.count === 2 && e.balance === 0) &&
          volume > 0,
        "Every welded edge has two opposite incident faces; positive enclosed volume.",
      );
    }
    // Independent occupancy probes inspect the exported triangles, not recipe
    // metadata. They specifically reject plausible-looking filled substitutes.
    const contains = (id: string, point: V3) => {
      const mesh = components.get(id);
      if (!mesh) return false;
      const direction: V3 = norm([1, 0.371, 0.193]),
        hits: number[] = [];
      for (let t = 0; t < mesh.indices.length; t += 3) {
        const [a, b, c] = mesh.indices
            .slice(t, t + 3)
            .map((i) => mesh.positions.slice(i * 3, i * 3 + 3) as V3),
          e1 = sub(b, a),
          e2 = sub(c, a),
          h = cross(direction, e2),
          det = dot(e1, h);
        if (Math.abs(det) < 1e-9) continue;
        const s = sub(point, a),
          u = dot(s, h) / det;
        if (u < 0 || u > 1) continue;
        const q = cross(s, e1),
          v = dot(direction, q) / det;
        if (v < 0 || u + v > 1) continue;
        const distance = dot(e2, q) / det;
        if (distance > 1e-5) hits.push(distance);
      }
      const unique = hits
        .sort((a, b) => a - b)
        .filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > 1e-4);
      return unique.length % 2 === 1;
    };
    const p = spec.parameters;
    if (spec.recipe === "container" || spec.recipe === "enclosure") {
      const id =
        spec.recipe === "container" ? "container-body" : "enclosure-body";
      const height = spec.recipe === "container" ? p.height : p.height - p.wall;
      check(
        "four-wall-envelope",
        [0.2, 0.5, 0.8].every((f) => {
          const scale =
            spec.recipe === "container" ? 1 - p.taper + p.taper * f : 1;
          const y = -p.height / 2 + height * f;
          return [-1, 1].every(
            (sign) =>
              contains(id, [
                sign * ((p.width * scale) / 2 - p.wall / 2),
                y,
                0,
              ]) &&
              contains(id, [0, y, sign * ((p.depth * scale) / 2 - p.wall / 2)]),
          );
        }),
        "All four walls follow the specified envelope at three heights.",
      );
    }
    if (spec.recipe === "container") {
      const id = "container-body";
      check(
        "container-components",
        components.size === 1 && components.has(id),
        "One container body.",
      );
      check(
        "open-cavity",
        [0.15, 0.5, 0.9].every(
          (f) =>
            !contains(id, [
              0,
              -p.height / 2 + p.wall + (p.height - p.wall) * f,
              0,
            ]),
        ),
        "The central cavity is empty from floor to opening.",
      );
      check(
        "floor-and-walls",
        contains(id, [0, -p.height / 2 + p.wall / 2, 0]) &&
          contains(id, [
            (p.width * (1 - p.taper * 0.5)) / 2 - p.wall / 2,
            0,
            0,
          ]),
        "A real bottom and wall surround the cavity.",
      );
      if (p.rim > 0)
        check(
          "rim",
          contains(id, [
            p.width / 2 - p.wall - p.rim / 2,
            p.height / 2 - p.wall / 2,
            0,
          ]),
          "An inward rim exists at the opening.",
        );
    } else if (spec.recipe === "enclosure") {
      check(
        "enclosure-components",
        components.size === 2 &&
          components.has("enclosure-body") &&
          components.has("enclosure-lid"),
        "Separate enclosure body and lid.",
      );
      check(
        "enclosure-cavity",
        !contains("enclosure-body", [0, 0, 0]) &&
          contains("enclosure-body", [0, -p.height / 2 + p.wall / 2, 0]),
        "Body has an empty interior and closed floor.",
      );
      check(
        "seated-lid",
        contains("enclosure-lid", [
          p.width * 0.35,
          p.height / 2 - p.wall / 2,
          0,
        ]),
        "Lid closes the assembled top envelope.",
      );
      let bosses = true,
        holes = true;
      const inset = p.wall + p.bossDiameter / 2 + 1;
      for (const x of [-1, 1])
        for (const z of [-1, 1]) {
          const cx = x * (p.width / 2 - inset),
            cz = z * (p.depth / 2 - inset),
            cy = -p.height / 2 + p.wall + p.standoffHeight / 2;
          bosses &&=
            contains("enclosure-body", [cx + p.bossDiameter * 0.38, cy, cz]) &&
            !contains("enclosure-body", [cx, cy, cz]);
          holes &&= !contains("enclosure-lid", [
            cx,
            p.height / 2 - p.wall / 2,
            cz,
          ]);
        }
      check(
        "drilled-standoffs",
        bosses && holes,
        "Four annular standoffs and corresponding lid holes.",
      );
      if (p.ventCount)
        check(
          "vents",
          Array.from(
            { length: p.ventCount },
            (_, i) => (i - (p.ventCount - 1) / 2) * 3,
          ).every(
            (z) =>
              !contains("enclosure-lid", [0, p.height / 2 - p.wall / 2, z]),
          ),
          "Every requested vent passes through the lid.",
        );
    } else if (spec.recipe === "cradle") {
      const h = spec.interfaces[0].dimensions[1],
        d = p.deviceDepth + 2 * p.clearance,
        id = "cradle-body";
      check(
        "cradle-components",
        components.size === 1 && components.has(id),
        "One integrated cradle body.",
      );
      check(
        "device-clearance",
        [-0.35, 0, 0.35].every((x) =>
          [0.25, 0.6, 0.9].every(
            (y) =>
              !contains(id, [
                p.deviceWidth * x,
                -h / 2 + p.wall + p.deviceHeight * y,
                0,
              ]),
          ),
        ),
        "Device envelope remains free of solid material.",
      );
      check(
        "support-and-retention",
        contains(id, [0, -h / 2 + p.wall / 2, 0]) &&
          contains(id, [
            p.deviceWidth / 2 + p.clearance - p.retention / 2,
            -h / 2 + h * 0.2,
            d / 2 + p.wall / 2,
          ]),
        "Bottom support and front retention lip exist.",
      );
      check(
        "mounting-holes",
        [0.35, 0.75].every(
          (f) => !contains(id, [0, -h / 2 + h * f, -d / 2 - p.wall / 2]),
        ),
        "Both back mounting holes remain open.",
      );
    }
  }
  return {
    valid: checks.every((c) => c.passed),
    checks,
    triangles,
    components: components.size,
    boundsMM: [low, high],
    fabrication: "unassessed",
  };
}
