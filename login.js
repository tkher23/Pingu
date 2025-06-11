const SUPABASE_URL = "https://ishnglghmfijbgtuhxzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaG5nbGdobWZpamJndHVoeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0Nzk5ODIsImV4cCI6MjA2NDA1NTk4Mn0.WmapiFoeezlJ0v5rqHBl3gedsbRZmhvWeL_x_2U_vcI";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.getElementById("loginBtn").addEventListener("click", async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.href,
    scopes: 'https://www.googleapis.com/auth/gmail.send'
  }
});

  if (error) console.error("OAuth error:", error);
});

window.addEventListener("DOMContentLoaded", async () => {
  // Handle redirect callback to finalize session
  const { data, error } = await supabase.auth.exchangeCodeForSession();
  if (error) console.error("Exchange error:", error);

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    const { access_token, provider_token } = session;

    chrome.runtime.sendMessage(chrome.runtime.id, {
    supabaseToken: access_token,
    gmailToken: provider_token}).then(() => {
    window.close();
    });
  }
});
