import { ZodError } from "zod";

import type { Screen as ScreenRow } from "@/generated/prisma/client";
import { asJson, db } from "./db";
import { UserError, describeValidation } from "./errors";
import { inOrg } from "./org-context";
import { parseScreenDocument, type ScreenDocument } from "./schemas";

/** A screen as the browser sees it: the document plus the server's bookkeeping. */
export type ScreenRecord = ScreenDocument & {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type SaveResult =
  | { status: "saved"; screen: ScreenRecord }
  | { status: "conflict"; screen: ScreenRecord }
  | { status: "not-found" };

/** The most screens one church keeps. Generous; it exists so a loop cannot fill the disk. */
export const MAX_SCREENS = 500;

export function toRecord(row: ScreenRow): ScreenRecord {
  return {
    ...(row.document as ScreenDocument),
    name: row.name,
    id: row.id,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listScreens(): Promise<ScreenRecord[]> {
  const rows = await db().screen.findMany({ orderBy: { updatedAt: "desc" }, take: MAX_SCREENS });
  return rows.map(toRecord);
}

export async function getScreen(id: string): Promise<ScreenRecord | null> {
  const row = await db().screen.findUnique({ where: { id } });
  return row ? toRecord(row) : null;
}

export async function createScreen(input: unknown): Promise<ScreenRecord> {
  const document = parseScreenDocument(input);
  if ((await db().screen.count()) >= MAX_SCREENS) {
    throw new UserError(
      `A church can keep up to ${MAX_SCREENS} screens. Delete one to add another.`,
    );
  }
  const row = await db().screen.create({
    data: inOrg({ name: document.name, document: asJson(document) }),
  });
  return toRecord(row);
}

/**
 * Saves a screen if nobody else has saved it since `baseVersion`.
 *
 * Two people editing the same screen is rare and losing one of their changes
 * silently is worse than telling the second one. On a conflict the caller gets
 * the current screen back and decides.
 */
export async function saveScreen(
  id: string,
  input: unknown,
  baseVersion: number,
): Promise<SaveResult> {
  const document = parseScreenDocument(input);
  const { count } = await db().screen.updateMany({
    where: { id, version: baseVersion },
    data: { name: document.name, document: asJson(document), version: { increment: 1 } },
  });

  const row = await db().screen.findUnique({ where: { id } });
  if (!row) return { status: "not-found" };
  return { status: count === 1 ? "saved" : "conflict", screen: toRecord(row) };
}

export async function deleteScreen(id: string): Promise<boolean> {
  const { count } = await db().screen.deleteMany({ where: { id } });
  return count === 1;
}

/**
 * Brings screens over from a browser that kept them in local storage, before
 * there was a server. Each one is validated like any other save; one bad
 * screen is reported, not allowed to sink the rest.
 */
export async function importScreens(
  inputs: unknown[],
): Promise<{ imported: number; failed: { name: string; reason: string }[] }> {
  const existing = await db().screen.count();
  const room = Math.max(0, MAX_SCREENS - existing);
  const failed: { name: string; reason: string }[] = [];
  let imported = 0;

  for (const input of inputs) {
    const name = nameOf(input);
    if (imported >= room) {
      failed.push({ name, reason: `Over the ${MAX_SCREENS}-screen limit` });
      continue;
    }
    try {
      const document = parseScreenDocument(input);
      await db().screen.create({
        data: inOrg({ name: document.name, document: asJson(document) }),
      });
      imported++;
    } catch (error) {
      if (!(error instanceof ZodError)) throw error;
      failed.push({ name, reason: describeValidation(error) });
    }
  }
  return { imported, failed };
}

function nameOf(input: unknown): string {
  const name = (input as { name?: unknown } | null)?.name;
  return typeof name === "string" && name.trim() ? name.slice(0, 120) : "Untitled screen";
}
