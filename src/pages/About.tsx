import { Link } from "react-router-dom";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Telescope, Star, Clock, Download, BookOpen, Settings as SettingsIcon, Layers, Sparkles } from "lucide-react";

const features = [
  { icon: Telescope, title: "Pozorovacie session", desc: "Vytvor novú session jedným klikom — buď prázdnu, alebo ako kópiu z poslednej s automaticky vynulovanými časmi." },
  { icon: Star, title: "Katalóg hviezd", desc: "Plne editovateľný katalóg s konštantami VSNET / AAVSO, kartami porovnávacích hviezd a typmi (VISUAL, BINAR, ECL)." },
  { icon: Layers, title: "Navigácia podľa súhvezdí", desc: "Rýchle skoky medzi súhvezdiami a filter podľa typu — presne ako v pôvodnej tabuľke." },
  { icon: Clock, title: "Argelander metóda", desc: "Magnitúda sa počíta automaticky: mag = A + (Pasos A / (Pasos A + Pasos B)) · (B − A). Limity (<14.9) sú podporované." },
  { icon: Download, title: "Exporty VSNET / AAVSO / MEDUZA", desc: "Tri samostatné .txt súbory v správnych formátoch. Exportujú sa iba záznamy s vyplneným UT časom." },
  { icon: Sparkles, title: "Auto-save & JD", desc: "Všetko sa ukladá priebežne. Juliánsky dátum sa prepočítava v reálnom čase z UT." },
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
            Digitálny denník vizuálneho pozorovania
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
            <li>V <strong>Sessions</strong> vytvor novú session — najlepšie ako kópiu z poslednej (predvyplní hodnoty A/Paso/B, časy ostanú prázdne).</li>
            <li>V editore klikaj na súhvezdia v hornej navigácii alebo filtrovanie podľa typu (VISUAL, BINAR…).</li>
            <li>Pre každú pozorovanú hviezdu zadaj <strong>UT čas</strong> a hodnoty A, Paso A/B, B (alebo limit <code>&lt;14.9</code>).</li>
            <li>Magnitúda sa dopočíta sama. Vpravo hore vidíš počet vyplnených (s časom) záznamov.</li>
            <li>Stiahni si <strong>VSNET</strong>, <strong>AAVSO</strong> a <strong>MEDUZA</strong> súbory — pripravené na nahranie do databáz.</li>
          </ol>
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
      </main>
    </div>
  );
}