import ManifoldModule from "manifold-3d";
import type { DesignSpec } from "../shared/design.js";
import type { Geometry, Fidelity } from "./mesh.js";
import type { V3 } from "./math.js";

// A small, serializable constructive-solid contract shared by mesh and STEP
// adapters. Transforms use degrees internally; the final scene is mm, +Y up.
export type Solid =
  | { op: "box"; size: V3 }
  | { op: "cylinder"; height: number; radius: number }
  | {
      op: "roundedExtrude";
      width: number;
      depth: number;
      height: number;
      radius: number;
      scaleTop: number;
    }
  | { op: "union" | "difference"; children: Solid[] }
  | { op: "transform"; child: Solid; translate: V3; rotate: V3 };
export interface SolidPart {
  id: string;
  material: "body" | "accent";
  solid: Solid;
}
const box = (size: V3): Solid => ({ op: "box", size });
const cylinder = (height: number, radius: number): Solid => ({
  op: "cylinder",
  height,
  radius,
});
const at = (child: Solid, translate: V3, rotate: V3 = [0, 0, 0]): Solid => ({
  op: "transform",
  child,
  translate,
  rotate,
});
const union = (...children: Solid[]): Solid => ({ op: "union", children });
const difference = (...children: Solid[]): Solid => ({
  op: "difference",
  children,
});
const round = (
  w: number,
  d: number,
  h: number,
  r: number,
  scaleTop = 1,
): Solid => ({
  op: "roundedExtrude",
  width: w,
  depth: d,
  height: h,
  radius: Math.max(0.01, Math.min(r, w / 2 - 0.01, d / 2 - 0.01)),
  scaleTop,
});

/** Shared bounded relief: debossed grooves or ribs raised inside a recessed field.
 * Follow tapered walls. Cradles use their continuous rear wall, not open front. */
function grooves(
  solid: Solid,
  p: Record<string, number>,
  w: number,
  h: number,
  d: number,
  taper = 0,
  rear = false,
): Solid {
  if (!p.grooveCount) return solid;
  const pitch = h / (p.grooveCount + 1);
  const bandHeight = p.reliefMode === 1 ? Math.max(0.8, pitch - 0.8) : 0.8;
  const side = rear ? 1 : -1;
  const slope = (d * taper) / (2 * h);
  const angle = (Math.atan(slope) * 180) / Math.PI;
  return difference(
    solid,
    ...Array.from({ length: p.grooveCount }, (_, i) => {
      const z = (i + 1) * pitch;
      const scale = 1 - taper + (taper * z) / h;
      return at(
        box([w * scale * 0.72, p.grooveDepth + 0.2, bandHeight]),
        [0, side * ((d * scale) / 2 - p.grooveDepth / 2 + 0.1), z],
        [-side * angle, 0, 0],
      );
    }),
  );
}
/** Author parts Z-up on the build plate, then rotate the assembly to +Y up. */
export function solidPlan(spec: DesignSpec): SolidPart[] {
  const p = spec.parameters;
  let parts: SolidPart[] = [];
  let height: number;
  if (spec.recipe === "container") {
    height = p.height;
    const b = 1 - p.taper;
    const outer = round(
      p.width * b,
      p.depth * b,
      p.height,
      p.cornerRadius * b,
      1 / b,
    );
    const inner = at(
      round(
        p.width * b - 2 * p.wall,
        p.depth * b - 2 * p.wall,
        p.height,
        p.cornerRadius * b - p.wall,
        1 / b,
      ),
      [0, 0, p.wall],
    );
    let body = difference(outer, inner);
    if (p.rim > 0)
      body = union(
        body,
        at(
          difference(
            round(p.width, p.depth, p.wall, p.cornerRadius),
            round(
              p.width - 2 * (p.wall + p.rim),
              p.depth - 2 * (p.wall + p.rim),
              p.wall + 0.2,
              p.cornerRadius - p.wall - p.rim,
            ),
          ),
          [0, 0, p.height - p.wall],
        ),
      );
    parts = [
      {
        id: "container-body",
        material: "body",
        solid: grooves(body, p, p.width, p.height, p.depth, p.taper),
      },
    ];
  } else if (spec.recipe === "enclosure") {
    height = p.height;
    const bodyHeight = p.height - p.wall;
    let body = difference(
      round(p.width, p.depth, bodyHeight, p.cornerRadius),
      at(
        round(
          p.width - 2 * p.wall,
          p.depth - 2 * p.wall,
          bodyHeight,
          p.cornerRadius - p.wall,
        ),
        [0, 0, p.wall],
      ),
    );
    let lid = round(p.width, p.depth, p.wall, p.cornerRadius);
    // A shallow annular tongue locates the lid without blocking standoffs.
    const tongue = at(
      difference(
        round(
          p.width - 2 * (p.wall + p.clearance),
          p.depth - 2 * (p.wall + p.clearance),
          p.wall + 0.02,
          p.cornerRadius - p.wall - p.clearance,
        ),
        round(
          p.width - 2 * (2 * p.wall + p.clearance),
          p.depth - 2 * (2 * p.wall + p.clearance),
          p.wall + 0.2,
          p.cornerRadius - 2 * p.wall - p.clearance,
        ),
      ),
      [0, 0, -p.wall],
    );
    lid = union(lid, tongue);
    const inset = p.wall + p.bossDiameter / 2 + 1;
    for (const x of [-1, 1])
      for (const y of [-1, 1]) {
        const position: V3 = [
          x * (p.width / 2 - inset),
          y * (p.depth / 2 - inset),
          p.wall,
        ];
        body = union(
          body,
          at(
            difference(
              cylinder(p.standoffHeight, p.bossDiameter / 2),
              at(
                cylinder(p.standoffHeight + 0.2, p.holeDiameter / 2),
                [0, 0, -0.1],
              ),
            ),
            position,
          ),
        );
        lid = difference(
          lid,
          at(cylinder(p.wall * 3 + 0.2, p.holeDiameter / 2), [
            position[0],
            position[1],
            -p.wall - 0.1,
          ]),
        );
      }
    for (let i = 0; i < p.ventCount; i++)
      lid = difference(
        lid,
        at(box([p.width * 0.45, 1.5, p.wall + 0.2]), [
          0,
          (i - (p.ventCount - 1) / 2) * 3,
          p.wall / 2,
        ]),
      );
    parts = [
      {
        id: "enclosure-body",
        material: "body",
        solid: grooves(body, p, p.width, bodyHeight, p.depth),
      },
      {
        id: "enclosure-lid",
        material: "accent",
        solid: at(lid, [0, 0, bodyHeight]),
      },
    ];
  } else if (spec.recipe === "cradle") {
    const w = p.deviceWidth + 2 * p.clearance,
      d = p.deviceDepth + 2 * p.clearance;
    height = p.deviceHeight + p.clearance + p.wall;
    let body = union(
      at(box([w + 2 * p.wall, p.wall, height]), [
        0,
        d / 2 + p.wall / 2,
        height / 2,
      ]),
      at(box([w + 2 * p.wall, d + 2 * p.wall, p.wall]), [0, 0, p.wall / 2]),
    );
    for (const sign of [-1, 1]) {
      body = union(
        body,
        at(box([p.wall, d + p.wall, height * 0.55]), [
          sign * (w / 2 + p.wall / 2),
          -p.wall / 2,
          height * 0.275,
        ]),
        at(box([p.retention, p.wall, height * 0.4]), [
          sign * (w / 2 - p.retention / 2),
          -d / 2 - p.wall / 2,
          height * 0.2,
        ]),
      );
    }
    for (const fraction of [0.35, 0.75])
      body = difference(
        body,
        at(
          cylinder(p.wall + 0.2, p.holeDiameter / 2),
          [0, d / 2 - 0.1, height * fraction],
          [-90, 0, 0],
        ),
      );
    parts = [
      {
        id: "cradle-body",
        material: "body",
        solid: grooves(
          body,
          p,
          w + 2 * p.wall,
          height,
          d + 2 * p.wall,
          0,
          true,
        ),
      },
    ];
  } else throw new Error("This recipe has no solid plan.");
  return parts.map((part) => ({
    ...part,
    solid: at(part.solid, [0, -height / 2, 0], [-90, 0, 0]),
  }));
}

export async function buildSolids(
  spec: DesignSpec,
  fidelity: Fidelity,
): Promise<Geometry> {
  const module = await ManifoldModule();
  module.setup();
  const { Manifold: M, CrossSection: C } = module;
  const segments = fidelity === "coarse" ? 12 : 48;
  function compile(s: Solid): InstanceType<typeof M> {
    switch (s.op) {
      case "box":
        return M.cube(s.size, true);
      case "cylinder":
        return M.cylinder(s.height, s.radius, s.radius, segments);
      case "roundedExtrude": {
        // Circles at four corner centres produce a rounded rectangular profile.
        const circles = [];
        for (const x of [-1, 1])
          for (const y of [-1, 1])
            circles.push(
              C.circle(s.radius, segments).translate([
                x * (s.width / 2 - s.radius),
                y * (s.depth / 2 - s.radius),
              ]),
            );
        return C.hull(circles).extrude(s.height, 0, 0, [
          s.scaleTop,
          s.scaleTop,
        ]);
      }
      case "transform":
        return compile(s.child).rotate(s.rotate).translate(s.translate);
      case "union":
        return M.union(s.children.map(compile));
      case "difference":
        return M.difference(s.children.map(compile));
    }
  }
  const parts = solidPlan(spec).map((part) => {
    // Remove sub-micron boolean slivers before Float32 GLB quantization. The
    // tolerance is explicit in millimetres and below the declared export check.
    const solid = compile(part.solid).simplify(0.001);
    if (solid.status() !== "NoError" || solid.isEmpty())
      throw new Error(
        `${part.id}: solid kernel rejected geometry (${solid.status()}).`,
      );
    const mesh = solid.getMesh();
    const positions: number[] = [];
    for (let i = 0; i < mesh.numVert; i++) positions.push(...mesh.position(i));
    return {
      id: part.id,
      material: part.material,
      positions,
      indices: Array.from(mesh.triVerts),
      closed: true,
    };
  });
  return { parts };
}
