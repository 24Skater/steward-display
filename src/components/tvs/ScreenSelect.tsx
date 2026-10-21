import type { Screen } from "@/types";

interface ScreenSelectProps {
  id: string;
  screens: Screen[];
  value: string | null;
  onChange: (screenId: string | null) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

const NONE = "";

/** Which screen a TV shows. "Nothing yet" leaves the TV on its standby slate. */
export function ScreenSelect({
  id,
  screens,
  value,
  onChange,
  disabled,
  ...aria
}: ScreenSelectProps) {
  return (
    <select
      id={id}
      value={value ?? NONE}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={aria["aria-label"]}
      className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      <option value={NONE}>Nothing yet (standby)</option>
      {screens.map((screen) => (
        <option key={screen.id} value={screen.id}>
          {screen.name}
        </option>
      ))}
    </select>
  );
}
