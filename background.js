import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ishnglghmfijbgtuhxzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaG5nbGdobWZpamJndHVoeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0Nzk5ODIsImV4cCI6MjA2NDA1NTk4Mn0.WmapiFoeezlJ0v5rqHBl3gedsbRZmhvWeL_x_2U_vcI";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "login") {
    (async () => {
      try {
        const provider = message.provider || "google";
        const redirectUri = chrome.identity.getRedirectURL("supabase-auth");
        const authUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectUri)}&response_type=token&scopes=offline`;

        const callbackUrl = await chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        });

        if (!callbackUrl) {
          sendResponse({ success: false, error: "OAuth flow was canceled." });
          return;
        }

        const urlFragment = callbackUrl.split("#")[1];
        const params = new URLSearchParams(urlFragment);
        const refreshToken = params.get("refresh_token");
        const accessToken = params.get("access_token");

        if (!refreshToken || !accessToken) {
          sendResponse({ success: false, error: "Missing tokens." });
          return;
        }

        // OPTIONAL: if you want to fetch user profile directly
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);
        if (error) {
          sendResponse({ success: false, error: error.message });
          return;
        }

        chrome.storage.local.set({ supabaseRefreshToken: refreshToken });

        sendResponse({
          success: true,
          refreshToken,
          accessToken,
          user: { email: user.email, id: user.id }
        });
      } catch (err) {
        console.error("OAuth error:", err);
        sendResponse({ success: false, error: err.message });
      }
    })();

    return true;
  }
});
