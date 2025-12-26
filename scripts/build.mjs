import fs from "node:fs";
import path from "node:path";

const siteDir = path.join(process.cwd(), "site");
if (!fs.existsSync(siteDir)) {
  console.error("❌ site/ papka topilmadi.");
  process.exit(2);
}
console.log("✅ Static site: build shart emas. Netlify uchun build OK.");
