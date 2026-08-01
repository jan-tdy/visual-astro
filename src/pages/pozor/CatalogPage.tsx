import { useOutletContext } from "react-router-dom";
import { CcdCatalog } from "@/components/pozor/CcdCatalog";
import type { PozorOutletContext } from "./PozorLayout";

export default function PozorCatalogPage() {
  const {
    targets, targetsLoading, reloadTargets, catalogId, catalogName,
    isOwnCatalog, setCatalogId, reloadCatalogs,
  } = useOutletContext<PozorOutletContext>();
  return (
    <CcdCatalog
      targets={targets}
      loading={targetsLoading}
      reload={reloadTargets}
      catalogId={catalogId}
      catalogName={catalogName}
      isOwnCatalog={isOwnCatalog}
      setCatalogId={setCatalogId}
      reloadCatalogs={reloadCatalogs}
    />
  );
}
