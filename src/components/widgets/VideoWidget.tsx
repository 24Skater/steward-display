import { SetupHint } from "./SetupHint";

export interface VideoConfig {
  src?: string;
  muted?: boolean;
  loop?: boolean;
}

export function VideoWidget({ config }: { config: VideoConfig }) {
  if (!config.src) return <SetupHint>Choose a video</SetupHint>;
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
