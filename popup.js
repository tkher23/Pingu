const BACKEND_URL = "https://chrome-pingu-backend.onrender.com";

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
const defaultInterestInput = document.getElementById("default-interest");
const saveBtn = document.getElementById("save-profile");
const saveMsg = document.getElementById("save-msg");
const contextInput = document.getElementById("persona-context");
const companyInput = document.getElementById("company-interest");
const roleTypeSelect = document.getElementById("role-type");

const creditsDisplay = document.getElementById("credits-display");

/************ STORAGE HANDLERS ************/
async function getProfile() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/user-settings`, {
      method: "GET",
      headers: { Authorization: `Bearer ${userToken}` }
    });
    if (!res.ok) return {};
    return await res.json();
  } catch (err) {
    console.error("Failed to fetch user settings:", err);
    return {};
  }
}

async function saveProfile(profile) {
  try {
    await fetch(`${BACKEND_URL}/api/user-settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userToken}`
      },
      body: JSON.stringify(profile)
    });
  } catch (err) {
    console.error("Failed to save user settings:", err);
  }
}

/************ LOGIN FLOW ************/
async function enforceLogin() {
  loginBtn.disabled = true;
  await chrome.storage.local.remove("supabaseToken");
  const port = chrome.runtime.connect();
  port.postMessage({ type: "login" });
  loginBtn.disabled = false;
}

loginBtn.addEventListener("click", enforceLogin);

/************ LOGIC TO LOAD UI BASED ON LOGIN ************/
async function loadUI() {
  const { supabaseToken } = await chrome.storage.local.get("supabaseToken");
  if (supabaseToken) {
    userToken = supabaseToken;
    await loadAfterLogin();
  } else {
    loginSection.style.display = "block";
    mainUI.style.display = "none";
  }
}

/************ LISTEN FOR LOGIN COMPLETE MESSAGE ************/
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "loginComplete") {
    loadUI();
  }
});

/************ INITIAL UI LOAD WHEN POPUP OPENS ************/
loadUI();

/************ AFTER LOGIN CONTENT LOADER ************/
async function loadAfterLogin() {
  loginSection.style.display = "none";
  mainUI.style.display = "block";

  const user = await getProfile();
  if (user.name) nameInput.value = user.name;
  if (user.intro) introInput.value = user.intro;
  if (user.default_interest) defaultInterestInput.value = user.default_interest;
  if (user.default_interest && !interestField.value) interestField.value = user.default_interest;
  if (user.persona_context) contextInput.value = user.persona_context;
  if (user.company_interest) companyInput.value = user.company_interest;
  if (user.role_type) roleTypeSelect.value = user.role_type;

  await fetchCredits();
}

/************ FETCH USER CREDITS ************/
async function fetchCredits() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/get-credits`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${userToken}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      creditsDisplay.textContent = `Credits: ${data.credits}`;
    } else {
      creditsDisplay.textContent = `Credits: error loading`;
    }
  } catch (err) {
    creditsDisplay.textContent = `Credits: failed to load`;
    console.error("Error fetching credits:", err);
  }
}

/************ LOGOUT ************/
logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove("supabaseToken");
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
    default_interest: defaultInterestInput.value.trim(),
    persona_context: contextInput.value.trim(),
    company_interest: companyInput.value.trim(),
    role_type: roleTypeSelect.value
  };
  await saveProfile(profile);
  saveMsg.textContent = "Saved!";
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
  const internshipInterest = interestField.value.trim() || user.default_interest || "";

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

    await fetchCredits(); // Refresh credits after crafting
  } catch (err) {
    console.error("Fetch Error:", err);
    outputDiv.textContent = `Error: ${err.message || "Failed to connect."}`;
  }
});
