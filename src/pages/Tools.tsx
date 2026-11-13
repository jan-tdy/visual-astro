import { Link } from "react-router-dom";
import { AppShell } from "@/components/app/AppShell";
import { useI18n } from "@/hooks/useI18n";
import { TOOL_SECTIONS, toolsBySection } from "@/lib/tools/registry";

const SECTION_LABEL_KEY: Record<string, string> = {
  coordinates: "tools.section.coordinates",
  converters: "tools.section.converters",
  telescope: "tools.section.telescope",
  planning: "tools.section.planning",
  fun: "tools.section.fun",
};

export default function Tools() {
  const { t } = useI18n();

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1">{t("tools.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tools.subtitle")}</p>
        </div>

        {TOOL_SECTIONS.map((section) => {
          const tools = toolsBySection(section);
          if (tools.length === 0) return null;
          return (
            <section key={section} className="mb-8">
              <h2 className="text-lg font-semibold mb-3">{t(SECTION_LABEL_KEY[section])}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Link
                      key={tool.slug}
                      to={`/tools/${tool.slug}`}
                      className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <Icon className="h-5 w-5 mt-0.5 shrink-0 text-primary" aria-hidden />
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{t(tool.titleKey)}</div>
                        {tool.descKey && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t(tool.descKey)}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
