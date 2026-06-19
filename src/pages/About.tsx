import { Link } from "react-router-dom";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Telescope, Star, Clock, Download, BookOpen, Settings as SettingsIcon, Layers, Sparkles, ScanLine, HelpCircle, Cpu, Languages, Heart, CreditCard } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

const FEATURE_KEYS = [
  { icon: Telescope, key: "sessions" },
  { icon: Star, key: "catalog" },
  { icon: Layers, key: "nav" },
  { icon: Clock, key: "method" },
  { icon: Download, key: "exports" },
  { icon: Sparkles, key: "autosave" },
  { icon: Heart, key: "favorite" },
  { icon: Languages, key: "language" },
  { icon: ScanLine, key: "ocr" },
  { icon: Download, key: "json" },
  { icon: CreditCard, key: "plus" },
];

export default function About() {
  const { t } = useI18n();
  const features = FEATURE_KEYS.map((f) => ({
    icon: f.icon,
    title: t(`about.feature.${f.key}.title`),
    desc: t(`about.feature.${f.key}.desc`),
  }));
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Sparkles className="h-3.5 w-3.5" /> Visual Astro
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            {t("about.title")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("about.subtitle")}
          </p>
          <div className="flex gap-2 justify-center mt-6">
            <Button asChild size="lg">
              <Link to="/">{t("about.openSessions")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/catalog"><BookOpen className="h-4 w-4 mr-1.5" /> {t("about.openCatalog")}</Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {features.map((f) => (
            <Card key={f.title} className="p-5 hover:border-primary/40 transition-colors">
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary mb-3">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>

        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">{t("about.howItWorks")}</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            {[1, 2, 3, 4, 5].map((n) => <li key={n}>{t(`about.work.${n}`)}</li>)}
          </ol>
        </Card>

        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Languages className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t("about.language")}</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("about.languageDesc")}
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-3">{t("about.settingsCatalog")}</h2>
          <p className="text-sm text-muted-foreground mb-3">
            <SettingsIcon className="inline h-3.5 w-3.5 text-primary" /> {t("about.settingsDesc")}
          </p>
          <p className="text-xs text-muted-foreground">{t("about.dataStored")}</p>
        </Card>

        <Card className="p-6 mt-6 border-accent/40 bg-accent/5">
          <div className="flex items-start gap-3">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-accent/15 text-accent shrink-0">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-1">{t("about.ocrTitle")}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{t("about.ocrDesc")}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t("about.plans")}</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-1">
                <strong>Free</strong>
                <span className="text-primary font-semibold">0 €</span>
              </div>
              <p className="text-muted-foreground text-xs">{t("about.plan.free")}</p>
            </div>
            <div className="rounded-lg border border-primary/40 p-4">
              <div className="flex items-center justify-between mb-1">
                <strong>Plus</strong>
                <span className="text-primary font-semibold">{t("about.plan.price")}</span>
              </div>
              <p className="text-muted-foreground text-xs">{t("about.plan.plus")}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">{t("about.plan.manage")}</p>
        </Card>

        <Card className="p-6 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t("about.howToUse")}</h2>
          </div>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            {isSk ? <>
              <li><strong>Vytvor session</strong> v zozname Sessions — buď prázdnu, alebo kópiu poslednej.</li>
              <li><strong>Nastav UT dátum</strong> v hlavičke editora. JD sa dopočíta automaticky.</li>
              <li><strong>Naviguj cez súhvezdia</strong> hore alebo filtruj podľa typu.</li>
              <li>Pre každú hviezdu zadaj A, B, Paso A/B a UT čas v tvare <code>hh:mm</code>.</li>
              <li>Ak hviezda nebola viditeľná, zadaj iba <strong>limit</strong> (napr. <code>&lt;14.9</code>).</li>
              <li><strong>Import z papiera</strong> — odfoť ručne písaný papier a AI ho prepíše.</li>
              <li><strong>Exportuj</strong> do VSNET / AAVSO / MEDUZA.</li>
            </> : <>
              <li><strong>Create a session</strong> in the Sessions list — empty or a copy of the last one.</li>
              <li><strong>Set the UT date</strong> in the editor header. JD is computed automatically.</li>
              <li><strong>Navigate constellations</strong> at the top, or filter by type.</li>
              <li>For each star enter A, B, Paso A/B and the UT time as <code>hh:mm</code>.</li>
              <li>If a star wasn't visible, enter just a <strong>limit</strong> (e.g. <code>&lt;14.9</code>).</li>
              <li><strong>Import from paper</strong> — photograph a handwritten log and AI transcribes it.</li>
              <li><strong>Export</strong> to VSNET / AAVSO / MEDUZA.</li>
            </>}
          </ol>
        </Card>

        <Card className="p-6 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t("about.tech")}</h2>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            {isSk ? <>
              <p>Aplikácia je <strong>React + TypeScript</strong> SPA na Vite. UI je postavené nad Tailwind CSS a shadcn/ui. Pozorovania sa ukladajú s debounce (~600 ms), bez tlačidla „Uložiť".</p>
              <p>Backend beží na <strong>Lovable Cloud</strong> (PostgreSQL + auth). Tabuľky sú zabezpečené pomocou <strong>Row-Level Security</strong>.</p>
              <p><strong>Magnitúda</strong>: <code className="font-mono">mag = A + (PA / (PA + PB)) · (B − A)</code>.</p>
              <p>Exporty sú generované klientsky. AI OCR beží cez Lovable AI Gateway (Gemini 2.5 Pro).</p>
            </> : <>
              <p>The app is a <strong>React + TypeScript</strong> Vite SPA. UI is built on Tailwind CSS and shadcn/ui. Observations are saved with debounce (~600 ms) — no "Save" button.</p>
              <p>The backend runs on <strong>Lovable Cloud</strong> (PostgreSQL + auth). Tables are protected by <strong>Row-Level Security</strong>.</p>
              <p><strong>Magnitude</strong>: <code className="font-mono">mag = A + (PA / (PA + PB)) · (B − A)</code>.</p>
              <p>Exports are generated client-side. AI OCR runs through the Lovable AI Gateway (Gemini 2.5 Pro).</p>
            </>}
          </div>
        </Card>
      </main>
    </div>
  );
}