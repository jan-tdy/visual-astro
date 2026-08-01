import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, fail } from "../helpers";
import { dateToJD } from "@/lib/astro";
import { jdToDate } from "@/lib/pozor";

export default defineTool({
  name: "jd_convert",
  title: "Julian Date converter",
  description: "Convert a UTC date/time to Julian Date, or a Julian Date back to UTC.",
  inputSchema: {
    jd: z.number().optional().describe("Julian Date to convert to UTC."),
    datetime_utc: z.string().trim().optional().describe("UTC ISO date/time to convert to Julian Date."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ jd, datetime_utc }) => {
    if (typeof jd === "number") {
      const d = jdToDate(jd);
      return ok({ jd, datetime_utc: d.toISOString() }, { jd, datetime_utc: d.toISOString() });
    }
    if (datetime_utc) {
      const d = new Date(datetime_utc);
      if (Number.isNaN(d.getTime())) return fail("Invalid datetime_utc.");
      const value = dateToJD(d);
      return ok({ jd: value, datetime_utc: d.toISOString() }, { jd: value, datetime_utc: d.toISOString() });
    }
    return fail("Provide jd or datetime_utc.");
  },
});