const SUPABASE_URL = "https://ishnglghmfijbgtuhxzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaG5nbGdobWZpamJndHVoeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0Nzk5ODIsImV4cCI6MjA2NDA1NTk4Mn0.WmapiFoeezlJ0v5rqHBl3gedsbRZmhvWeL_x_2U_vcI";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Get extension ID from query parameter
const urlParams = new URLSearchParams(window.location.search);
const EXTENSION_ID = urlParams.get("ext");

document.getElementById("loginBtn").addEventListener("click", async () => {
  const redirectUrl = `${window.location.origin}/login.html?ext=${EXTENSION_ID}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      scopes: 'https://www.googleapis.com/auth/gmail.send'
    }
  });

  if (error) console.error("OAuth error:", error);
});

window.addEventListener("DOMContentLoaded", async () => {
  if (!window.location.search.includes("code=")) return;
  if (!EXTENSION_ID) return console.error("Missing extension ID");

  const { data: sessionExchange, error: exchangeError } = await supabase.auth.exchangeCodeForSession();
  if (exchangeError) return console.error("Exchange error:", exchangeError);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return console.error("No session");

  try {
    await chrome.storage.local.set({
      supabaseToken: session.access_token,
      gmailToken: session.provider_token
    });
    console.log("✅ Token stored in chrome.storage.local");
    window.close();
  } catch (e) {
    console.error("❌ Could not store in chrome.storage.local:", e);
  }
});
