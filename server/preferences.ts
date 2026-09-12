import type { Express } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { atomicWrite } from "./store.js";

const preferencesSchema = z
  .object({
    lastProjectId: z.string().uuid().nullable().optional(),
    drafts: z
      .record(z.string().regex(/^(new|[a-f0-9-]{36})$/), z.string().max(16000))
      .optional(),
    model: z.string().max(120).optional(),
    effort: z.string().max(30).optional(),
    reducedMotion: z.boolean().optional(),
    compactMode: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Buffer.byteLength(JSON.stringify(value)) <= 96000,
    "Studio preferences exceed 96 KB. Shorten old drafts before saving.",
  );

/** Durable UI state is independent of the native workshop's ephemeral port. */
export async function mountPreferences(app: Express, dataDir: string) {
  const file = path.join(dataDir, "preferences.json");
  let preferences: z.infer<typeof preferencesSchema> = {};
  try {
    preferences = preferencesSchema.parse(
      JSON.parse(await fs.readFile(file, "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      console.error(
        "Holo could not read studio preferences; retaining the file for recovery.",
      );
  }
  let writes = Promise.resolve();
  app.get("/api/preferences", (_req, res) => res.json(preferences));
  app.post("/api/preferences", async (req, res) => {
    const input = preferencesSchema.parse(req.body);
    writes = writes
      .catch(() => {})
      .then(async () => {
        const next = preferencesSchema.parse({ ...preferences, ...input });
        await atomicWrite(file, JSON.stringify(next, null, 2));
        preferences = next;
      });
    await writes;
    res.json({ ok: true });
  });
}
