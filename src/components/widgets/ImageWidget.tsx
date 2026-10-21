import { SetupHint } from "./SetupHint";

export interface ImageConfig {
  src?: string;
  fit?: "cover" | "contain" | "fill";
  alt?: string;
}

export function ImageWidget({ config }: { config: ImageConfig }) {
  if (!config.src) return <SetupHint>Choose an image</SetupHint>;
  return (
    <img
      src={config.src}
      alt={config.alt ?? ""}
      className="h-full w-full"
      style={{ objectFit: config.fit ?? "cover" }}
    />
  );
}
