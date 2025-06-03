
/************ Ensure Supabase is Ready ************/
// Since we're loading supabase.js before popup.js, supabase is globally available

/************ DOM References ************/
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

const BACKEND_URL = "https://chrome-pingu-backend.onrender.com";
let userToken = null;

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ishnglghmfijbgtuhxzd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzaG5nbGdobWZpamJndHVoeHpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg0Nzk5ODIsImV4cCI6MjA2NDA1NTk4Mn0.WmapiFoeezlJ0v5rqHBl3gedsbRZmhvWeL_x_2U_vcI";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


/************ Login Enforcement ************/
async function enforceLogin() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    const { data: authData, error: loginError } = await supabase.auth.signInWithOAuth({
      provider: 'google'
    });
    return false;
  }

  userToken = data.session.access_token;
  chrome.storage.local.set({ supabaseToken: userToken });
  return true;
}

/************ Tab Logic ************/
function switchTab(target) {
  tabCraft.classList.toggle("active", target === "craft");
  tabSettings.classList.toggle("active", target !== "craft");
}
tabCraftBtn.addEventListener("click", () => switchTab("craft"));
tabSettingsBtn.addEventListener("click", () => switchTab("settings"));

/************ Storage Helpers ************/
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

/************ Load Profile After Login ************/
(async () => {
  const loggedIn = await enforceLogin();
  if (!loggedIn) return;

  const user = await getProfile();
  if (user.name) nameInput.value = user.name;
  if (user.intro) introInput.value = user.intro;
  if (user.defaultInt) defaultIntInp.value = user.defaultInt;
  if (user.defaultInt && !interestField.value) interestField.value = user.defaultInt;
  if (user.persona_context) contextInput.value = user.persona_context;
  if (user.company_interest) companyInput.value = user.company_interest;
  if (user.role_type) roleTypeSelect.value = user.role_type;
})();

/************ Save Profile Button ************/
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

/************ Clipboard Paste Logic ************/
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

/************ Craft Email Logic ************/
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
