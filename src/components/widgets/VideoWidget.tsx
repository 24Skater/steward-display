export interface VideoConfig {
  src?: string;
  muted?: boolean;
  loop?: boolean;
}

export function VideoWidget({ config }: { config: VideoConfig }) {
  if (!config.src)
    return (
      <div className="flex h-full w-full items-center justify-center opacity-60">No video</div>
    );
  return (
    <video
      src={config.src}
      className="h-full w-full object-cover"
      autoPlay
      muted={config.muted ?? true}
      loop={config.loop ?? true}
      playsInline
    />
  );
}
