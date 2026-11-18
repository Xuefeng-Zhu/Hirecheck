import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getReport, listReports } from "../server/lib/hirecheck/store";

export default defineAction({
  description:
    "Read a saved HireCheck report by id (verdict, findings with quotes, research trace). Without an id, list recent reports.",
  http: { method: "GET" },
  schema: z.object({
    id: z.string().optional().describe("Report id from check-contractor; omit to list the 20 most recent reports"),
  }),
  run: async ({ id }) => {
    if (!id) return { reports: listReports() };
    const report = getReport(id);
    if (!report) throw new Error(`No report with id ${id}`);
    return { id, ...report };
  },
});
