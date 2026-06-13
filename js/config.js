// ─────────────────────────────────────────────────────────────────────────────
// Supabase configuration
//
// This is the PUBLIC "anon" key. It is designed to be shipped in client-side
// code and is safe to commit. It only identifies the project — it does NOT
// grant write access.
//
// Real access control is enforced server-side by Supabase Row Level Security
// (RLS) policies:
//   • Anonymous visitors  → can only READ rows where active = true
//   • Authenticated admin → can INSERT / UPDATE / DELETE (requires login)
//
// Even if someone copies this key they cannot change anything without valid
// admin credentials (email + password from admin.html login).
// ─────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://khjjtkpyvlohkuwiebzz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_R4NypCMgwbZZmNj1PGeHIw_e4apmsxD';
