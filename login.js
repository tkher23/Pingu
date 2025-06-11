const SUPABASE_URL = "https://ishnglghmfijbgtuhxzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaG5nbGdobWZpamJndHVoeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0Nzk5ODIsImV4cCI6MjA2NDA1NTk4Mn0.WmapiFoeezlJ0v5rqHBl3gedsbRZmhvWeL_x_2U_vcI"

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Step 1: Try to read from query param initially
const urlParams = new URLSearchParams(window.location.search);
const EXT_FROM_QUERY = urlParams.get("ext");

// Save to sessionStorage if it's the first load
if (EXT_FROM_QUERY) {
  sessionStorage.setItem("extensionId", EXT_FROM_QUERY);
}

// Step 2: Always read from sessionStorage (survives redirect)
const EXTENSION_ID = sessionStorage.getItem("extensionId");

document.getElementById("loginBtn").addEventListener("click", async () => {
  const redirectUrl = `${window.location.origin}/login.html`;

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
