import { z } from "zod";

export const stations = [
  "planning",
  "design",
  "electronics",
  "software",
] as const;
export const stationSchema = z.enum(stations);
export const buildModeSchema = z.enum(["diy", "mixed", "finished"]);
const text = z.string().max(16000);
const label = z.string().min(1).max(240);
const coordinate = z.number().finite().min(-100000).max(100000);
const vec = z.tuple([coordinate, coordinate, coordinate]);
const positive = z.number().finite().positive().max(100000);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const sceneSchema = z
  .object({
    kind: z.enum(["plasma", "wheel", "enclosure", "custom"]),
    color,
    width: positive,
    height: positive,
    depth: positive,
    parts: z
      .array(
        z
          .object({
            id: label,
            name: label,
            shape: z.enum(["box", "cylinder", "sphere", "torus"]),
            position: vec,
            rotation: vec,
            size: z.tuple([positive, positive, positive]),
            color,
            domain: z.enum(["mechanical", "electronics"]),
            description: text,
          })
          .strict(),
      )
      .max(150),
  })
  .strict();
export const partSchema = z
  .object({
    id: label,
    name: label,
    quantity: z.number().int().min(1).max(10000),
    category: label,
    description: text,
    manufacturerPart: label.nullable(),
    estimatedCost: z.number().nonnegative().max(10000000).nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    sourceUrl: z
      .string()
      .url()
      .refine((v) => /^https?:\/\//.test(v))
      .nullable(),
    verified: z.boolean(),
  })
  .strict();
export const outputSchema = z
  .object({
    response: text.min(1),
    summary: label,
    name: z.string().trim().min(1).max(120).nullable(),
    description: text.nullable(),
    affected: z.array(stationSchema).max(4),
    goals: z.array(label).max(30).nullable(),
    constraints: z.array(label).max(30).nullable(),
    scene: sceneSchema.nullable(),
    parts: z.array(partSchema).max(200).nullable(),
    decisions: z
      .array(z.object({ text: label, reason: text }).strict())
      .max(20),
    recommendations: z
      .array(
        z
          .object({
            proposal: text,
            reason: text,
            affected: z.array(stationSchema).max(4),
          })
          .strict(),
      )
      .max(12),
    artifacts: z
      .array(
        z
          .object({
            path: z.string().min(1).max(512),
            name: label,
            role: z
              .enum([
                "assembly",
                "part",
                "source",
                "render",
                "document",
                "other",
              ])
              .nullable()
              .default(null),
          })
          .strict(),
      )
      .max(80),
  })
  .strict();
export type AgentOutput = z.infer<typeof outputSchema>;
// All fields are required; nullable fields represent no change. This works with
// strict structured-output models and is validated again before any mutation.
export function codexCompatibleSchema(value: unknown): any {
  if (Array.isArray(value)) return value.map(codexCompatibleSchema);
  if (value && typeof value === "object") {
    const node = Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        codexCompatibleSchema(child),
      ]),
    );
    // Codex structured outputs require homogeneous array items. Holo's Vec3
    // tuples are three instances of the same numeric schema, so this preserves
    // the exact constraints while avoiding draft-2020 prefixItems.
    if (Array.isArray(node.prefixItems)) {
      node.items = node.prefixItems[0];
      delete node.prefixItems;
    }
    // URL validity is still enforced by Zod before committing the result.
    if (node.format === "uri") delete node.format;
    // Runtime defaults accept older saved/test outputs; models receive only the
    // required nullable field, without a default annotation in their schema.
    delete node.default;
    delete node.$schema;
    return node;
  }
  return value;
}
export const agentOutputJsonSchema = codexCompatibleSchema(
  z.toJSONSchema(outputSchema),
);
export function schemaForStation(station: (typeof stations)[number]) {
  const schema = structuredClone(agentOutputJsonSchema);
  if (station !== "planning") {
    for (const field of ["name", "description", "goals", "constraints"])
      schema.properties[field] = { type: "null" };
  }
  if (station !== "design") schema.properties.scene = { type: "null" };
  if (station !== "electronics") schema.properties.parts = { type: "null" };
  return schema;
}

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(12000).optional(),
    buildMode: buildModeSchema.optional(),
    template: z.enum(["blank", "wheel", "enclosure"]).optional(),
  })
  .strict();
export const patchProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    buildMode: buildModeSchema.optional(),
    constraints: z.array(z.string().min(1).max(500)).max(30).optional(),
  })
  .strict();
export const messageSchema = z
  .object({
    text: z.string().trim().min(1).max(16000),
    station: stationSchema.default("planning"),
    model: z.string().min(1).max(120).optional(),
    effort: z.string().min(1).max(30).optional(),
  })
  .strict();
