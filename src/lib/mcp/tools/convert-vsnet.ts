import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { unauthenticated, supabaseForUser } from "../supabase";
import { fail } from "../helpers";
import { buildAAVSOFromVSNET, parseVSNET } from "../../sips";

export default defineTool({
  name: "convert_vsnet",
  title: "Convert VSNET to AAVSO",
  description:
    "Convert a VSNET-format observation file ('CODE YYYYMMDD.DDD MAG OBSCODE [FILTER]' per line, magnitude may be prefixed with '<' for fainter-than) into AAVSO Extended CCD format.",
  inputSchema: {
    data: z.string().min(1).describe("Raw VSNET-format file content."),
    aavso_code: z.string().trim().min(1).max(40).describe("AAVSO designation of the star."),
    obs_code: z.string().trim().max(10).optional().describe("Observer code; defaults to the profile setting."),
    chart_id: z.string().trim().max(40).optional().describe("AAVSO chart id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ data, aavso_code, obs_code, chart_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const parsed = parseVSNET(data);
    if (parsed.rows.length === 0) return fail(`No usable rows. ${parsed.errors.slice(0, 5).join("; ")}`);
    let code = obs_code?.trim();
    if (!code) {
      const supabase = supabaseForUser(ctx);
      const { data: profile } = await supabase.from("profiles").select("obs_code").maybeSingle();
      code = profile?.obs_code ?? "DPV";
    }
    const text = buildAAVSOFromVSNET(parsed.rows, aavso_code, code, chart_id ?? "");
    return {
      content: [{ type: "text" as const, text }],
      structuredContent: {
        rows: parsed.rows.length,
        warnings: parsed.errors,
        text,
      },
    };
  },
});
