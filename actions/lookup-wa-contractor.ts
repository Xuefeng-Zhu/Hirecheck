import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { findBonds, findInsurance, findLicenses } from "../server/lib/hirecheck/wa-records";

export default defineAction({
  description:
    "Look up official Washington L&I contractor records on data.wa.gov: license status and dates, surety bonds, and liability insurance. " +
    "Search by license number, or by business name (optionally city). Returns raw records with their source URLs.",
  http: { method: "GET" },
  schema: z.object({
    name: z.string().optional().describe("Business name to search, e.g. 'Evergreen Roofing'"),
    city: z.string().optional().describe("City to narrow name matches"),
    licenseNumber: z.string().optional().describe("Exact WA L&I license number; when set, bond and insurance are included"),
  }),
  run: async ({ name, city, licenseNumber }) => {
    if (!name && !licenseNumber) throw new Error("Give a business name or a license number");
    const lic = await findLicenses({ name: name || "", city, licenseNumber });
    const out: Record<string, unknown> = { licenses: lic.rows.slice(0, 10), licenseSource: lic.url };
    const single = licenseNumber || (new Set(lic.rows.map((r) => r.contractorlicensenumber)).size === 1 ? lic.rows[0]?.contractorlicensenumber : undefined);
    if (single) {
      const [b, i] = await Promise.all([findBonds(single), findInsurance(single)]);
      Object.assign(out, { bonds: b.rows, bondSource: b.url, insurance: i.rows, insuranceSource: i.url });
    }
    return out;
  },
});
