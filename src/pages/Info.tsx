import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Telescope, Sparkles, Clock, Moon, Table2, BarChart3, Download, ScanLine, Languages,
} from "lucide-react";
import coverUrl from "@/assets/visual-astro-cover.png";
import pozorShotUrl from "@/assets/info-screenshot-pozor.png";
import sessionsShotUrl from "@/assets/info-screenshot-sessions.png";

const FEATURES = [
  {
    icon: Telescope,
    title: "Sessions",
    desc: "Start a new observing session in one click — blank, copied from your last session, or from a favorite with times reset.",
  },
  {
    icon: Sparkles,
    title: "Personal catalog",
    desc: "Manage your own catalog of variable stars and comparison sequences, organized by constellation.",
  },
  {
    icon: Clock,
    title: "Nijland–Blazhko method",
    desc: "Enter step estimates and UT times; magnitudes are computed for you automatically.",
  },
  {
    icon: Moon,
    title: "Pozor — night planning",
    desc: "Altitude charts, night charts, eclipsing-variable minima predictions, a target catalog, and an observability journal.",
  },
  {
    icon: Table2,
    title: "Conversion table",
    desc: "A spreadsheet-style table of comparison stars. If the user prefers letter labels for comparison stars, the magnitude values are stored here.",
  },
  {
    icon: BarChart3,
    title: "Graphs",
    desc: "Visualize light curves and trends across your observing sessions at a glance.",
  },
  {
    icon: Download,
    title: "VSNET / AAVSO exports",
    desc: "Generate ready-to-submit VSNET/AAVSO Extended exports, PDF paper templates, and JSON/XLSX data dumps.",
  },
  {
    icon: ScanLine,
    title: "Paper OCR",
    desc: "Scan a handwritten observation sheet and let AI fill in object, step values, and UT times for you.",
  },
  {
    icon: Languages,
    title: "Multi-language UI",
    desc: "Available in several interface languages, so observers around the world feel at home.",
  },
];

const STEPS = [
  { title: "Sign up", desc: "Create a free account — your personal catalog is seeded automatically." },
  { title: "Start a session", desc: "Open a new observing session for tonight, in one click." },
  { title: "Log estimates", desc: "Record step values and UT times for each star." },
  { title: "Review magnitudes", desc: "Magnitudes are computed automatically as you type." },
  { title: "Export", desc: "Send your results to VSNET/AAVSO, or export PDF/JSON/XLSX." },
];

function BrowserFrame({ url, src, alt }: { url: string; src: string; alt: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10 overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border bg-background/60">
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="ml-2 flex-1 text-[11px] text-muted-foreground bg-background border border-border rounded-full px-3 py-0.5">
          {url}
        </span>
      </div>
      <img src={src} alt={alt} className="w-full" />
    </div>
  );
}

export default function Info() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur bg-background/75 border-b border-border">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-4 max-w-6xl">
          <Link to="/info" className="inline-flex items-center gap-2.5">
            <img src={coverUrl} alt="" aria-hidden className="h-8 w-8 rounded-lg" />
            <span
              className="text-lg font-bold tracking-tight"
              style={{ fontFamily: "'Roboto Serif', 'Roboto Flex', serif" }}
            >
              Visual Astro
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
              beta
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/auth">Log in</Link>
            </Button>
            <Button asChild className="rounded-full">
              <Link to="/auth?mode=signup">Sign up free</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden py-16 sm:py-20">
          <div
            aria-hidden
            className="absolute -inset-x-10 -top-40 h-[480px] pointer-events-none -z-10"
            style={{
              background:
                "radial-gradient(60% 60% at 30% 20%, hsl(var(--primary) / 0.22), transparent 70%), radial-gradient(50% 50% at 80% 10%, hsl(var(--accent) / 0.18), transparent 70%)",
            }}
          />
          <div className="container mx-auto px-4 max-w-6xl grid lg:grid-cols-[0.85fr_1.2fr] gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 border border-primary/25 rounded-full px-3 py-1 mb-4">
                ★ By JapySoft
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.08] mb-4">
                Your variable-star observing logbook, reimagined.
              </h1>
              <p className="text-lg text-muted-foreground max-w-[42ch] mb-7">
                Visual Astro is a modern, web-based tool for visual observers of variable stars.
                Log sessions, estimate magnitudes with the Nijland–Blažko method, plan your
                night, and export straight to <strong className="text-foreground">VSNET</strong>{" "}
                and <strong className="text-foreground">AAVSO</strong> — all from your browser.
              </p>
              <div className="flex flex-wrap gap-3 mb-4">
                <Button asChild size="lg" className="rounded-full">
                  <Link to="/auth?mode=signup">Create free account</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full">
                  <Link to="/auth">I already have an account</Link>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Free plan included — no credit card required.</p>
            </div>
            <BrowserFrame
              url="japysoft.bombol.space/pozor"
              src={pozorShotUrl}
              alt="Pozor night-planning altitude chart in Visual Astro, showing three eclipsing variable stars tracked above the horizon"
            />
          </div>
        </section>

        <section className="py-14">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-3xl font-bold mb-2">Everything a visual observer needs</h2>
              <p className="text-muted-foreground">
                One tool for the whole workflow — from a fresh session to a finished VSNET/AAVSO export.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f) => (
                <Card key={f.title} className="p-5 hover:border-primary/40 transition-colors">
                  <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary mb-3">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-3xl font-bold mb-2">How it works</h2>
              <p className="text-muted-foreground">From clear sky to submitted data in a few steps.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {STEPS.map((s, i) => (
                <Card key={s.title} className="p-5">
                  <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-sm mb-3">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-3xl font-bold mb-2">A quick look</h2>
              <p className="text-muted-foreground">Real screens from the app.</p>
            </div>
            <div className="max-w-3xl mx-auto text-center">
              <BrowserFrame
                url="japysoft.bombol.space/"
                src={sessionsShotUrl}
                alt="Observing sessions list in Visual Astro, showing session dates, Julian Dates, and observation counts"
              />
              <h3 className="font-semibold mt-4 mb-1">Your observing sessions</h3>
              <p className="text-sm text-muted-foreground">
                Start a new session in one click — blank, copied from your last session, or from a favorite.
              </p>
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-3xl font-bold mb-2">Plans</h2>
              <p className="text-muted-foreground">Every observer starts on a generous free plan.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <Card className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <strong>Free</strong>
                  <span className="text-primary font-semibold">0 €</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  All core features, 0.4 GB storage, and 4 AI paper scans per month — for everyone, forever.
                </p>
              </Card>
              <Card className="p-6 border-primary/40 ring-1 ring-primary/10">
                <div className="flex items-center justify-between mb-1">
                  <strong>Enterprise</strong>
                  <span className="text-primary font-semibold">from 0 €</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Negotiable, higher limits for observatories and teams — reach out to discuss what you need.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="container mx-auto px-4 max-w-6xl">
            <div
              className="text-center rounded-3xl border border-border p-10 sm:p-14"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--accent) / 0.1))",
              }}
            >
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Ready to log tonight&apos;s session?</h2>
              <p className="text-muted-foreground mb-6">
                Create your free Visual Astro account and start observing in minutes.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild size="lg" className="rounded-full">
                  <Link to="/auth?mode=signup">Sign up free</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full">
                  <Link to="/auth">Log in</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 max-w-6xl flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} jan-tdy — Visual Astro. Licensed under AGPL-3.0.</span>
          <nav className="flex gap-5 flex-wrap">
            <a href="https://github.com/jan-tdy/visual-astro" className="hover:text-primary">GitHub</a>
            <a href="https://github.com/jan-tdy/visual-astro/blob/main/LICENSE" className="hover:text-primary">License</a>
            <Link to="/auth" className="hover:text-primary">Log in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
