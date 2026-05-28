import { Link } from "react-router-dom";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Telescope, Star, Clock, Download, BookOpen, Settings as SettingsIcon, Layers, Sparkles, ScanLine, HelpCircle, Cpu, Languages, Heart, CreditCard } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

const FEATURES_SK = [
  { icon: Telescope, title: "Pozorovacie session", desc: "Vytvor novú session jedným klikom — prázdnu, ako kópiu z poslednej alebo z obľúbenej (s vynulovanými časmi)." },
  { icon: Star, title: "Katalóg hviezd", desc: "Plne editovateľný katalóg s konštantami VSNET / AAVSO, kartami porovnávacích hviezd a typmi (VISUAL, BINAR, ECL)." },
  { icon: Layers, title: "Navigácia podľa súhvezdí", desc: "Rýchle skoky medzi súhvezdiami a filter podľa typu — presne ako v pôvodnej tabuľke." },
  { icon: Clock, title: "Argelander metóda", desc: "Magnitúda sa počíta automaticky: mag = A + (Pasos A / (Pasos A + Pasos B)) · (B − A). Limity (<14.9) sú podporované." },
  { icon: Download, title: "Exporty VSNET / AAVSO / MEDUZA", desc: "Tri samostatné .txt súbory v správnych formátoch. Exportujú sa iba záznamy s vyplneným UT časom." },
  { icon: Sparkles, title: "Auto-save & JD", desc: "Všetko sa ukladá priebežne. Juliánsky dátum sa prepočítava v reálnom čase z UT." },
  { icon: Heart, title: "Obľúbená session", desc: "Označ si jednu session ako šablónu — chráni sa pred vymazaním a dá sa z nej kedykoľvek vytvoriť nová." },
  { icon: Languages, title: "Slovenčina / Angličtina", desc: "Prepínač jazyka v hlavičke (SK / EN) — voľba sa pamätá medzi reláciami." },
  { icon: ScanLine, title: "AI OCR skenovanie", desc: "Odfotíš ručne písaný papier a AI ho automaticky prepíše do tabuľky. Free 5/deň, Plus 15/deň." },
  { icon: Download, title: "JSON export & import", desc: "Zálohuj si katalóg aj jednotlivé sessions ako JSON a kedykoľvek ich obnov či prenes inde." },
  { icon: CreditCard, title: "Plán Plus", desc: "Free plán (200 MB), alebo Plus za 2 €/mesačne — predvolené súhvezdie, 800 MB úložiska a 15 AI skenov denne." },
];
const FEATURES_EN = [
  { icon: Telescope, title: "Observing sessions", desc: "Create a new session in one click — empty, a copy of the last, or from your favorite (with cleared UT times)." },
  { icon: Star, title: "Star catalog", desc: "Fully editable catalog with VSNET / AAVSO codes, comparison-star charts and types (VISUAL, BINAR, ECL)." },
  { icon: Layers, title: "Constellation navigation", desc: "Quick jumps between constellations and filter by type — exactly like the original spreadsheet." },
  { icon: Clock, title: "Argelander method", desc: "Magnitude is computed automatically: mag = A + (Pasos A / (Pasos A + Pasos B)) · (B − A). Limits (<14.9) are supported." },
  { icon: Download, title: "VSNET / AAVSO / MEDUZA exports", desc: "Three separate .txt files in correct formats. Only entries with a filled UT time are exported." },
  { icon: Sparkles, title: "Auto-save & JD", desc: "Everything is saved as you type. Julian Date is computed in real time from UT." },
  { icon: Heart, title: "Favorite session", desc: "Mark one session as a template — it's protected from deletion and can be used to spawn new ones." },
  { icon: Languages, title: "Slovak / English", desc: "Language switcher in the header (SK / EN) — choice persists between sessions." },
  { icon: ScanLine, title: "AI OCR scanning", desc: "Photograph a hand-written paper log and AI transcribes it into the table. Free 5/day, Plus 15/day." },
  { icon: Download, title: "JSON export & import", desc: "Back up your catalog and individual sessions as JSON and restore or transfer anywhere." },
  { icon: CreditCard, title: "Plus plan", desc: "Free plan (200 MB) or Plus at €2/month — default constellation, 800 MB storage and 15 AI scans/day." },
];

export default function About() {
  const { lang, t } = useI18n();
  const features = lang === "sk" ? FEATURES_SK : FEATURES_EN;
  const isSk = lang === "sk";
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
            {isSk ? <>
              <li>V <strong>Sessions</strong> vytvor novú session — prázdnu, ako kópiu z <em>poslednej</em>, alebo z <em>obľúbenej</em> (predvyplní hodnoty A/Paso/B, časy ostanú prázdne).</li>
              <li>V editore klikaj na súhvezdia v hornej navigácii alebo filtruj podľa typu (VISUAL, BINAR…).</li>
              <li>Pre každú pozorovanú hviezdu zadaj <strong>UT čas</strong> a hodnoty A, Paso A/B, B (alebo limit <code>&lt;14.9</code>).</li>
              <li>Magnitúda sa dopočíta sama. Vpravo hore vidíš počet vyplnených záznamov.</li>
              <li>Stiahni si <strong>VSNET</strong>, <strong>AAVSO</strong> a <strong>MEDUZA</strong> súbory — pripravené na nahranie do databáz.</li>
            </> : <>
              <li>In <strong>Sessions</strong> create a new session — empty, a copy of the <em>last</em>, or from your <em>favorite</em> (prefills A/Paso/B values, clears UT times).</li>
              <li>In the editor jump between constellations in the top nav, or filter by type (VISUAL, BINAR…).</li>
              <li>For each observed star enter the <strong>UT time</strong> and A, Paso A/B, B values (or a limit like <code>&lt;14.9</code>).</li>
              <li>Magnitude is computed automatically. The top-right counter shows filled entries.</li>
              <li>Download <strong>VSNET</strong>, <strong>AAVSO</strong> and <strong>MEDUZA</strong> files — ready to submit to the databases.</li>
            </>}
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
          {isSk ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                V <Link to="/settings" className="text-primary underline underline-offset-2"><SettingsIcon className="inline h-3.5 w-3.5" /> Nastaveniach</Link> nastav svoj observer kód (default <code className="font-mono">DPV</code>).
                V <Link to="/catalog" className="text-primary underline underline-offset-2">Katalógu</Link> môžeš pridávať, mazať a presúvať hviezdy medzi súhvezdiami.
              </p>
              <p className="text-xs text-muted-foreground">Údaje sú uložené v zabezpečenej cloudovej databáze, viazané na tvoje konto.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                In <Link to="/settings" className="text-primary underline underline-offset-2"><SettingsIcon className="inline h-3.5 w-3.5" /> Settings</Link> set your observer code (default <code className="font-mono">DPV</code>).
                In the <Link to="/catalog" className="text-primary underline underline-offset-2">Catalog</Link> you can add, remove and move stars between constellations.
              </p>
              <p className="text-xs text-muted-foreground">Data is stored in a secure cloud database, tied to your account.</p>
            </>
          )}
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
              <p className="text-muted-foreground text-xs">{isSk ? "Takmer všetky funkcie · 200 MB úložiska · 5 AI skenov / deň." : "Almost all features · 200 MB storage · 5 AI scans / day."}</p>
            </div>
            <div className="rounded-lg border border-primary/40 p-4">
              <div className="flex items-center justify-between mb-1">
                <strong>Plus</strong>
                <span className="text-primary font-semibold">{isSk ? "2 € / mes." : "€2 / mo."}</span>
              </div>
              <p className="text-muted-foreground text-xs">{isSk ? "Predvolené súhvezdie · 800 MB úložiska · 15 AI skenov / deň." : "Default constellation · 800 MB storage · 15 AI scans / day."}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {isSk
              ? <>Predplatné spravuješ v <Link to="/settings" className="text-primary underline underline-offset-2">Nastaveniach → Plán & fakturácia</Link>.</>
              : <>Manage your subscription in <Link to="/settings" className="text-primary underline underline-offset-2">Settings → Plan & billing</Link>.</>}
          </p>
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