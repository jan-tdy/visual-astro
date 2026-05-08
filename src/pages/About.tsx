import { Link } from "react-router-dom";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Telescope, Star, Clock, Download, BookOpen, Settings as SettingsIcon, Layers, Sparkles, ScanLine, HelpCircle, Cpu, Languages, Heart, CreditCard } from "lucide-react";

const features = [
  { icon: Telescope, title: "Pozorovacie session", desc: "Vytvor novú session jedným klikom — prázdnu, ako kópiu z poslednej alebo z obľúbenej (s vynulovanými časmi)." },
  { icon: Star, title: "Katalóg hviezd", desc: "Plne editovateľný katalóg s konštantami VSNET / AAVSO, kartami porovnávacích hviezd a typmi (VISUAL, BINAR, ECL)." },
  { icon: Layers, title: "Navigácia podľa súhvezdí", desc: "Rýchle skoky medzi súhvezdiami a filter podľa typu — presne ako v pôvodnej tabuľke." },
  { icon: Clock, title: "Argelander metóda", desc: "Magnitúda sa počíta automaticky: mag = A + (Pasos A / (Pasos A + Pasos B)) · (B − A). Limity (<14.9) sú podporované." },
  { icon: Download, title: "Exporty VSNET / AAVSO / MEDUZA", desc: "Tri samostatné .txt súbory v správnych formátoch. Exportujú sa iba záznamy s vyplneným UT časom." },
  { icon: Sparkles, title: "Auto-save & JD", desc: "Všetko sa ukladá priebežne. Juliánsky dátum sa prepočítava v reálnom čase z UT." },
  { icon: Heart, title: "Obľúbená session", desc: "Označ si jednu session ako šablónu — chráni sa pred vymazaním a dá sa z nej kedykoľvek vytvoriť nová." },
  { icon: Languages, title: "Slovenčina / Angličtina", desc: "Prepínač jazyka v hlavičke (SK / EN) — voľba sa pamätá medzi reláciami." },
  { icon: Sparkles, title: "Prom katalóg", desc: "Samostatný editovateľný katalóg premenných hviezd — pridávanie, úpravy aj mazanie s potvrdením." },
  { icon: Download, title: "JSON export & import", desc: "Zálohuj si katalóg aj jednotlivé sessions ako JSON a kedykoľvek ich obnov či prenes inde." },
  { icon: CreditCard, title: "Plán Plus", desc: "Beta testing zadarmo (1.8 GB), alebo Plus za 2 €/mesačne — 15 AI skenov denne a 2.8 GB úložiska." },
];

export default function About() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
            <Sparkles className="h-3.5 w-3.5" /> Visual Astro
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            Visual Astro — denník vizuálneho pozorovania
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Moderná náhrada tabuľky <span className="font-mono text-sm">Reducciones.ods</span> — odhady magnitúd
            premenných hviezd Argelanderovou metódou s exportmi do VSNET, AAVSO a MEDUZA.
          </p>
          <div className="flex gap-2 justify-center mt-6">
            <Button asChild size="lg">
              <Link to="/">Otvoriť sessions</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/catalog"><BookOpen className="h-4 w-4 mr-1.5" /> Katalóg</Link>
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
          <h2 className="text-xl font-semibold mb-3">Ako to funguje</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>V <strong>Sessions</strong> vytvor novú session — prázdnu, ako kópiu z <em>poslednej</em>, alebo z <em>obľúbenej</em> (predvyplní hodnoty A/Paso/B, časy ostanú prázdne).</li>
            <li>V editore klikaj na súhvezdia v hornej navigácii alebo filtrovanie podľa typu (VISUAL, BINAR…).</li>
            <li>Pre každú pozorovanú hviezdu zadaj <strong>UT čas</strong> a hodnoty A, Paso A/B, B (alebo limit <code>&lt;14.9</code>).</li>
            <li>Magnitúda sa dopočíta sama. Vpravo hore vidíš počet vyplnených (s časom) záznamov.</li>
            <li>Stiahni si <strong>VSNET</strong>, <strong>AAVSO</strong> a <strong>MEDUZA</strong> súbory — pripravené na nahranie do databáz.</li>
          </ol>
        </Card>

        <Card className="p-6 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Languages className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Jazyk rozhrania</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            V hlavičke vpravo klikni na tlačidlo <code className="font-mono">SK / EN</code> a prepneš medzi
            slovenčinou a angličtinou. Tvoja voľba sa uloží lokálne do prehliadača.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-3">Nastavenia & katalóg</h2>
          <p className="text-sm text-muted-foreground mb-3">
            V <Link to="/settings" className="text-primary underline underline-offset-2"><SettingsIcon className="inline h-3.5 w-3.5" /> Nastaveniach</Link> nastav svoj observer kód (default <code className="font-mono">DPV</code>).
            V <Link to="/catalog" className="text-primary underline underline-offset-2">Katalógu</Link> môžeš pridávať, mazať a presúvať hviezdy medzi súhvezdiami.
          </p>
          <p className="text-xs text-muted-foreground">
            Údaje sú uložené v zabezpečenej cloudovej databáze, viazané na tvoje konto.
          </p>
        </Card>

        <Card className="p-6 mt-6 border-accent/40 bg-accent/5">
          <div className="flex items-start gap-3">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-accent/15 text-accent shrink-0">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-semibold">OCR & AI skenovanie</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/30">
                  čoskoro
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                V budúcnosti pribudne automatické rozpoznávanie ručne písaných tabuliek pomocou AI — odfotíš svoj papierový
                záznam a aplikácia sama vyplní hviezdy, hodnoty A/Paso/B aj UT časy. V pláne <strong>Plus</strong> bude k dispozícii
                15 skenov denne, v Beta testing pláne 5 skenov denne. Cieľom je úplne odstrániť manuálne prepisovanie.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Plány & fakturácia</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between mb-1">
                <strong>Beta testing</strong>
                <span className="text-primary font-semibold">0 €</span>
              </div>
              <p className="text-muted-foreground text-xs">Všetky funkcie · 1.8 GB úložiska · 5 AI skenov / deň (čoskoro).</p>
            </div>
            <div className="rounded-lg border border-primary/40 p-4">
              <div className="flex items-center justify-between mb-1">
                <strong>Plus</strong>
                <span className="text-primary font-semibold">2 € / mes.</span>
              </div>
              <p className="text-muted-foreground text-xs">2.8 GB úložiska · 15 AI skenov / deň · prioritná podpora.</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Predplatné spravuješ v <Link to="/settings" className="text-primary underline underline-offset-2">Nastaveniach → Plán & fakturácia</Link>.
            V náhľade prebiehajú platby v testovacom režime (karta <code className="font-mono">4242 4242 4242 4242</code>).
          </p>
        </Card>

        <Card className="p-6 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Návod — ako používať</h2>
          </div>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li><strong>Vytvor session</strong> v zozname Sessions — buď prázdnu, alebo kópiu poslednej (predvyplnené hodnoty, vynulované UT časy).</li>
            <li><strong>Nastav UT dátum a čas</strong> v hlavičke editora. JD sa dopočíta automaticky.</li>
            <li><strong>Naviguj cez súhvezdia</strong> hore alebo filtruj podľa typu (VISUAL, BINAR, ECL).</li>
            <li><strong>Pre každú hviezdu</strong> zadaj porovnávacie hviezdy A a B, počty pasos (Paso A, Paso B) a UT čas pozorovania v tvare <code>hh:mm</code> (medzeru nahradí dvojbodka automaticky).</li>
            <li>Ak hviezda nebola viditeľná, zadaj iba <strong>limit</strong> (napr. <code>&lt;14.9</code>).</li>
            <li>Vpravo hore vidíš počet <strong>vyplnených pozorovaní</strong> (so zadaným časom).</li>
            <li><strong>Importuj</strong> existujúcu tabuľku (.xlsx / .ods / .csv) tlačidlom „Import" v hlavičke editora — hodnoty sa namapujú podľa názvov hviezd.</li>
            <li><strong>Exportuj</strong> do VSNET / AAVSO / MEDUZA. Ikona oka zobrazí náhľad pred stiahnutím.</li>
          </ol>
        </Card>

        <Card className="p-6 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Ako to funguje technicky</h2>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              Aplikácia je <strong>React + TypeScript</strong> single-page app, postavená na Vite. UI komponenty
              sú postavené nad <strong>Tailwind CSS</strong> a knižnicou shadcn/ui. Pre stav pozorovaní využíva
              optimistický update s debounced zápisom do databázy (~600 ms), takže neexistuje tlačidlo „Uložiť" —
              všetko sa ukladá automaticky.
            </p>
            <p>
              Backend beží na <strong>Lovable Cloud</strong> (PostgreSQL + autentifikácia). Tabuľky <code>sessions</code>,
              <code> observations</code>, <code>stars</code> a <code>profiles</code> sú zabezpečené pomocou
              <strong> Row-Level Security</strong> — vidíš a meníš iba vlastné dáta.
            </p>
            <p>
              <strong>Juliánsky dátum</strong> sa počíta z UT pomocou klasickej Meeusovej formuly. <strong>Magnitúda</strong>
              vychádza z Argelanderovej metódy: <code className="font-mono">mag = A + (PA / (PA + PB)) · (B − A)</code>,
              zaokrúhlená na jedno desatinné miesto. Limity sa exportujú s prefixom <code>&lt;</code>.
            </p>
            <p>
              <strong>Exporty</strong> sú generované klientsky — VSNET, AAVSO (Visual File Format) a MEDUZA majú každý
              vlastný formátovač s presne danou šírkou stĺpcov a hlavičkami. Importér používa knižnicu <code>SheetJS (xlsx)</code>
              a párovanie podľa názvu hviezdy (case-insensitive).
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
}