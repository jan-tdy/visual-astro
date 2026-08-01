import { useOutletContext } from "react-router-dom";
import { InstantInfo } from "@/components/pozor/InstantInfo";
import type { PozorOutletContext } from "./PozorLayout";

export default function PozorInstantPage() {
  const { targets, settings, setSettings } = useOutletContext<PozorOutletContext>();
  return <InstantInfo targets={targets} settings={settings} setSettings={setSettings} />;
}
