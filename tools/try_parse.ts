// Prints how the rule parser reads each brief given on the command line.
//   npx tsx scripts/try_parse.ts "beauty creators under $5k a reel" "women over 30"
import { parseWithRules } from "../src/lib/parse";

for (const brief of process.argv.slice(2)) {
  const parsed = parseWithRules(brief);
  const set = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length)));
  console.log(brief, "=>", JSON.stringify(set));
}
