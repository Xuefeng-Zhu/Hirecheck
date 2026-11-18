// CLI: pnpm tsx scripts/hirecheck.ts "Business Name" [city] [license#]
import { runHireCheck } from "../server/lib/hirecheck/pipeline";

const [name, city, licenseNumber] = process.argv.slice(2);
if (!name) {
  console.error('usage: tsx scripts/hirecheck.ts "Business Name" [city] [licenseNumber]');
  process.exit(1);
}

const report = await runHireCheck(
  { name, city: city || undefined, licenseNumber: licenseNumber || undefined, state: "WA" },
  (s) => console.error(`  [${s.step}] ${s.detail} (${s.ms} ms)`),
);
console.log(JSON.stringify(report, null, 2));
