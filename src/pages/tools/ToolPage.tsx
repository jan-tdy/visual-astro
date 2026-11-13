import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useI18n } from "@/hooks/useI18n";
import { getTool } from "@/lib/tools/registry";

export default function ToolPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useI18n();
  const tool = getTool(slug);

  if (!tool) return <Navigate to="/tools" replace />;

  const { Component } = tool;

  return (
    <AppShell>
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("nav.tools")}
        </Link>
        <Component />
      </div>
    </AppShell>
  );
}
