import { SetupHint } from "./SetupHint";

export interface ScriptureConfig {
  reference?: string;
  text?: string;
  version?: string;
}

export function ScriptureWidget({ config }: { config: ScriptureConfig }) {
  if (!config.text) return <SetupHint>Add a verse to display.</SetupHint>;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="italic leading-snug" style={{ fontSize: "clamp(1rem, 4cqw, 2.25rem)" }}>
        {config.text}
      </p>
      {config.reference && (
        <p
          className="font-semibold opacity-80"
          style={{ fontSize: "clamp(0.875rem, 2.5cqw, 1.25rem)" }}
        >
          {config.reference}
          {config.version ? ` · ${config.version}` : ""}
        </p>
      )}
    </div>
  );
}
