import { SetupHint } from "./SetupHint";

export interface WeatherConfig {
  city?: string;
}

// Live weather (Open-Meteo, proxied through the server) arrives with the server phase.
// Until then this widget never shows a temperature - a made-up one would be shown to the
// congregation as fact.
export function WeatherWidget({ config }: { config: WeatherConfig }) {
  return (
    <SetupHint>
      {config.city
        ? `Live weather for ${config.city} arrives in the next release. Hidden on the TV until then.`
        : "Live weather arrives in the next release. Hidden on the TV until then."}
    </SetupHint>
  );
}
