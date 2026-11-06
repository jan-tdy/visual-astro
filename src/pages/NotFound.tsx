import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useI18n } from "@/hooks/useI18n";

const NotFound = () => {
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="w-full max-w-xs rounded-lg border bg-background shadow-lg">
        <div className="border-b px-4 py-2 text-sm font-semibold">{t("notfound.title")}</div>
        <div className="space-y-4 px-4 py-6 text-center">
          <p className="text-lg">{t("notfound.easteregg")}</p>
          <a
            href="/"
            className="inline-block rounded border px-6 py-1.5 text-sm font-medium hover:bg-muted"
          >
            OK
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
