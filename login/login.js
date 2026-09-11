const SUPABASE_URL = "https://ishnglghmfijbgtuhxzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaG5nbGdobWZpamJndHVoeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0Nzk5ODIsImV4cCI6MjA2NDA1NTk4Mn0.WmapiFoeezlJ0v5rqHBl3gedsbRZmhvWeL_x_2U_vcI"

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Step 1: Save extension ID on first load (from popup)
const urlParams = new URLSearchParams(window.location.search);
const EXT_FROM_QUERY = urlParams.get("ext");
if (EXT_FROM_QUERY) {
  sessionStorage.setItem("extensionId", EXT_FROM_QUERY);
}

// Step 2: Always read extension ID from sessionStorage
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
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));

  console.log("🧭 URL:", window.location.href);
  console.log("🧭 EXTENSION_ID:", EXTENSION_ID);
  console.log("🧭 query params:", [...query.entries()]);
  console.log("🧭 hash params:", [...hash.entries()]);

  if (!EXTENSION_ID) {
    console.error("Missing extension ID");
    return;
  }

  // Plan A: Code flow
  if (query.get("code")) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession();
    if (exchangeError) {
      console.error("Exchange error:", exchangeError);
    }
  }

  // Plan B: Try to get session either way
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    console.error("No session available", error);
    return;
  }

  // PATCH: Set up free trial fields on signup/login
  try {
    const userId = session.user.id;
    const today = new Date();
    const trialEnd = new Date(today);
    trialEnd.setDate(today.getDate() + 7);
    await supabase
      .from('user_profiles')
      .update({
        plan_type: 'trial',
        credits: 50,
        trial_end_date: trialEnd.toISOString().slice(0, 10) // YYYY-MM-DD
      })
      .eq('id', userId);
  } catch (err) {
    console.error('Failed to patch user profile with trial fields:', err);
  }

  try {
    chrome.runtime.sendMessage(EXTENSION_ID, {
      type: "authSuccess",
      supabaseToken: session.access_token,
      gmailToken: session.provider_token
    }, () => {
      console.log("✅ Sent token to extension");
      sessionStorage.removeItem("extensionId");
      window.close();
    });
  } catch (err) {
    console.error("❌ Failed to send token to extension:", err);
  }
});
