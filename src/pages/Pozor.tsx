import { AppHeader } from "@/components/app/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { CcdCatalog } from "@/components/pozor/CcdCatalog";
import { CatalogSwitcher } from "@/components/pozor/CatalogSwitcher";
import { NightChart } from "@/components/pozor/NightChart";
import { Journal } from "@/components/pozor/Journal";
import { Minima } from "@/components/pozor/Minima";
import { InstantInfo } from "@/components/pozor/InstantInfo";
import { useCcdCatalogs, useCcdTargets, usePozorSettings } from "@/components/pozor/shared";

export default function Pozor() {
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
  const activeCatalog = catalogs.find((c) => c.id === catalogId);
  const isOwnCatalog = !activeCatalog || activeCatalog.user_id === user?.id;

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
        <Tabs defaultValue="chart">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="chart">{t("pozor.tab.chart")}</TabsTrigger>
            <TabsTrigger value="journal">{t("pozor.tab.journal")}</TabsTrigger>
            <TabsTrigger value="minima">{t("pozor.tab.minima")}</TabsTrigger>
            <TabsTrigger value="instant">{t("pozor.tab.instant")}</TabsTrigger>
            <TabsTrigger value="catalog">{t("pozor.tab.catalog")}</TabsTrigger>
          </TabsList>
          <TabsContent value="chart" className="mt-4">
            <NightChart targets={targets} settings={settings} setSettings={setSettings} />
          </TabsContent>
          <TabsContent value="journal" className="mt-4">
            <Journal targets={targets} settings={settings} setSettings={setSettings} />
          </TabsContent>
          <TabsContent value="minima" className="mt-4">
            <Minima targets={targets} settings={settings} setSettings={setSettings} />
          </TabsContent>
          <TabsContent value="instant" className="mt-4">
            <InstantInfo targets={targets} settings={settings} setSettings={setSettings} />
          </TabsContent>
          <TabsContent value="catalog" className="mt-4">
            <CcdCatalog
              targets={targets}
              loading={targetsLoading}
              reload={reloadTargets}
              catalogId={catalogId}
              catalogName={activeCatalog?.name ?? ""}
              isOwnCatalog={isOwnCatalog}
              setCatalogId={setCatalogId}
              reloadCatalogs={reloadCatalogs}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
