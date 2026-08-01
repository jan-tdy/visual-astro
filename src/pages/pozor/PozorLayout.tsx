import { Outlet } from "react-router-dom";
import { AppHeader } from "@/components/app/AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { CatalogSwitcher } from "@/components/pozor/CatalogSwitcher";
import {
  useCcdCatalogs, useCcdTargets, usePozorLocations, usePozorSettings,
  type CcdTarget, type PozorLocationRow, type PozorSettings,
} from "@/components/pozor/shared";

export interface PozorOutletContext {
  targets: CcdTarget[];
  targetsLoading: boolean;
  reloadTargets: () => void;
  catalogId: string;
  catalogName: string;
  isOwnCatalog: boolean;
  setCatalogId: (id: string) => void;
  reloadCatalogs: () => void;
  settings: PozorSettings;
  setSettings: (s: PozorSettings) => void;
  locations: PozorLocationRow[];
}

export default function PozorLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const {
    catalogs,
    loading: catalogsLoading,
    reload: reloadCatalogs,
    activeId: catalogId,
    setActiveId: setCatalogId,
  } = useCcdCatalogs();
  const { targets, loading: targetsLoading, reload: reloadTargets } = useCcdTargets(catalogId);
  const { settings, setSettings } = usePozorSettings();
  const { locations } = usePozorLocations();
  const activeCatalog = catalogs.find((c) => c.id === catalogId);
  const isOwnCatalog = !activeCatalog || activeCatalog.user_id === user?.id;

  const context: PozorOutletContext = {
    targets,
    targetsLoading,
    reloadTargets,
    catalogId,
    catalogName: activeCatalog?.name ?? "",
    isOwnCatalog,
    setCatalogId,
    reloadCatalogs,
    settings,
    setSettings,
    locations,
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{t("nav.pozor")}</h1>
            <p className="text-sm text-muted-foreground">{t("pozor.subtitle")}</p>
          </div>
          <CatalogSwitcher
            catalogs={catalogs}
            activeId={catalogId}
            setActiveId={setCatalogId}
            loading={catalogsLoading}
            reload={reloadCatalogs}
            isOwnCatalog={isOwnCatalog}
          />
        </header>
        <Outlet context={context} />
      </main>
    </div>
  );
}
