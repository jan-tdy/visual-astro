import { AppHeader } from "@/components/app/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/hooks/useI18n";
import { CcdCatalog } from "@/components/pozor/CcdCatalog";
import { NightChart } from "@/components/pozor/NightChart";
import { Journal } from "@/components/pozor/Journal";
import { Minima } from "@/components/pozor/Minima";
import { InstantInfo } from "@/components/pozor/InstantInfo";
import { JdTab } from "@/components/pozor/JdTab";
import { useCcdTargets, usePozorSettings } from "@/components/pozor/shared";

export default function Pozor() {
  const { t } = useI18n();
  const { targets } = useCcdTargets();
  const [settings, setSettings] = usePozorSettings();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">POZOR</h1>
          <p className="text-sm text-muted-foreground">{t("pozor.subtitle")}</p>
        </header>
        <Tabs defaultValue="chart">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="chart">{t("pozor.tab.chart")}</TabsTrigger>
            <TabsTrigger value="journal">{t("pozor.tab.journal")}</TabsTrigger>
            <TabsTrigger value="minima">{t("pozor.tab.minima")}</TabsTrigger>
            <TabsTrigger value="instant">{t("pozor.tab.instant")}</TabsTrigger>
            <TabsTrigger value="jd">{t("pozor.tab.jd")}</TabsTrigger>
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
          <TabsContent value="jd" className="mt-4">
            <JdTab />
          </TabsContent>
          <TabsContent value="catalog" className="mt-4">
            <CcdCatalog />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
