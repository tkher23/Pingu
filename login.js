const SUPABASE_URL = "https://ishnglghmfijbgtuhxzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaG5nbGdobWZpamJndHVoeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0Nzk5ODIsImV4cCI6MjA2NDA1NTk4Mn0.WmapiFoeezlJ0v5rqHBl3gedsbRZmhvWeL_x_2U_vcI";

import { createClient } from "@supabase/supabase-js"

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.getElementById("loginBtn").addEventListener("click", async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (error) console.error("OAuth error:", error);
});

async function checkSessionAndSend() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (session) {
    window.opener?.postMessage({ token: session.access_token }, "*");
  }
}

window.addEventListener("DOMContentLoaded", checkSessionAndSend);
