export interface TextConfig {
  text?: string;
  align?: "left" | "center" | "right";
}

export function TextWidget({ config }: { config: TextConfig }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center p-4 text-${config.align ?? "left"}`}
    >
      <p
        className="w-full leading-snug whitespace-pre-wrap"
        style={{ fontSize: "clamp(0.875rem, 3cqw, 2rem)" }}
      >
        {config.text || "Text"}
      </p>
    </div>
  );
}
