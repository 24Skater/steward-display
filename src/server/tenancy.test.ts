import { describe, expect, it } from "vitest";

import { ModelName } from "@/generated/prisma/internal/prismaNamespace";
import { GLOBAL_MODELS, TENANTED_MODELS, applyOrgScope } from "./tenancy";

describe("model classification", () => {
  it("classifies every model in the schema exactly once", () => {
    const models = Object.values(ModelName).map((name) => name.toLowerCase());
    const unclassified = models.filter((m) => !TENANTED_MODELS.has(m) && !GLOBAL_MODELS.has(m));
    const both = models.filter((m) => TENANTED_MODELS.has(m) && GLOBAL_MODELS.has(m));
    expect(unclassified).toEqual([]);
    expect(both).toEqual([]);
  });

  it("names no model the schema does not have", () => {
    const models = new Set(Object.values(ModelName).map((name) => name.toLowerCase()));
    const stale = [...TENANTED_MODELS, ...GLOBAL_MODELS].filter((m) => !models.has(m));
    expect(stale).toEqual([]);
  });
});

describe("applyOrgScope", () => {
  it("adds the church to a read", () => {
    const args: Record<string, unknown> = { where: { id: "s1" } };
    applyOrgScope("Screen", "findMany", args, "org-a");
    expect(args.where).toEqual({ id: "s1", orgId: "org-a" });
  });

  it("overrides a church named by the caller in a read", () => {
    const args: Record<string, unknown> = { where: { orgId: "org-b" } };
    applyOrgScope("Screen", "findFirst", args, "org-a");
    expect(args.where).toEqual({ orgId: "org-a" });
  });

  it("scopes targeted writes", () => {
    for (const op of ["update", "updateMany", "delete", "deleteMany"]) {
      const args: Record<string, unknown> = { where: { id: "d1" } };
      applyOrgScope("Device", op, args, "org-a");
      expect(args.where).toEqual({ id: "d1", orgId: "org-a" });
    }
  });

  it("stamps created rows, including each row of a createMany", () => {
    const one: Record<string, unknown> = { data: { name: "Lobby" } };
    applyOrgScope("Screen", "create", one, "org-a");
    expect(one.data).toEqual({ name: "Lobby", orgId: "org-a" });

    const many: Record<string, unknown> = { data: [{ name: "a" }, { name: "b" }] };
    applyOrgScope("Screen", "createMany", many, "org-a");
    expect(many.data).toEqual([
      { name: "a", orgId: "org-a" },
      { name: "b", orgId: "org-a" },
    ]);
  });

  it("refuses to write into another church", () => {
    const args: Record<string, unknown> = { data: { name: "x", orgId: "org-b" } };
    expect(() => applyOrgScope("Screen", "create", args, "org-a")).toThrow(/another organization/);
  });

  it("throws when a tenanted model is touched outside a church", () => {
    expect(() => applyOrgScope("Screen", "findMany", {}, null)).toThrow(/no organization/);
  });

  it("leaves global models alone", () => {
    const args: Record<string, unknown> = { where: { email: "a@b.c" } };
    applyOrgScope("User", "findUnique", args, null);
    expect(args.where).toEqual({ email: "a@b.c" });
  });

  it("throws for a model nobody classified", () => {
    expect(() => applyOrgScope("Newthing", "findMany", {}, "org-a")).toThrow(/Classify it/);
  });
});

describe("applyOrgScope on updates", () => {
  it("refuses to move a row to another church", () => {
    expect(() =>
      applyOrgScope("Screen", "updateMany", { where: {}, data: { orgId: "org-b" } }, "org-a"),
    ).toThrow(/move rows/);
    expect(() =>
      applyOrgScope(
        "Screen",
        "upsert",
        { where: {}, create: {}, update: { orgId: "org-b" } },
        "org-a",
      ),
    ).toThrow(/move rows/);
  });
});
