export interface ImageConfig {
  src?: string;
  fit?: "cover" | "contain" | "fill";
  alt?: string;
}

export function ImageWidget({ config }: { config: ImageConfig }) {
  if (!config.src) {
    return <div className="flex h-full w-full items-center justify-center opacity-60">No image</div>;
  }
  return (
    <img
      src={config.src}
      alt={config.alt ?? ""}
      className="h-full w-full"
      style={{ objectFit: config.fit ?? "cover" }}
    />
  );
}