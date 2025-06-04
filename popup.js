import { createClient } from "@supabase/supabase-js";

/************ CONFIG ************/
const SUPABASE_URL = "https://ishnglghmfijbgtuhxzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaG5nbGdobWZpamJndHVoeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0Nzk5ODIsImV4cCI6MjA2NDA1NTk4Mn0.WmapiFoeezlJ0v5rqHBl3gedsbRZmhvWeL_x_2U_vcI";
const BACKEND_URL = "https://chrome-pingu-backend.onrender.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let userToken = null;

/************ DOM REFERENCES ************/
const loginSection = document.getElementById("login-section");
const mainUI = document.getElementById("main-ui");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const tabCraftBtn = document.getElementById("tab-craft-btn");
const tabSettingsBtn = document.getElementById("tab-settings-btn");
const tabCraft = document.getElementById("tab-craft");
const tabSettings = document.getElementById("tab-settings");

const recipientNameField = document.getElementById("recipient-name");
const linkedinField = document.getElementById("linkedin");
const bioField = document.getElementById("bio");
const valuesField = document.getElementById("values");
const interestField = document.getElementById("interest");
const outputDiv = document.getElementById("output");

const nameInput = document.getElementById("user-name");
const introInput = document.getElementById("user-intro");
const defaultIntInp = document.getElementById("default-interest");
const saveBtn = document.getElementById("save-profile");
const saveMsg = document.getElementById("save-msg");
const contextInput = document.getElementById("persona-context");
const companyInput = document.getElementById("company-interest");
const roleTypeSelect = document.getElementById("role-type");

/************ STORAGE HANDLERS ************/
function getProfile() {
  return new Promise((res) =>
    chrome.storage.sync.get("userProfile", (data) => res(data.userProfile || {}))
  );
}
function saveProfile(profile) {
  return new Promise((res) =>
    chrome.storage.sync.set({ userProfile: profile }, () => res())
  );
}

/************ LOGIN FLOW (BeastX method) ************/
async function checkLogin() {
  const { supabaseRefreshToken } = await chrome.storage.local.get("supabaseRefreshToken");
  if (supabaseRefreshToken) {
    const { user, session, error } = await supabase.auth.signIn({ refreshToken: supabaseRefreshToken });
    if (error || !user) {
      console.error("Session restore failed:", error);
      await chrome.storage.local.remove("supabaseRefreshToken");
      return false;
    }
    userToken = session.access_token;
    await chrome.storage.local.set({ supabaseRefreshToken: session.refresh_token });
    return true;
  }
  return false;
}

async function enforceLogin() {
  loginBtn.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "login" });

    if (response?.success) {
      const { refreshToken, accessToken } = response;

      // Set Supabase session directly
      const { data, error } = await supabase.auth.setSession({
        refresh_token: refreshToken,
        access_token: accessToken
      });

      if (error) {
        console.error("Supabase setSession error:", error);
        alert("Could not create Supabase session.");
      } else {
        userToken = data.session.access_token;
        await chrome.storage.local.set({ supabaseRefreshToken: data.session.refresh_token });
        await loadAfterLogin();
      }
    } else {
      console.error("OAuth failed", response?.error);
      alert("Login failed.");
    }
  } catch (err) {
    console.error("OAuth error:", err);
    alert("OAuth login failed.");
  }
  loginBtn.disabled = false;
}

loginBtn.addEventListener("click", enforceLogin);

/************ INIT AFTER LOGIN ************/
(async () => {
  const loggedIn = await checkLogin();
  if (!loggedIn) {
    loginSection.style.display = "block";
    mainUI.style.display = "none";
    return;
  }
  await loadAfterLogin();
})();

async function loadAfterLogin() {
  loginSection.style.display = "none";
  mainUI.style.display = "block";

  const user = await getProfile();
  if (user.name) nameInput.value = user.name;
  if (user.intro) introInput.value = user.intro;
  if (user.defaultInt) defaultIntInp.value = user.defaultInt;
  if (user.defaultInt && !interestField.value) interestField.value = user.defaultInt;
  if (user.persona_context) contextInput.value = user.persona_context;
  if (user.company_interest) companyInput.value = user.company_interest;
  if (user.role_type) roleTypeSelect.value = user.role_type;
}

/************ LOGOUT ************/
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  await chrome.storage.local.remove("supabaseRefreshToken");
  userToken = null;
  mainUI.style.display = "none";
  loginSection.style.display = "block";
});

/************ TAB SWITCHING ************/
function switchTab(target) {
  tabCraft.classList.toggle("active", target === "craft");
  tabSettings.classList.toggle("active", target !== "craft");
}
tabCraftBtn.addEventListener("click", () => switchTab("craft"));
tabSettingsBtn.addEventListener("click", () => switchTab("settings"));

/************ SAVE PROFILE BUTTON ************/
saveBtn.addEventListener("click", async () => {
  const profile = {
    name: nameInput.value.trim(),
    intro: introInput.value.trim(),
    defaultInt: defaultIntInp.value.trim(),
    persona_context: contextInput.value.trim(),
    company_interest: companyInput.value.trim(),
    role_type: roleTypeSelect.value
  };
  await saveProfile(profile);
  saveMsg.textContent = "✅ Saved!";
  setTimeout(() => (saveMsg.textContent = ""), 2000);
});

/************ CLIPBOARD LOGIC ************/
let activeField = null;
[linkedinField, bioField, valuesField, interestField].forEach((field) =>
  field.addEventListener("focus", () => (activeField = field))
);
document.getElementById("paste").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (activeField) activeField.value = text;
    else alert("Click inside a field before pasting.");
  } catch (err) {
    console.error("Clipboard read failed:", err);
    alert("Unable to access clipboard.");
  }
});

/************ CRAFT EMAIL LOGIC ************/
document.getElementById("craft").addEventListener("click", async () => {
  if (!userToken) {
    alert("You must be logged in to craft emails.");
    return;
  }

  outputDiv.textContent = "Crafting email…";

  const user = await getProfile();
  const internshipInterest = interestField.value.trim() || user.defaultInt || "";

  const payload = {
    user_info: {
      name: user.name || "",
      intro: user.intro || "",
      persona_context: user.persona_context || "",
      company_interest: user.company_interest || "",
      role_type: user.role_type || "internship"
    },
    recipient_name: recipientNameField.value.trim(),
    linkedin: linkedinField.value,
    bio_page: bioField.value,
    values_page: valuesField.value,
    internship_interest: internshipInterest
  };

  try {
    const response = await fetch(`${BACKEND_URL}/api/process-single-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let msg = "Server error";
      try {
        const err = await response.json();
        msg = err.error || msg;
      } catch {}
      throw new Error(msg);
    }

    const data = await response.json();
    outputDiv.textContent = data.generated_email;
  } catch (err) {
    console.error("Fetch Error:", err);
    outputDiv.textContent = `Error: ${err.message || "Failed to connect."}`;
  }
});
