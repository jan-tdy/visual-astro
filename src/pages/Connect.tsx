import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@/components/app/AppHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/hooks/useI18n";
import {
  Copy,
  Check,
  Bot,
  Terminal,
  ExternalLink,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

function makeSlug(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const slug = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const reserved = new Set([
    "workspace",
    "computer-use",
    "claude-in-chrome",
    "claude-preview",
    "claude-browser",
  ]);
  const base = slug.slice(0, 63) || "lovable-app";
  return reserved.has(base) ? `${base}-app` : base;
}

export default function Connect() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";
  const mcpUrl = `https://${projectRef}.supabase.co/functions/v1/mcp`;
  const appName = "Visual Astro";
  const appSlug = useMemo(() => makeSlug(appName), []);
  const claudeCodeCommand = `claude mcp add --scope user --transport http ${appSlug} '${mcpUrl.replace(/'/g, "'\\''")}'`;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(claudeCodeCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const encodedName = encodeURIComponent(appName);
  const encodedUrl = encodeURIComponent(mcpUrl);
  const claudePrefillUrl = `https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=${encodedName}&connectorUrl=${encodedUrl}`;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="mb-8">
          <Button asChild variant="ghost" size="sm">
            <Link to="/about" className="inline-flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" /> {t("connect.back")}
            </Link>
          </Button>
        </div>

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-3">
            {t("connect.title")}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("connect.subtitle")}
          </p>
        </div>

        <Card className="p-6 mb-8 border-primary/30 bg-primary/5">
          <label className="block text-sm font-medium mb-2">
            {t("connect.urlLabel")}
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              readOnly
              value={mcpUrl}
              className="font-mono text-sm bg-background"
              onFocus={(e) => e.target.select()}
            />
            <Button onClick={copyUrl} className="shrink-0" variant="secondary">
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1.5" /> {t("connect.copied")}
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1.5" /> {t("connect.copy")}
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {t("connect.urlHelp")}
          </p>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">ChatGPT</h2>
            </div>
            <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
              <li>{t("connect.chatgpt.1")}</li>
              <li>
                {t("connect.chatgpt.2")}{" "}
                <a
                  href="https://chatgpt.com/plugins#settings/Connectors?create-connector=true&redirectAfter=%2Fplugins"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  {t("connect.openDialog")} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>{t("connect.chatgpt.3")}</li>
              <li>{t("connect.chatgpt.4")}</li>
              <li>{t("connect.chatgpt.5")}</li>
            </ol>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Claude</h2>
            </div>
            <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
              <li>
                <a
                  href={claudePrefillUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  {t("connect.claude.1")} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>{t("connect.claude.2")}</li>
              <li>{t("connect.claude.3")}</li>
              <li>{t("connect.claude.4")}</li>
            </ol>
          </Card>

          <Card className="p-6 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Claude Code</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {t("connect.claudecode.intro")}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <code className="flex-1 block rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs break-all">
                {claudeCodeCommand}
              </code>
              <Button onClick={copyCommand} variant="secondary" size="sm" className="shrink-0">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1.5" /> {t("connect.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" /> {t("connect.copy")}
                  </>
                )}
              </Button>
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>{t("connect.claudecode.1")}</li>
              <li>{t("connect.claudecode.2")}</li>
              <li>{t("connect.claudecode.3")}</li>
            </ol>
          </Card>

          <Card className="p-6 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">{t("connect.other.title")}</h2>
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>{t("connect.other.1")}</li>
              <li>{t("connect.other.2")}</li>
              <li>{t("connect.other.3")}</li>
              <li>{t("connect.other.4")}</li>
              <li>{t("connect.other.5")}</li>
            </ol>
          </Card>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">{t("connect.refresh.title")}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {t("connect.refresh.intro")}
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">ChatGPT</h3>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>{t("connect.refresh.chatgpt.1")}</li>
                <li>{t("connect.refresh.chatgpt.2")}</li>
                <li>{t("connect.refresh.chatgpt.3")}</li>
                <li>{t("connect.refresh.chatgpt.4")}</li>
              </ol>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Claude / Claude Code</h3>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>{t("connect.refresh.claude.1")}</li>
                <li>{t("connect.refresh.claude.2")}</li>
                <li>{t("connect.refresh.claude.3")}</li>
                <li>{t("connect.refresh.claude.4")}</li>
              </ol>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
