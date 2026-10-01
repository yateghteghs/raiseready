// Grants the admin role to an existing user.
// Usage: npm run db:seed-admin -- you@example.com
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run db:seed-admin -- <email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserId(target) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 1000) return null;
  }
}

const userId = await findUserId(email);
if (!userId) {
  console.error(`No user with email ${email}. Sign up first, then re-run.`);
  process.exit(1);
}

const { error: updateError } = await supabase
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", userId);
if (updateError) throw updateError;

const { error: auditError } = await supabase.from("audit_logs").insert({
  actor_id: null,
  action: "profile.role_changed",
  target_type: "profile",
  target_id: userId,
  metadata: { role: "admin", via: "seed-admin script" },
});
if (auditError) throw auditError;

console.log(`${email} is now an admin.`);
