import { useOutletContext } from "react-router-dom";
import { Journal } from "@/components/pozor/Journal";
import type { PozorOutletContext } from "./PozorLayout";

export default function PozorJournalPage() {
  const { targets, settings, setSettings, locations } = useOutletContext<PozorOutletContext>();
  return <Journal targets={targets} settings={settings} setSettings={setSettings} locations={locations} />;
}
