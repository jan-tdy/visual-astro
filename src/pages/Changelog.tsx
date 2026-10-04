import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Tag } from "lucide-react";
import { useI18n } from "@/hooks/useI18n";

const REPO = "jan-tdy/visual-astro";
const DEFAULT_BRANCH = "main";

type Release = {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
  draft: boolean;
};

type CompareCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { date: string } | null };
};

type Compare = {
  ahead_by: number;
  html_url: string;
  commits: CompareCommit[];
};

// Minimal, safe markdown rendering (no HTML injection): headings, bullets, bold, code, links.
function renderInline(text: string, key: string) {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|https?:\/\/\S+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const s = m[0];
    const k = `${key}-${i++}`;
    if (s.startsWith("**")) parts.push(<strong key={k}>{s.slice(2, -2)}</strong>);
    else if (s.startsWith("`")) parts.push(<code key={k} className="px-1 rounded bg-secondary text-xs">{s.slice(1, -1)}</code>);
    else if (s.startsWith("[")) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(s)!;
      parts.push(<a key={k} href={mm[2]} target="_blank" rel="noopener noreferrer" className="text-primary underline">{mm[1]}</a>);
    } else parts.push(<a key={k} href={s} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{s}</a>);
    last = m.index + s.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  return (
    <div className="space-y-1.5 text-sm">
      {lines.map((l, idx) => {
        const k = String(idx);
        if (!l.trim()) return null;
        const h = /^(#{1,6})\s+(.*)/.exec(l);
        if (h) return <h3 key={k} className="font-semibold mt-3">{renderInline(h[2], k)}</h3>;
        const b = /^\s*[-*]\s+(.*)/.exec(l);
        if (b) return <div key={k} className="pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-muted-foreground">{renderInline(b[1], k)}</div>;
        return <p key={k}>{renderInline(l, k)}</p>;
      })}
    </div>
  );
}

export default function Changelog() {
  const { lang } = useI18n();
  const sk = lang === "sk";
  const { data, isLoading, error } = useQuery({
    queryKey: ["gh-releases"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=50`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      return ((await r.json()) as Release[]).filter((x) => !x.draft);
    },
  });

  // Most recent *stable* release (legacy ad-hoc tags like "august24-01" are
  // marked prerelease on GitHub, so this skips them and lands on the latest
  // real vX.Y.Z release).
  const lastStable = data?.find((r) => !r.prerelease);

  const { data: compare } = useQuery({
    queryKey: ["gh-compare", lastStable?.tag_name],
    enabled: !!lastStable,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const r = await fetch(
        `https://api.github.com/repos/${REPO}/compare/${lastStable!.tag_name}...${DEFAULT_BRANCH}`,
        { headers: { Accept: "application/vnd.github+json" } },
      );
      if (!r.ok) throw new Error(`GitHub ${r.status}`);
      return (await r.json()) as Compare;
    },
  });

  const unreleasedCommits = (compare?.commits ?? [])
    .filter((c) => !/^Merge /.test(c.commit.message))
    .reverse();

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" />{sk ? "Späť" : "Back"}</Link>
      </Button>
      <h1 className="text-2xl font-semibold mb-1">Changelog</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {sk ? "Zoznam verzií z " : "Releases from "}
        <a className="text-primary underline" href={`https://github.com/${REPO}/releases`} target="_blank" rel="noopener noreferrer">GitHub</a>
        {" · "}{sk ? "aktuálna verzia" : "current version"}: {__APP_VERSION__}
      </p>
      {isLoading && <p className="text-muted-foreground">{sk ? "Načítavam…" : "Loading…"}</p>}
      {error && <p className="text-destructive">{sk ? "Nepodarilo sa načítať zoznam verzií." : "Could not load releases."} ({String((error as Error).message)})</p>}
      {data && data.length === 0 && <p className="text-muted-foreground">{sk ? "Zatiaľ žiadne verzie." : "No releases yet."}</p>}
      {unreleasedCommits.length > 0 && (
        <Card className="p-5 mb-4 border-dashed">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="text-lg font-semibold inline-flex items-center gap-2">
              <Tag className="h-4 w-4 text-accent" />
              {sk ? "Nevydané zmeny (dev)" : "Unreleased changes (dev)"}
              <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-accent/15 text-accent">dev</span>
            </h2>
            {compare && (
              <a href={compare.html_url} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {sk
              ? `Od poslednej verzie ${lastStable?.tag_name} pribudlo na ${DEFAULT_BRANCH}:`
              : `Since the last release ${lastStable?.tag_name}, on ${DEFAULT_BRANCH}:`}
          </p>
          <ul className="space-y-1 text-sm">
            {unreleasedCommits.map((c) => (
              <li key={c.sha} className="pl-4 relative before:content-['•'] before:absolute before:left-1 before:text-muted-foreground">
                <a href={c.html_url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
                  {c.commit.message.split("\n")[0]}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="space-y-4">
        {data?.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h2 className="text-lg font-semibold inline-flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />{r.name || r.tag_name}
                  {r.tag_name === __APP_VERSION__ && <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary">{sk ? "aktuálna" : "current"}</span>}
                  {r.prerelease && <span className="text-[10px] uppercase px-2 py-0.5 rounded-full bg-accent/15 text-accent">pre-release</span>}
                </h2>
                <div className="text-xs text-muted-foreground">
                  {r.tag_name}{r.published_at && ` · ${new Date(r.published_at).toLocaleDateString(lang)}`}
                </div>
              </div>
              <a href={r.html_url} target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            {r.body ? <Markdown text={r.body} /> : null}
          </Card>
        ))}
      </div>
    </main>
  );
}
