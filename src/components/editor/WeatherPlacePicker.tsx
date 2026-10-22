import { MapPin, Search } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { searchPlacesFn } from "@/lib/api/weather.functions";
import { errorMessage } from "@/lib/errors";
import type { WeatherPlace } from "@/lib/weather";

interface WeatherPlacePickerProps {
  value: WeatherPlace | undefined;
  onChange: (place: WeatherPlace) => void;
}

function describe(place: WeatherPlace): string {
  return [place.name, place.region, place.country].filter(Boolean).join(", ");
}

/**
 * Search by name and pick one: a TV should never have to guess which
 * Springfield a volunteer meant.
 */
export function WeatherPlacePicker({ value, onChange }: WeatherPlacePickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherPlace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResults(await searchPlacesFn({ data: { query } }));
    } catch (err) {
      setError(errorMessage(err));
      setResults(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {value && (
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
          {describe(value)}
        </p>
      )}
      <form onSubmit={search} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={value ? "Change place…" : "Town or city"}
          aria-label="Search for a place"
        />
        <Button
          type="submit"
          variant="outline"
          size="icon"
          disabled={busy || query.trim().length < 2}
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {results && results.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No places by that name. Try the nearest town.
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-md border border-border">
          {results.map((place) => (
            <li key={`${place.latitude},${place.longitude}`}>
              <button
                type="button"
                onClick={() => {
                  onChange(place);
                  setResults(null);
                  setQuery("");
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                {describe(place)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
