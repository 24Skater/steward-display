import { beforeEach, expect, it } from "vitest";

import { asOrg, describeDb, makeOrg, resetDatabase } from "@/test/db";
import { claimPairing } from "./pairing";
import { createScreen } from "./screens";
import { handlePairStart, handlePairStatus, handleTvScreen } from "./tv-http";

const post = (body?: unknown) =>
  new Request("http://tv.local/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const screenRequest = (token: string | null, etag?: string) =>
  new Request("http://tv.local/api/tv/screen", {
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(etag ? { "if-none-match": etag } : {}),
    },
  });

describeDb("the TV's HTTP contract", () => {
  beforeEach(resetDatabase);

  it("pairs over HTTP, then answers 200, then 304 for an unchanged screen", async () => {
    const org = await makeOrg();
    const screen = await asOrg(org, () =>
      createScreen({
        name: "Lobby",
        orientation: "landscape",
        resolution: "1920x1080",
        backgroundColor: "#000000",
        widgets: [],
      }),
    );

    const started = await asOrg(org, () => handlePairStart(post()));
    expect(started.status).toBe(201);
    expect(started.headers.get("cache-control")).toBe("no-store");
    const { code, pollSecret } = (await started.json()) as { code: string; pollSecret: string };

    const pending = await asOrg(org, () => handlePairStatus(post({ pollSecret })));
    expect(await pending.json()).toMatchObject({ status: "pending" });

    await asOrg(org, () => claimPairing({ code, name: "Lobby TV", screenId: screen.id }));
    const paired = (await (
      await asOrg(org, () => handlePairStatus(post({ pollSecret })))
    ).json()) as {
      status: string;
      deviceToken: string;
    };
    expect(paired.status).toBe("paired");

    const first = await asOrg(org, () => handleTvScreen(screenRequest(paired.deviceToken)));
    expect(first.status).toBe(200);
    const etag = first.headers.get("etag")!;
    expect((await first.json()).screen.name).toBe("Lobby");

    const again = await asOrg(org, () => handleTvScreen(screenRequest(paired.deviceToken, etag)));
    expect(again.status).toBe(304);
  });

  it("answers 401 to no token, a made-up token, and another church's token", async () => {
    const grace = await makeOrg("Grace");
    const hope = await makeOrg("Hope");
    expect((await asOrg(grace, () => handleTvScreen(screenRequest(null)))).status).toBe(401);
    expect((await asOrg(grace, () => handleTvScreen(screenRequest("sdt_madeup")))).status).toBe(
      401,
    );

    const started = (await (await asOrg(grace, () => handlePairStart(post()))).json()) as {
      code: string;
      pollSecret: string;
    };
    await asOrg(grace, () => claimPairing({ code: started.code, name: "TV", screenId: null }));
    const { deviceToken } = (await (
      await asOrg(grace, () => handlePairStatus(post({ pollSecret: started.pollSecret })))
    ).json()) as { deviceToken: string };

    expect((await asOrg(grace, () => handleTvScreen(screenRequest(deviceToken)))).status).toBe(200);
    expect((await asOrg(hope, () => handleTvScreen(screenRequest(deviceToken)))).status).toBe(401);
  });

  it("rejects a status poll with no secret", async () => {
    const org = await makeOrg();
    const response = await asOrg(org, () => handlePairStatus(post({})));
    expect(response.status).toBe(400);
  });
});
