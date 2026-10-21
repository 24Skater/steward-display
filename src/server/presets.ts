import { asJson, db } from "./db";
import { UserError } from "./errors";
import { inOrg } from "./org-context";
import { presetInputSchema, type PresetInput } from "./schemas";

export type PresetRecord = PresetInput & { id: string; createdAt: string };

const MAX_PRESETS = 500;

function toRecord(row: { id: string; data: unknown; createdAt: Date }): PresetRecord {
  return { ...(row.data as PresetInput), id: row.id, createdAt: row.createdAt.toISOString() };
}

export async function listPresets(): Promise<PresetRecord[]> {
  const rows = await db().preset.findMany({ orderBy: { createdAt: "asc" }, take: MAX_PRESETS });
  return rows.map(toRecord);
}

export async function createPreset(input: unknown): Promise<PresetRecord> {
  const data = presetInputSchema.parse(input);
  if ((await db().preset.count()) >= MAX_PRESETS) {
    throw new UserError(`A church can keep up to ${MAX_PRESETS} presets.`);
  }
  const row = await db().preset.create({
    data: inOrg({ widgetType: data.widgetType, name: data.label, data: asJson(data) }),
  });
  return toRecord(row);
}

export async function updatePreset(id: string, input: unknown): Promise<PresetRecord> {
  const row = await db().preset.findUnique({ where: { id } });
  if (!row) throw new UserError("That preset was deleted.", 404);
  const data = presetInputSchema.parse({ ...(row.data as object), ...(input as object) });
  const updated = await db().preset.update({
    where: { id },
    data: { name: data.label, widgetType: data.widgetType, data: asJson(data) },
  });
  return toRecord(updated);
}

export async function deletePreset(id: string): Promise<void> {
  await db().preset.deleteMany({ where: { id } });
}
