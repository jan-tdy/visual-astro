import { supabase } from "@/integrations/supabase/client";
import seedData from "@/data/seed.json";

type SeedStar = {
  name: string;
  constellation: string;
  type: "VISUAL" | "BINAR" | "ECL faint" | "ECL bright";
  vsnet_code: string | null;
  aavso_code: string | null;
  chart_id: string | null;
  sort_order: number;
};
type SeedObs = {
  name: string;
  constellation: string;
  a: string | null;
  pasos_a: number | null;
  pasos_b: number | null;
  b: string | null;
  limit_value: string | null;
  ut_time: string | null;
  note: string | null;
};

export const SEED_CONSTELLATIONS: string[] = (seedData as any).constellations;
export const SEED_STARS: SeedStar[] = (seedData as any).stars;
export const SEED_LAST_SESSION: SeedObs[] = (seedData as any).last_session;

/**
 * Seed the user's catalog and a starting "last session" the first time they log in.
 * Idempotent: relies on profiles.catalog_seeded.
 */
export async function seedCatalogIfNeeded(userId: string): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("catalog_seeded")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.catalog_seeded) return;

  // Insert stars in batches of 100
  const starRows = SEED_STARS.map((s) => ({ ...s, user_id: userId }));
  for (let i = 0; i < starRows.length; i += 100) {
    const chunk = starRows.slice(i, i + 100);
    const { error } = await supabase.from("stars").insert(chunk);
    if (error) throw error;
  }

  // Fetch inserted stars to map name -> id
  const { data: insertedStars, error: fetchErr } = await supabase
    .from("stars")
    .select("id,name,constellation")
    .eq("user_id", userId);
  if (fetchErr) throw fetchErr;
  const idByKey = new Map<string, string>();
  insertedStars?.forEach((s) =>
    idByKey.set(`${s.constellation}::${s.name}`, s.id),
  );

  // Create initial session = "template" from the spreadsheet's last entries
  const { data: session, error: sessErr } = await supabase
    .from("sessions")
    .insert({
      user_id: userId,
      observed_at_utc: new Date().toISOString(),
      notes: "Importované z Reducciones2604.ods",
    })
    .select()
    .single();
  if (sessErr) throw sessErr;

  const obsRows = SEED_LAST_SESSION.map((o) => {
    const sid = idByKey.get(`${o.constellation}::${o.name}`);
    if (!sid) return null;
    return {
      session_id: session.id,
      user_id: userId,
      star_id: sid,
      a: o.a,
      pasos_a: o.pasos_a,
      pasos_b: o.pasos_b,
      b: o.b,
      limit_value: o.limit_value,
      ut_time: o.ut_time,
      note: o.note,
    };
  }).filter(Boolean) as any[];

  for (let i = 0; i < obsRows.length; i += 100) {
    const chunk = obsRows.slice(i, i + 100);
    const { error } = await supabase.from("observations").insert(chunk);
    if (error) throw error;
  }

  await supabase.from("profiles").update({ catalog_seeded: true }).eq("user_id", userId);
}