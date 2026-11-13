import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { supabase } from "@/integrations/supabase/client";

/** A few fictional "stars" that resolve to a joke chart id instead of hitting the database. */
const CHART_ID_EASTER_EGGS: Record<string, string> = {
  NIBIRU: "42",
  "PLANET X": "42",
  AREA51: "TOP-SECRET",
  ROSWELL: "UFO-001",
  DEATHSTAR: "THATS-NOT-A-MOON",
  ALDERAAN: "WE-WERE-TOO-LATE",
  WOLF359: "RESISTANCE-IS-FUTILE",
  STORAGEHACK: "Congratulations! You are eligible to increase your storage from 400000KB to 400001KB for free! Contact us with code easteregg0001",
};

export type CatalogField = "chart_id" | "aavso_code" | "vsnet_code";

/** Look up a star's chart_id/aavso_code/vsnet_code in the catalog by AAVSO code, VSNET code, or name (case-insensitive). */
export async function fetchCatalogStarMatches(code: string, field: CatalogField): Promise<{ value: string | null }[] | null> {
  if (field === "chart_id") {
    const egg = CHART_ID_EASTER_EGGS[code.trim().toUpperCase()];
    if (egg) return [{ value: egg }];
  }
  if (/[,()]/.test(code)) return []; // would break the .or() filter syntax below
  // Anonymous visitors have no catalog of their own (stars are private per observer), so skip the lookup.
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) return null;
  const { data } = await supabase
    .from("stars")
    .select(field)
    .or(`aavso_code.ilike.${code},vsnet_code.ilike.${code},name.ilike.${code}`)
    .limit(2);
  return (data ?? []).map((row) => ({ value: (row as Record<CatalogField, string | null>)[field] }));
}

export type ChartLookupStatus = "idle" | "found" | "not_found" | "ambiguous";

/**
 * Debounced auto-fill of a field from the star catalog, keyed off some other code
 * typed by the observer (AAVSO code, VSNET code, or name). Only touches the field
 * while it still holds our own previous auto-fill — once the observer edits it by
 * hand, further catalog lookups leave it alone. Also reports whether the lookup
 * found nothing or more than one match, so the caller can warn the field won't be
 * filled in automatically.
 */
export function useCatalogAutoFill(
  code: string,
  field: CatalogField,
  value: string,
  setValue: (v: string) => void,
): ChartLookupStatus {
  const valueRef = useRef(value);
  const autoFilledRef = useRef("");
  const [status, setStatus] = useState<ChartLookupStatus>("idle");
  valueRef.current = value;

  useEffect(() => {
    const trimmed = code.trim();
    if (!trimmed) {
      setStatus("idle");
      return;
    }
    const handle = setTimeout(async () => {
      const current = valueRef.current.trim();
      if (current && current !== autoFilledRef.current) return;
      const matches = await fetchCatalogStarMatches(trimmed, field);
      if (matches === null) {
        setStatus("idle");
        return;
      }
      if (matches.length > 1) {
        autoFilledRef.current = "";
        if (current) setValue("");
        setStatus("ambiguous");
        return;
      }
      const found = matches[0]?.value?.trim() || null;
      autoFilledRef.current = found ?? "";
      if (found || current) setValue(found ?? "");
      setStatus(found ? "found" : "not_found");
    }, 400);
    return () => clearTimeout(handle);
  }, [code, field, setValue]);

  return status;
}

/** Real AAVSO chart ids are short (e.g. "X15932DAB"); anything way past this is a mistake (or an easter egg). */
export const CHART_ID_MAX_LEN = 40;

export function ChartLookupWarning({ chartId, status }: { chartId: string; status: ChartLookupStatus }) {
  const { t } = useI18n();
  if (chartId.trim().length > CHART_ID_MAX_LEN) {
    return <p className="text-xs text-destructive font-semibold">{t("tools.chart.tooLong")}</p>;
  }
  if (status !== "not_found" && status !== "ambiguous") return null;
  return (
    <p className="text-xs text-destructive">
      {t(status === "not_found" ? "tools.chart.notFound" : "tools.chart.ambiguous")}
    </p>
  );
}

/** Same idea as {@link ChartLookupWarning}, for a catalog lookup that fills in a star
 *  code (VSNET or AAVSO) rather than a chart id. */
export function StarLookupWarning({ status }: { status: ChartLookupStatus }) {
  const { t } = useI18n();
  if (status !== "not_found" && status !== "ambiguous") return null;
  return (
    <p className="text-xs text-destructive">
      {t(status === "not_found" ? "tools.starLookup.notFound" : "tools.starLookup.ambiguous")}
    </p>
  );
}
