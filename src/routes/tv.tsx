import { createFileRoute } from "@tanstack/react-router";

import { DisplayStage, IdleSlate, useDisplayChrome } from "@/components/display/DisplayStage";
import { useTvPlayer, useTvServiceWorker, useWakeLock } from "@/lib/tv/useTvPlayer";

/**
 * What a TV opens. No sign-in: it pairs with a code, then shows whatever screen
 * the church assigns it, and keeps showing it through network outages.
 */
export const Route = createFileRoute("/tv")({
  head: () => ({ meta: [{ title: "Steward Display" }] }),
  component: TvPage,
});

function TvPage() {
  const state = useTvPlayer();
  useDisplayChrome();
  useWakeLock();
  useTvServiceWorker();

  if (state.mode === "booting") return <IdleSlate />;

  if (state.mode === "pairing") {
    return (
      <IdleSlate>
        {state.code ? (
          <PairingCode code={state.code} />
        ) : (
          <p className="text-2xl text-white/70">
            {state.error ? "Can't reach the server. Trying again…" : "Getting a pairing code…"}
          </p>
        )}
      </IdleSlate>
    );
  }

  const { payload, offline } = state;
  const dot = offline ? (
    <span
      className="absolute left-4 top-4 h-3 w-3 rounded-full bg-amber/70"
      title="Offline: showing the last screen that loaded"
    />
  ) : null;

  if (!payload.screen) {
    return (
      <IdleSlate
        message={`"${payload.deviceName}" is paired. Pick what it shows from the TVs page.`}
      >
        {dot}
      </IdleSlate>
    );
  }
  return (
    <DisplayStage
      screen={payload.screen}
      timeZone={payload.timezone}
      weather={payload.weather ?? {}}
      overlay={dot}
    />
  );
}

function PairingCode({ code }: { code: string }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <p className="text-2xl text-white/80">To show your church's screens here, enter this code</p>
      <p
        className="rounded-2xl bg-white/10 px-10 py-6 font-mono text-7xl font-semibold tracking-[0.25em] text-gold sm:text-8xl"
        aria-label={`Pairing code ${code.split("").join(" ")}`}
      >
        {code}
      </p>
      <p className="max-w-xl text-xl text-white/70">
        on the <span className="font-semibold text-white">TVs</span> page of{" "}
        <span className="font-semibold text-white">{window.location.host}</span>, from any phone or
        computer. The code changes every ten minutes.
      </p>
    </div>
  );
}
