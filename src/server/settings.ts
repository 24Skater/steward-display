import { asJson, bypass, db } from "./db";
import { inOrg, requireOrg } from "./org-context";
import { clearOrgCache } from "./org-resolver";
import {
  DEFAULT_ORG_SETTINGS,
  churchNameSchema,
  orgSettingsSchema,
  type OrgSettingsData,
} from "./schemas";

export interface OrgSettingsView extends OrgSettingsData {
  churchName: string;
}

/** The church's settings, with defaults for anything never saved or saved by an older version. */
export async function getOrgSettings(): Promise<OrgSettingsData> {
  const row = await db().orgSettings.findFirst();
  const parsed = orgSettingsSchema.partial().safeParse(row?.data ?? {});
  return { ...DEFAULT_ORG_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}

export async function getOrgSettingsView(): Promise<OrgSettingsView> {
  return { ...(await getOrgSettings()), churchName: requireOrg().name };
}

export async function updateOrgSettings(patch: unknown): Promise<OrgSettingsView> {
  const input = orgSettingsSchema
    .partial()
    .extend({ churchName: churchNameSchema.optional() })
    .parse(patch);
  const { churchName, ...settingsPatch } = input;

  const next = orgSettingsSchema.parse({ ...(await getOrgSettings()), ...settingsPatch });
  const existing = await db().orgSettings.findFirst({ select: { id: true } });
  if (existing) {
    await db().orgSettings.update({ where: { id: existing.id }, data: { data: asJson(next) } });
  } else {
    await db().orgSettings.create({ data: inOrg({ data: asJson(next) }) });
  }

  if (churchName !== undefined && churchName !== requireOrg().name) {
    // The org row is the tenant root, addressed by its own id.
    await db().org.update(
      bypass({ where: { id: requireOrg().orgId }, data: { name: churchName } }),
    );
    clearOrgCache();
  }
  return { ...next, churchName: churchName ?? requireOrg().name };
}
