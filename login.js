const SUPABASE_URL = "https://ishnglghmfijbgtuhxzd.supabase.co";
const SUPABASE_ANON_KEY = "...";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const urlParams = new URLSearchParams(window.location.search);

// 1. Try to get extension ID from state first
let EXTENSION_ID = null;
try {
  const state = urlParams.get("state");
  if (state) {
    const decoded = JSON.parse(atob(state));
    EXTENSION_ID = decoded.ext;
  }
} catch {}

// 2. Fallback if user opens login page directly
if (!EXTENSION_ID) {
  EXTENSION_ID = urlParams.get("ext");
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const state = btoa(JSON.stringify({ ext: EXTENSION_ID }));
  const redirectUrl = `${window.location.origin}/login.html`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      scopes: 'https://www.googleapis.com/auth/gmail.send',
      queryParams: { state }
    }
  });

  if (error) console.error("OAuth error:", error);
});

window.addEventListener("DOMContentLoaded", async () => {
  if (!urlParams.get("code")) return;
  if (!EXTENSION_ID) return console.error("Missing extension ID");

  const { data: sessionExchange, error: exchangeError } = await supabase.auth.exchangeCodeForSession();
  if (exchangeError) return console.error("Exchange error:", exchangeError);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return console.error("No session");

  try {
    chrome.runtime.sendMessage(EXTENSION_ID, {
      type: "authSuccess",
      supabaseToken: session.access_token,
      gmailToken: session.provider_token
    }, () => {
      console.log("✅ Sent token to extension");
      window.close();
    });
  } catch (e) {
    console.error("❌ Failed to send token:", e);
  }
});
