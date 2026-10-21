import { z } from "zod";

/**
 * What the server accepts. Everything a browser sends is checked here before
 * it is stored, because whatever is stored is later broadcast to a room by a
 * TV that nobody is watching.
 *
 * The widget `config` stays an open record: each widget type owns its keys, and
 * pinning them all here would duplicate the registry. It is bounded instead:
 * by size, by depth (JSON), and by refusing URLs that are not http(s).
 */

const MAX_DOCUMENT_BYTES = 256 * 1024;
const MAX_WIDGETS = 200;

const colour = z.string().max(64);
const shortText = z.string().max(200);

/** http(s) only. `javascript:` and friends never reach a TV. Empty means unset. */
export const mediaUrl = z
  .string()
  .max(2048)
  .refine((value) => value === "" || /^https?:\/\//i.test(value), {
    message: "Must be an http:// or https:// address",
  });

const URL_KEYS = new Set(["src", "url", "href", "image", "imageUrl", "poster"]);

const widgetConfig = z.record(z.unknown()).superRefine((config, ctx) => {
  for (const [key, value] of Object.entries(config)) {
    if (URL_KEYS.has(key) && typeof value === "string" && !mediaUrl.safeParse(value).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: "Must be an http:// or https:// address",
      });
    }
  }
});

const gridUnit = z.number().finite().min(-1000).max(1000);

export const widgetSchema = z.object({
  id: z.string().min(1).max(64),
  widgetType: z.enum([
    "clock",
    "date",
    "announcement",
    "countdown",
    "scripture",
    "weather",
    "image",
    "video",
    "giving-progress",
    "event-list",
    "divider",
    "text",
  ]),
  x: gridUnit,
  y: gridUnit,
  w: z.number().finite().positive().max(1000),
  h: z.number().finite().positive().max(1000),
  config: widgetConfig,
  style: z
    .object({
      backgroundColor: colour.optional(),
      textColor: colour.optional(),
      borderRadius: z.string().max(32).optional(),
      opacity: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

const scheduleSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string().max(16).optional(),
  endTime: z.string().max(16).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  timezone: z.string().max(64),
});

/** The editable part of a screen. Ids, timestamps and the version are the server's. */
export const screenDocumentSchema = z.object({
  name: z.string().trim().min(1, "Give the screen a name").max(120),
  description: z.string().max(1000).optional(),
  orientation: z.enum(["landscape", "portrait"]),
  resolution: z.enum(["1920x1080", "1280x720", "3840x2160", "custom"]),
  customWidth: z.number().int().min(320).max(7680).optional(),
  customHeight: z.number().int().min(320).max(7680).optional(),
  backgroundColor: colour,
  backgroundImage: mediaUrl.optional(),
  showWatermark: z.boolean().optional(),
  widgets: z.array(widgetSchema).max(MAX_WIDGETS),
  schedule: scheduleSchema.optional(),
  gridSize: z.number().finite().positive().max(100).optional(),
  snapStep: z.number().finite().positive().max(100).optional(),
});

export type ScreenDocument = z.infer<typeof screenDocumentSchema>;

/** Parses a screen document and enforces the stored-size ceiling. */
export function parseScreenDocument(input: unknown): ScreenDocument {
  const document = screenDocumentSchema.parse(input);
  if (JSON.stringify(document).length > MAX_DOCUMENT_BYTES) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: [],
        message: "This screen is too large to save. Remove some widgets or shorten their text.",
      },
    ]);
  }
  return document;
}

export const presetInputSchema = z.object({
  widgetType: widgetSchema.shape.widgetType,
  label: shortText.trim().min(1, "Give the preset a name"),
  description: z.string().max(500).optional(),
  config: widgetConfig,
  style: widgetSchema.shape.style,
});

export type PresetInput = z.infer<typeof presetInputSchema>;

/**
 * Church-wide settings: what a TV needs to know that is not part of a screen.
 * Editor preferences (grid, snapping, theme) are per browser and stay there.
 */
export const orgSettingsSchema = z.object({
  timezone: z.string().max(64).refine(isTimeZone, { message: "Pick a time zone from the list" }),
});

export type OrgSettingsData = z.infer<typeof orgSettingsSchema>;

export const DEFAULT_ORG_SETTINGS: OrgSettingsData = { timezone: "America/New_York" };

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .email("Enter an email address like name@church.org");

export const personNameSchema = z.string().trim().min(1, "Enter your name").max(120);

export const churchNameSchema = z.string().trim().min(2, "Enter your church's name").max(120);

/** A short label for a TV, like "Lobby left". */
export const deviceNameSchema = z.string().trim().min(1, "Name the TV").max(60);
