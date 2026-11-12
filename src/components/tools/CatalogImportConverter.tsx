import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/hooks/useI18n";
import { downloadText } from "@/lib/exporters";
import {
  splitLine,
  detectDelimiter,
  guessRole,
  guessCoordFormat,
  convertCatalogRows,
  buildCatalogCsv,
  type ColumnMapping,
  type ColumnRole,
  type CoordFormat,
  type Delimiter,
} from "@/lib/catalogImport";

const SAMPLE = "name,ra,dec\nM31,00:42:44,+41:16:09\nM42,05:35:17,-05:23:28\nT CrB,15:59:30,+25:55:13";

const ROLE_OPTIONS: ColumnRole[] = ["ignore", "name", "ra", "dec", "type", "note"];

export function CatalogImportConverter() {
  const { t } = useI18n();
  const [rawInput, setRawInput] = useState("");
  const [delimiter, setDelimiter] = useState<Delimiter>("auto");
  const [hasHeader, setHasHeader] = useState(true);
  const [appendIgnored, setAppendIgnored] = useState(false);
  const [mapping, setMapping] = useState<Record<number, ColumnMapping> | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    const lines = rawInput.split(/\r\n|\r|\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return null;
    const delim = delimiter === "auto" ? detectDelimiter(lines) : delimiter;
    const rows = lines.map((l) => splitLine(l, delim));
    const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const header = hasHeader ? rows[0] : [];
    const dataRows = hasHeader ? rows.slice(1) : rows;
    return { header, dataRows, colCount };
  }, [rawInput, delimiter, hasHeader]);

  // Reset the column mapping whenever the shape of the parsed data changes, pre-filling
  // each column with a guessed role/format from its header text and first data row.
  const effectiveMapping = useMemo(() => {
    if (!parsed) return null;
    if (mapping) return mapping;
    const sampleRow = parsed.dataRows[0] || [];
    const guessed: Record<number, ColumnMapping> = {};
    for (let i = 0; i < parsed.colCount; i++) {
      const role = guessRole(parsed.header[i] || "", i, parsed.colCount);
      const format: CoordFormat | undefined =
        role === "ra" || role === "dec" ? guessCoordFormat(sampleRow[i] || "") : undefined;
      guessed[i] = { role, format };
    }
    return guessed;
  }, [parsed, mapping]);

  const result = useMemo(() => {
    if (!parsed || !effectiveMapping) return null;
    return convertCatalogRows(parsed.dataRows, effectiveMapping, appendIgnored);
  }, [parsed, effectiveMapping, appendIgnored]);

  const csv = result ? buildCatalogCsv(result.rows) : "";

  const setColumnRole = (col: number, role: ColumnRole) => {
    if (!effectiveMapping) return;
    const next = { ...effectiveMapping, [col]: { ...effectiveMapping[col], role } };
    setMapping(next);
  };
  const setColumnFormat = (col: number, format: CoordFormat) => {
    if (!effectiveMapping) return;
    setMapping({ ...effectiveMapping, [col]: { ...effectiveMapping[col], format } });
  };

  const loadFile = async (f: File | null) => {
    if (!f) return;
    setRawInput(await f.text());
    setMapping(null);
  };

  const loadSample = () => {
    setRawInput(SAMPLE);
    setDelimiter("comma");
    setHasHeader(true);
    setMapping(null);
  };

  const download = () => downloadText("japyscope-catalog-import.csv", csv);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const sampleRow = parsed?.dataRows[0] || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("tools.catalogImport.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("tools.catalogImport.desc")}</p>

        <div className="space-y-1">
          <Label className="text-xs">{t("tools.paste")}</Label>
          <Textarea
            value={rawInput}
            onChange={(e) => { setRawInput(e.target.value); setMapping(null); }}
            rows={6}
            placeholder={"name,ra,dec\nM31,00:42:44,+41:16:09"}
            className="font-mono text-xs"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.catalogImport.file")}</Label>
            <Input ref={fileInputRef} type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => void loadFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("tools.catalogImport.delimiter")}</Label>
            <Select value={delimiter} onValueChange={(v) => { setDelimiter(v as Delimiter); setMapping(null); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t("tools.catalogImport.delimiter.auto")}</SelectItem>
                <SelectItem value="comma">{t("tools.catalogImport.delimiter.comma")}</SelectItem>
                <SelectItem value="tab">{t("tools.catalogImport.delimiter.tab")}</SelectItem>
                <SelectItem value="semicolon">{t("tools.catalogImport.delimiter.semicolon")}</SelectItem>
                <SelectItem value="ws">{t("tools.catalogImport.delimiter.ws")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm font-normal">
              <input type="checkbox" checked={hasHeader} onChange={(e) => { setHasHeader(e.target.checked); setMapping(null); }} />
              {t("tools.catalogImport.hasHeader")}
            </label>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={loadSample}>{t("tools.catalogImport.loadSample")}</Button>

        {parsed && effectiveMapping && (
          <div className="space-y-3 pt-2 border-t">
            <h3 className="font-medium text-sm">{t("tools.catalogImport.mapping")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: parsed.colCount }, (_, i) => {
                const headerText = parsed.header[i] || "";
                const role = effectiveMapping[i]?.role ?? "ignore";
                const format = effectiveMapping[i]?.format;
                return (
                  <div key={i} className="border rounded-md p-2 space-y-1">
                    <Label className="text-xs">{headerText ? `"${headerText}"` : `${t("tools.catalogImport.column")} ${i + 1}`}</Label>
                    <p className="text-xs text-muted-foreground truncate">{t("tools.catalogImport.example")}: {sampleRow[i] || "—"}</p>
                    <Select value={role} onValueChange={(v) => setColumnRole(i, v as ColumnRole)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{t(`tools.catalogImport.role.${r}`)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {(role === "ra" || role === "dec") && (
                      <Select value={format ?? "sex"} onValueChange={(v) => setColumnFormat(i, v as CoordFormat)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sex">{t(role === "ra" ? "tools.catalogImport.format.raSex" : "tools.catalogImport.format.decSex")}</SelectItem>
                          <SelectItem value="deg">{t("tools.catalogImport.format.deg")}</SelectItem>
                          {role === "ra" && <SelectItem value="hour">{t("tools.catalogImport.format.hour")}</SelectItem>}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
            </div>

            <label className="flex items-center gap-2 text-sm font-normal">
              <input type="checkbox" checked={appendIgnored} onChange={(e) => setAppendIgnored(e.target.checked)} />
              {t("tools.catalogImport.appendIgnored")}
            </label>
          </div>
        )}

        {result && result.warnings.length > 0 && (
          <div className="text-xs text-destructive space-y-0.5">
            {result.warnings.slice(0, 10).map((w, i) => <div key={i}>{w}</div>)}
            {result.warnings.length > 10 && <div>{t("tools.errors.more", { n: result.warnings.length - 10 })}</div>}
          </div>
        )}

        {result && result.rows.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <h3 className="font-medium text-sm">{t("tools.catalogImport.preview", { n: result.rows.length })}</h3>
            <div className="max-h-56 overflow-y-auto border rounded-md">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50">
                  <tr>
                    <th className="text-left px-2 py-1">{t("tools.catalogImport.col.name")}</th>
                    <th className="text-left px-2 py-1">{t("tools.catalogImport.col.ra")}</th>
                    <th className="text-left px-2 py-1">{t("tools.catalogImport.col.dec")}</th>
                    <th className="text-left px-2 py-1">{t("tools.catalogImport.col.type")}</th>
                    <th className="text-left px-2 py-1">{t("tools.catalogImport.col.note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-1">{r.name}</td>
                      <td className="px-2 py-1 font-mono">{r.ra}</td>
                      <td className="px-2 py-1 font-mono">{r.dec}</td>
                      <td className="px-2 py-1">{r.type}</td>
                      <td className="px-2 py-1 truncate max-w-[120px]">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={download}>{t("tools.catalogImport.download")}</Button>
              <Button variant="outline" onClick={() => void copy()}>
                {copied ? t("tools.catalogImport.copied") : t("tools.catalogImport.copy")}
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("tools.catalogImport.note")}</p>
      </CardContent>
    </Card>
  );
}
