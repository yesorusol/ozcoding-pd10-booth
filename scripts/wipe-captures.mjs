// scripts/wipe-captures.mjs
//
// One-off cleanup: delete every object in the Supabase `captures`
// bucket. Used to clear test photos before the event. Reads
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) acc[m[1]] = m[2].replace(/^"|"$/g, "");
    return acc;
  }, {});

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "captures";

const { data: files, error: listErr } = await supabase.storage
  .from(BUCKET)
  .list("", { limit: 1000, sortBy: { column: "created_at", order: "asc" } });

if (listErr) {
  console.error("list failed:", listErr.message);
  process.exit(1);
}

if (!files || files.length === 0) {
  console.log("bucket already empty.");
  process.exit(0);
}

console.log(`listing returned ${files.length} files`);
for (const f of files) {
  console.log(`  - ${f.name} (${f.created_at ?? "no-date"})`);
}

const paths = files.map((f) => f.name);
const { data: removed, error: rmErr } = await supabase.storage
  .from(BUCKET)
  .remove(paths);

if (rmErr) {
  console.error("remove failed:", rmErr.message);
  process.exit(1);
}

console.log(`deleted ${removed?.length ?? 0} files.`);
