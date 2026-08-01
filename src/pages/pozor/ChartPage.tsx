import { useOutletContext } from "react-router-dom";
import { NightChart } from "@/components/pozor/NightChart";
import type { PozorOutletContext } from "./PozorLayout";

export default function PozorChartPage() {
  const { targets, settings, setSettings } = useOutletContext<PozorOutletContext>();
  return <NightChart targets={targets} settings={settings} setSettings={setSettings} />;
}
