import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { unauthenticated, supabaseForUser } from "../supabase";
import { fail } from "../helpers";
import { buildAAVSOFromSIPS, buildVSNETFromSIPS, parseSIPS } from "../../sips";

export default defineTool({
  name: "convert_sips",
  title: "Convert SIPS Standard to VSNET/AAVSO",
  description:
    "Convert a SIPS Standard photometry file (JD, magnitude, error, with optional '#' header lines) into VSNET or AAVSO Extended CCD format.",
  inputSchema: {
    data: z.string().min(1).describe("Raw SIPS Standard file content."),
    format: z.enum(["vsnet", "aavso"]).describe("Output format."),
    star_code: z.string().trim().min(1).max(40).describe("VSNET code or AAVSO designation of the star."),
    obs_code: z.string().trim().max(10).optional().describe("Observer code; defaults to the profile setting."),
    filter: z.string().trim().max(20).optional().describe("Override the filter detected in the file header."),
    chart_id: z.string().trim().max(40).optional().describe("AAVSO chart id (AAVSO format only)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ data, format, star_code, obs_code, filter, chart_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const parsed = parseSIPS(data);
    if (parsed.rows.length === 0) return fail(`No usable rows. ${parsed.errors.slice(0, 5).join("; ")}`);
    let code = obs_code?.trim();
    if (!code) {
      const supabase = supabaseForUser(ctx);
      const { data: profile } = await supabase.from("profiles").select("obs_code").maybeSingle();
      code = profile?.obs_code ?? "DPV";
    }
    const filt = filter?.trim() || parsed.filter;
    const text =
      format === "vsnet"
        ? buildVSNETFromSIPS(parsed.rows, star_code, code, filt)
        : buildAAVSOFromSIPS(parsed.rows, star_code, code, filt, chart_id ?? "");
    return {
      content: [{ type: "text" as const, text }],
      structuredContent: {
        format,
        rows: parsed.rows.length,
        detectedStar: parsed.varName,
        filter: filt,
        warnings: parsed.errors,
        text,
      },
    };
  },
});