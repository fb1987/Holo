import { z } from "zod";

export const recipeIds = [
  "paneled-ball",
  "container",
  "enclosure",
  "cradle",
] as const;
export type RecipeId = (typeof recipeIds)[number];
export const recipeVersion = "1.0.0";
export const engineVersion = "holo-mesh-1/manifold-3.5.3/gltf-4.5.0";
type Parameter = {
  default: number;
  min: number;
  max: number;
  integer?: boolean;
  description: string;
};
const param = (
  value: number,
  min: number,
  max: number,
  description: string,
  integer = false,
): Parameter => ({ default: value, min, max, description, integer });
const detail = {
  reliefMode: param(
    0,
    0,
    1,
    "0: debossed grooves; 1: embossed ribs within a recessed field, preserving the outer envelope. Repeated horizontal bars only; no text or logos.",
    true,
  ),
  grooveCount: param(
    0,
    0,
    24,
    "Repeated surface bands on the front wall (rear wall for cradle); zero disables.",
    true,
  ),
  grooveDepth: param(
    0.4,
    0.1,
    1,
    "Groove depth in mm; must be less than half the wall.",
  ),
};
export const registry: Record<
  RecipeId,
  { name: string; description: string; parameters: Record<string, Parameter> }
> = {
  "paneled-ball": {
    name: "Paneled ball",
    description:
      "Classic truncated-icosahedron soccer ball: 12 pentagons, 20 hexagons, spherical panels and recessed seams. A visual surface model, not an inflatable-ball manufacturing design. No valve.",
    parameters: {
      diameter: param(220, 20, 1000, "Outer diameter in mm."),
      seamWidth: param(1.2, 0.1, 5, "Visible seam width in mm."),
      seamDepth: param(0.8, 0.1, 3, "Seam recess in mm."),
    },
  },
  container: {
    name: "Hollow container",
    description:
      "Open rounded rectangular bin, cup or tray with a real cavity, bottom, wall, taper and rim. Dimensions describe the outer top envelope.",
    parameters: {
      width: param(240, 20, 1000, "Outer top width in mm."),
      height: param(300, 10, 1000, "Total height in mm."),
      depth: param(180, 20, 1000, "Outer top depth in mm."),
      wall: param(3, 0.8, 20, "Wall and floor thickness in mm."),
      cornerRadius: param(16, 1, 100, "Outer top corner radius in mm."),
      taper: param(0.08, 0, 0.35, "Fractional narrowing at the bottom."),
      rim: param(2, 0, 10, "Additional inward rim thickness in mm."),
      ...detail,
    },
  },
  enclosure: {
    name: "Electronics enclosure",
    description:
      "Rounded box and separate seated lid with clearance, four drilled standoffs, matching lid holes and repeated lid vents. Mechanical proposal; fit and fasteners need engineering review.",
    parameters: {
      width: param(120, 35, 500, "Outer width in mm."),
      height: param(45, 15, 300, "Assembled total height in mm."),
      depth: param(80, 35, 500, "Outer depth in mm."),
      wall: param(2.5, 1, 10, "Wall and lid thickness in mm."),
      cornerRadius: param(6, 1, 30, "Outer corner radius in mm."),
      clearance: param(0.3, 0.1, 1.5, "Lid tongue clearance per side in mm."),
      bossDiameter: param(8, 5, 18, "Standoff outer diameter in mm."),
      holeDiameter: param(2.8, 1, 8, "Pilot/through hole diameter in mm."),
      standoffHeight: param(
        8,
        2,
        30,
        "Standoff height from internal floor in mm.",
      ),
      ventCount: param(5, 0, 12, "Number of lid vent slots.", true),
      ...detail,
    },
  },
  cradle: {
    name: "Device cradle",
    description:
      "Single-piece open-top phone/device cradle with back, bottom shelf, side retention rails and two wall-mount holes. Device envelope and clearance control the fit.",
    parameters: {
      deviceWidth: param(76, 30, 250, "Device width in mm."),
      deviceHeight: param(155, 50, 350, "Device height in mm."),
      deviceDepth: param(10, 3, 50, "Device thickness in mm."),
      clearance: param(1, 0.2, 4, "Clearance per side in mm."),
      wall: param(3, 1, 10, "Back, shelf and rail thickness in mm."),
      retention: param(3, 1, 10, "Front lip overlap in mm."),
      holeDiameter: param(4.5, 2, 10, "Two mounting holes in mm."),
      ...detail,
    },
  },
};

// A compact strict-output contract. Names are checked against the selected
// registry entry; unknown parameters never silently disappear.
export const designRequestSchema = z
  .object({
    recipe: z.enum(recipeIds),
    version: z.literal(recipeVersion),
    parameters: z
      .array(
        z
          .object({
            name: z.string().min(1).max(40),
            value: z.number().finite(),
          })
          .strict(),
      )
      .max(24),
    bodyColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    outputs: z
      .array(z.enum(["glb", "stl", "step", "renders"]))
      .min(1)
      .max(4),
  })
  .strict();
export type DesignRequest = z.infer<typeof designRequestSchema>;
export interface DesignSpec {
  format: "holo-design";
  version: 1;
  units: "mm";
  axes: "+Y up, +Z front";
  recipe: RecipeId;
  recipeVersion: typeof recipeVersion;
  parameters: Record<string, number>;
  materials: { body: string; accent: string };
  outputs: DesignRequest["outputs"];
  interfaces: {
    id: string;
    kind: "envelope" | "device-clearance";
    dimensions: [number, number, number];
  }[];
}
export function normalizeDesign(input: unknown): DesignSpec {
  const request = designRequestSchema.parse(input),
    definition = registry[request.recipe];
  const parameters = Object.fromEntries(
    Object.entries(definition.parameters).map(([key, rule]) => [
      key,
      rule.default,
    ]),
  );
  const names = new Set<string>();
  for (const { name, value } of request.parameters) {
    const rule = definition.parameters[name];
    if (!rule || names.has(name))
      throw new Error(`Unknown or duplicate parameter: ${name}`);
    if (
      value < rule.min ||
      value > rule.max ||
      (rule.integer && !Number.isInteger(value))
    )
      throw new Error(
        `${name} must be ${rule.min}–${rule.max}${rule.integer ? " (integer)" : ""}.`,
      );
    names.add(name);
    parameters[name] = value;
  }
  const p = parameters;
  if (request.recipe === "paneled-ball") {
    if (p.seamWidth > p.diameter * 0.025 || p.seamDepth > p.diameter * 0.02)
      throw new Error("Seams are too large for this ball diameter.");
    if (request.outputs.includes("step"))
      throw new Error(
        "Paneled surfaces do not support solid STEP export. Select GLB/STL instead.",
      );
  } else {
    if (p.grooveDepth >= p.wall / 2 && p.grooveCount)
      throw new Error("Grooves must be shallower than half the wall.");
    if (request.recipe !== "cradle") {
      if (
        p.cornerRadius >= Math.min(p.width, p.depth) / 2 ||
        p.wall * 4 >= Math.min(p.width, p.height, p.depth)
      )
        throw new Error(
          "Wall or corner radius leaves insufficient interior space.",
        );
      if (
        request.recipe === "container" &&
        (p.rim + p.wall) * 4 >= Math.min(p.width, p.depth) * (1 - p.taper)
      )
        throw new Error("Rim or taper closes the container cavity.");
      if (
        request.recipe === "enclosure" &&
        (p.holeDiameter + 2 >= p.bossDiameter ||
          p.standoffHeight + p.wall * 3 >= p.height ||
          p.bossDiameter * 3 + p.wall * 2 >= Math.min(p.width, p.depth))
      )
        throw new Error("Standoffs or holes do not fit this enclosure.");
    } else if (p.retention * 3 >= p.deviceWidth)
      throw new Error("Retention lips cover too much of the device opening.");
  }
  const dimensions: [number, number, number] =
    request.recipe === "paneled-ball"
      ? [p.diameter, p.diameter, p.diameter]
      : request.recipe === "cradle"
        ? [
            p.deviceWidth + 2 * p.clearance + 2 * p.wall,
            p.deviceHeight + p.clearance + p.wall,
            p.deviceDepth + 2 * p.clearance + 2 * p.wall,
          ]
        : [p.width, p.height, p.depth];
  return {
    format: "holo-design",
    version: 1,
    units: "mm",
    axes: "+Y up, +Z front",
    recipe: request.recipe,
    recipeVersion,
    parameters,
    materials: {
      body: request.bodyColor.toLowerCase(),
      accent: request.accentColor.toLowerCase(),
    },
    outputs: [...new Set(request.outputs)].sort(),
    interfaces: [
      { id: "outer-envelope", kind: "envelope", dimensions },
      ...(request.recipe === "cradle"
        ? [
            {
              id: "device",
              kind: "device-clearance" as const,
              dimensions: [p.deviceWidth, p.deviceHeight, p.deviceDepth] as [
                number,
                number,
                number,
              ],
            },
          ]
        : []),
    ],
  };
}
export function requestFromSpec(spec: DesignSpec): DesignRequest {
  return {
    recipe: spec.recipe,
    version: spec.recipeVersion,
    parameters: Object.entries(spec.parameters).map(([name, value]) => ({
      name,
      value,
    })),
    bodyColor: spec.materials.body,
    accentColor: spec.materials.accent,
    outputs: spec.outputs,
  };
}
export function recipeInstructions() {
  return `Holo has trusted deterministic recipes. For a supported design, planning MUST return designRequest and include design in affected. The app executes it without another model or Blender code. For recipe requests, return the typed plan directly without tool calls or duplicate handoff/recipe files: Holo persists the intent, source specification, recipe lock and rebuild package automatically. Return artifacts empty for that case. Return the full desired parameter set on edits (current designSpec supplied); do not reset unspecified user choices. Defaults may fill initial unspecified dimensions and should be disclosed. Use null for discussion only or unsupported/custom geometry; never approximate an unsupported object by forcing a recipe. Supported recipes: ${JSON.stringify(registry)}. designRequest version is ${recipeVersion}; colors are hex RGB (classic ball body white, accent black). outputs should include glb for a model request; stl for mesh fabrication, step for dimensional solids, renders only if requested. No valve or arbitrary detail support beyond these parameters. Never claim physical validation. Design geometry is generated from this request, not scene primitives. Routine execution needs no LLM tool call.`;
}
