(function () {
  "use strict";

  // Fill these two values from Project Settings > API in Supabase.
  // Use only the anon public key here. Never paste a service_role key into frontend code.
  const SUPABASE_URL = "https://fwxpnuhiutradwwurnnl.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3eHBudWhpdXRyYWR3d3Vybm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTAyMzAsImV4cCI6MjA5Njk4NjIzMH0.5ysSNoWAasKeLC70x5k-Kq9PtVUY0BRoB6kmetIEC58";

  const hasConfig =
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("PASTE_") &&
    !SUPABASE_ANON_KEY.includes("PASTE_");

  const hasLibrary =
    window.supabase &&
    typeof window.supabase.createClient === "function";

  const client = hasConfig && hasLibrary
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        },
        realtime: {
          params: {
            eventsPerSecond: 0
          }
        }
      })
    : null;

  window.OwlStudySupabase = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    client,
    isConfigured: Boolean(client),
    missingReason: !hasLibrary
      ? "Supabase JS library is not loaded."
      : !hasConfig
        ? "Supabase URL or anon key is not configured."
        : ""
  };
})();
