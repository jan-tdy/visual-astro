import { useOutletContext } from "react-router-dom";
import { Minima } from "@/components/pozor/Minima";
import type { PozorOutletContext } from "./PozorLayout";

export default function PozorMinimaPage() {
  const { targets, settings, setSettings, locations } = useOutletContext<PozorOutletContext>();
  return <Minima targets={targets} settings={settings} setSettings={setSettings} locations={locations} />;
}
