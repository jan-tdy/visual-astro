import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSessionsTool from "./tools/list-sessions";
import listObservationsTool from "./tools/list-observations";
import listStarsTool from "./tools/list-stars";
import listCcdTargetsTool from "./tools/list-ccd-targets";
import createSessionTool from "./tools/create-session";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "visual-astro",
  title: "Visual Astro",
  version: "0.1.0",
  instructions:
    "Tools for Visual Astro, a variable-star observing logbook. Read observing sessions and their observations, browse the visual star catalog and POZOR CCD targets, and create new sessions. All data is scoped to the signed-in observer.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSessionsTool, listObservationsTool, listStarsTool, listCcdTargetsTool, createSessionTool],
});