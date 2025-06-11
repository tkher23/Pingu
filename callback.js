const SUPABASE_URL = "https://ishnglghmfijbgtuhxzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaG5nbGdobWZpamJndHVoeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0Nzk5ODIsImV4cCI6MjA2NDA1NTk4Mn0.WmapiFoeezlJ0v5rqHBl3gedsbRZmhvWeL_x_2U_vcI";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get extension ID from query param
const ext = new URLSearchParams(window.location.search).get("ext");

(async () => {
  const { data, error } = await supabase.auth.exchangeCodeForSession();
  if (error) {
    console.error("Exchange error:", error);
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session && ext) {
    chrome.runtime.sendMessageExternal(ext, {
      supabaseToken: session.access_token,
      gmailToken: session.provider_token
    }).then(() => window.close());
  }
})();
