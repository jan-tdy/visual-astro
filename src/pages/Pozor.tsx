import { Lock } from "lucide-react";
import { AppHeader } from "@/components/app/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { useSubscription } from "@/hooks/useSubscription";
import { CatalogSwitcher } from "@/components/pozor/CatalogSwitcher";
import { CcdCatalog } from "@/components/pozor/CcdCatalog";
import { NightChart } from "@/components/pozor/NightChart";
import { Journal } from "@/components/pozor/Journal";
import { Minima } from "@/components/pozor/Minima";
import { InstantInfo } from "@/components/pozor/InstantInfo";
import {
  useCcdCatalogs, useCcdTargets, usePozorLocations, usePozorSettings,
} from "@/components/pozor/shared";

export default function Pozor() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { isPlusActive } = useSubscription();
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
  const ownCatalogsCount = catalogs.filter((c) => c.user_id === user?.id).length;

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
            <TabsTrigger value="minima" className="gap-1.5">
              {t("pozor.tab.minima")}
              {!isPlusActive && <Lock className="h-3 w-3 opacity-60" />}
            </TabsTrigger>
            <TabsTrigger value="instant">{t("pozor.tab.instant")}</TabsTrigger>
            <TabsTrigger value="catalog">{t("pozor.catalog")}</TabsTrigger>
          </TabsList>
          <TabsContent value="chart" className="mt-4">
            <NightChart targets={targets} settings={settings} setSettings={setSettings} locations={locations} />
          </TabsContent>
          <TabsContent value="journal" className="mt-4">
            <Journal targets={targets} settings={settings} setSettings={setSettings} locations={locations} />
          </TabsContent>
          <TabsContent value="minima" className="mt-4">
            {isPlusActive ? (
              <Minima targets={targets} settings={settings} setSettings={setSettings} locations={locations} />
            ) : (
              <Card className="p-6 flex flex-col items-center text-center gap-3 py-12">
                <div className="inline-flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 text-primary">
                  <Lock className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-semibold">{t("pozor.minima.plusTitle")}</h2>
                <p className="text-sm text-muted-foreground max-w-md">{t("pozor.minima.plusDesc")}</p>
                <Button asChild>
                  <Link to="/settings">{t("pozor.minima.plusCta")}</Link>
                </Button>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="instant" className="mt-4">
            <InstantInfo targets={targets} settings={settings} setSettings={setSettings} locations={locations} />
          </TabsContent>
          <TabsContent value="catalog" className="mt-4">
            <CcdCatalog
              targets={targets}
              loading={targetsLoading}
              reload={reloadTargets}
              catalogId={catalogId}
              catalogName={activeCatalog?.name ?? ""}
              isOwnCatalog={isOwnCatalog}
              ownCatalogsCount={ownCatalogsCount}
              setCatalogId={setCatalogId}
              reloadCatalogs={reloadCatalogs}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
