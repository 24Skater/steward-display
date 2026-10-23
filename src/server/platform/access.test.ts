import { afterEach, describe, expect, it, vi } from "vitest";

import type { EntitlementState } from "./entitlement-state";
import { accessRefusal, renderSubscriptionPage } from "./access";
import { resetPlatformClient } from "./entitlements";

const ORG = { orgId: "org-1", name: "Grace <Church>" };
const ENV = {
  PLATFORM_CONSOLE_URL: "https://console.steward.test/some/path",
  PLATFORM_SERVICE_TOKEN: "stw_svc_display_x",
};

function platformSaying(state: EntitlementState | undefined) {
  resetPlatformClient({ getState: vi.fn().mockResolvedValue(state) } as never);
}

const request = (path: string) => new Request(`https://grace-stewarddisplay.app.test${path}`);

afterEach(() => resetPlatformClient(undefined));

describe("accessRefusal", () => {
  it.each(["ACTIVE", "GRACE", "READ_ONLY"] as const)("lets a %s church in", async (state) => {
    platformSaying(state);
    expect(await accessRefusal(request("/"), ORG, ENV)).toBeNull();
  });

  it("lets everyone in with no console configured", async () => {
    resetPlatformClient(null);
    expect(await accessRefusal(request("/"), ORG, {})).toBeNull();
  });

  it.each([
    ["REVOKED", "REVOKED" as const],
    ["never subscribed", undefined],
  ])("shows a %s church a page, not the app", async (_label, state) => {
    platformSaying(state);
    const response = await accessRefusal(request("/screens"), ORG, ENV);
    expect(response?.status).toBe(403);
    expect(response?.headers.get("content-type")).toContain("text/html");
  });

  it("answers a revoked church's TV with 403, never the 401 that unpairs it", async () => {
    platformSaying("REVOKED");
    const response = await accessRefusal(request("/api/tv/screen"), ORG, ENV);
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: "subscription_inactive" });
  });

  it("answers server functions with JSON", async () => {
    platformSaying("REVOKED");
    const response = await accessRefusal(request("/_serverFn/abc"), ORG, ENV);
    expect(response?.headers.get("content-type")).toContain("application/json");
  });
});

describe("renderSubscriptionPage", () => {
  it("escapes the church name", () => {
    const html = renderSubscriptionPage("Grace <Church>", ENV);
    expect(html).toContain("Grace &lt;Church&gt;");
    expect(html).not.toContain("<Church>");
  });

  it("links to the console's origin only", () => {
    expect(renderSubscriptionPage("Grace", ENV)).toContain('href="https://console.steward.test"');
  });

  it("links nowhere when the console URL is not http(s)", () => {
    const html = renderSubscriptionPage("Grace", { PLATFORM_CONSOLE_URL: "javascript:alert(1)" });
    expect(html).not.toContain("href=");
  });
});
