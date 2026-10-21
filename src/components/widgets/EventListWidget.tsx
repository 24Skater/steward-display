import { SetupHint } from "./SetupHint";

export interface EventEntry {
  name: string;
  date: string;
  time?: string;
}
export interface EventListConfig {
  title?: string;
  events?: EventEntry[];
}

export function EventListWidget({ config }: { config: EventListConfig }) {
  const events = config.events ?? [];
  if (events.length === 0) return <SetupHint>Add events</SetupHint>;
  return (
    <div className="flex h-full w-full flex-col gap-3 p-5">
      {config.title && (
        <h3 className="font-semibold" style={{ fontSize: "clamp(1rem, 3cqw, 1.75rem)" }}>
          {config.title}
        </h3>
      )}
      <ul className="flex flex-col gap-2 overflow-hidden">
        {events.map((e, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 border-b border-white/10 pb-2 last:border-0"
          >
            <span
              className="truncate font-medium"
              style={{ fontSize: "clamp(0.875rem, 2.5cqw, 1.5rem)" }}
            >
              {e.name}
            </span>
            <span
              className="shrink-0 rounded-md bg-white/10 px-2 py-1 tabular-nums"
              style={{ fontSize: "clamp(0.75rem, 2cqw, 1.125rem)" }}
            >
              {e.date}
              {e.time ? ` · ${e.time}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
