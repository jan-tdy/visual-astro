import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSessionsTool from "./tools/list-sessions";
import listObservationsTool from "./tools/list-observations";
import listStarsTool from "./tools/list-stars";
import listCcdTargetsTool from "./tools/list-ccd-targets";
import createSessionTool from "./tools/create-session";
import getSessionTool from "./tools/get-session";
import updateSessionTool from "./tools/update-session";
import deleteSessionTool from "./tools/delete-session";
import addObservationTool from "./tools/add-observation";
import updateObservationTool from "./tools/update-observation";
import deleteObservationTool from "./tools/delete-observation";
import exportSessionTool from "./tools/export-session";
import createStarTool from "./tools/create-star";
import updateStarTool from "./tools/update-star";
import deleteStarTool from "./tools/delete-star";
import listCcdCatalogsTool from "./tools/list-ccd-catalogs";
import createCcdTargetTool from "./tools/create-ccd-target";
import updateCcdTargetTool from "./tools/update-ccd-target";
import deleteCcdTargetTool from "./tools/delete-ccd-target";
import pozorNightTool from "./tools/pozor-night";
import pozorInstantTool from "./tools/pozor-instant";
import pozorJournalTool from "./tools/pozor-journal";
import pozorMinimaTool from "./tools/pozor-minima";
import jdConvertTool from "./tools/jd-convert";
import convertSipsTool from "./tools/convert-sips";
import getProfileTool from "./tools/get-profile";
import updateProfileTool from "./tools/update-profile";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "visual-astro",
  title: "Visual Astro",
  version: "0.1.0",
  instructions:
    "Full toolset for Visual Astro, a variable-star observing logbook. Read and edit observing sessions and their observations (with computed Argelander magnitudes), manage the visual star catalog, manage POZOR CCD/photometry catalogs and targets, run POZOR observability computations (night conditions, altitude/airmass at an instant, night-by-night journals, minima predictions), build VSNET/AAVSO exports, convert SIPS Standard photometry files and Julian Dates, and read or update the observer profile. All data is scoped to the signed-in observer.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getProfileTool,
    updateProfileTool,
    listSessionsTool,
    getSessionTool,
    createSessionTool,
    updateSessionTool,
    deleteSessionTool,
    listObservationsTool,
    addObservationTool,
    updateObservationTool,
    deleteObservationTool,
    exportSessionTool,
    listStarsTool,
    createStarTool,
    updateStarTool,
    deleteStarTool,
    listCcdCatalogsTool,
    listCcdTargetsTool,
    createCcdTargetTool,
    updateCcdTargetTool,
    deleteCcdTargetTool,
    pozorNightTool,
    pozorInstantTool,
    pozorJournalTool,
    pozorMinimaTool,
    jdConvertTool,
    convertSipsTool,
  ],
});