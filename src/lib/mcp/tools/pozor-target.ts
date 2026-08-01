import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export interface ResolvedTarget {
  name: string;
  raHours: number;
  decDeg: number;
  epochJd: number | null;
  periodDays: number | null;
}

/** Resolve a POZOR target either from the CCD catalog (by id or name) or from explicit coordinates. */
export async function resolveTarget(
  ctx: ToolContext,
  input: {
    target_id?: string;
    target_name?: string;
    ra_hours?: number;
    dec_deg?: number;
    epoch_jd?: number;
    period_days?: number;
  },
): Promise<{ target?: ResolvedTarget; error?: string }> {
  if (typeof input.ra_hours === "number" && typeof input.dec_deg === "number") {
    return {
      target: {
        name: input.target_name ?? "custom",
        raHours: input.ra_hours,
        decDeg: input.dec_deg,
        epochJd: input.epoch_jd ?? null,
        periodDays: input.period_days ?? null,
      },
    };
  }
  if (!input.target_id && !input.target_name) {
    return { error: "Provide target_id, target_name, or ra_hours + dec_deg." };
  }
  const supabase = supabaseForUser(ctx);
  let query = supabase.from("ccd_targets").select("id,name,ra_hours,dec_deg,epoch_jd,period_days").limit(5);
  query = input.target_id ? query.eq("id", input.target_id) : query.ilike("name", `%${input.target_name}%`);
  const { data, error } = await query;
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "CCD target not found." };
  if (data.length > 1) return { error: `Ambiguous target: ${data.map((d) => d.name).join(", ")}` };
  const row = data[0];
  return {
    target: {
      name: row.name,
      raHours: Number(row.ra_hours),
      decDeg: Number(row.dec_deg),
      epochJd: input.epoch_jd ?? (row.epoch_jd != null ? Number(row.epoch_jd) : null),
      periodDays: input.period_days ?? (row.period_days != null ? Number(row.period_days) : null),
    },
  };
}