import { useOutletContext } from "react-router-dom";
import { NightChart } from "@/components/pozor/NightChart";
import type { PozorOutletContext } from "./PozorLayout";

export default function PozorChartPage() {
  const { targets, settings, setSettings, locations } = useOutletContext<PozorOutletContext>();
  return <NightChart targets={targets} settings={settings} setSettings={setSettings} locations={locations} />;
}
