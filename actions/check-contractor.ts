import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { runHireCheck } from "../server/lib/hirecheck/pipeline";
import { saveReport } from "../server/lib/hirecheck/store";

export default defineAction({
  description:
    "Vet a home contractor before hiring: checks official WA L&I license, bond and insurance records, then researches complaints, " +
    "lawsuits/liens and reviews with Tavily, verifies every quote word for word, and returns a verdict (hire, caution, avoid, cant_tell) " +
    "with cited findings. Takes 30-90 seconds. Returns the report and its id.",
  searchHints: ["vet contractor", "is this contractor legit", "contractor license check", "hire check"],
  deferLoading: false,
  schema: z.object({
    name: z.string().min(2).describe("Contractor business name as the homeowner knows it, e.g. 'Evergreen Roofing'"),
    city: z.string().optional().describe("City where the contractor is based or the job is, e.g. 'Redmond'"),
    state: z.string().default("WA").describe("Two-letter US state; only WA has official record lookups. Defaults to WA."),
    trade: z.string().optional().describe("Kind of work, e.g. 'roofing', 'kitchen remodel'"),
    licenseNumber: z.string().optional().describe("WA L&I contractor license number if known, e.g. 'EVERGRL123AB'"),
  }),
  run: async (input) => {
    const report = await runHireCheck(input);
    const id = saveReport(report);
    return { id, url: `/check/${id}`, ...report };
  },
});
