import { Sparkles } from "lucide-react";
import { LAYOUT_TEMPLATES, type LayoutTemplate } from "@/lib/layoutTemplates";

export function LayoutTemplatePicker({
  onChoose,
  onBlank,
}: {
  onChoose: (template: LayoutTemplate) => void;
  onBlank: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue/10 text-blue">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Pick a starting layout</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a template to seed your screen, or start with a blank canvas. You can always edit later.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LAYOUT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChoose(t)}
            className="group flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-blue hover:shadow-steward-md"
          >
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg bg-subtle">
              <div className="absolute inset-0">
                {t.preview.map((p, i) => (
                  <div
                    key={i}
                    className="absolute rounded border border-blue/40 bg-blue/15 transition-colors group-hover:border-blue group-hover:bg-blue/25"
                    style={{
                      left: `${(p.x / 24) * 100}%`,
                      top: `${(p.y / 16) * 100}%`,
                      width: `${(p.w / 24) * 100}%`,
                      height: `${(p.h / 16) * 100}%`,
                    }}
                  >
                    <span className="flex h-full items-center justify-center text-[10px] font-medium text-blue/80">
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm font-semibold text-foreground">{t.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onBlank}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Or start with a blank canvas →
        </button>
      </div>
    </div>
  );
}