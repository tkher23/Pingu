const BACKEND_URL = "https://chrome-pingu-backend.onrender.com";

let userToken = null;

/************ DOM REFERENCES ************/
const loginSection = document.getElementById("login-section");
const mainUI = document.getElementById("main-ui");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");

const tabCraftBtn = document.getElementById("tab-craft-btn");
const tabSimpleBtn = document.getElementById("tab-simple-btn");
const tabSettingsBtn = document.getElementById("tab-settings-btn");
const tabCraft = document.getElementById("tab-craft");
const tabSimple = document.getElementById("tab-simple");
const tabSettings = document.getElementById("tab-settings");

const recipientNameField = document.getElementById("recipient-name");
const linkedinField = document.getElementById("linkedin");
const bioField = document.getElementById("bio");
const valuesField = document.getElementById("values");
const interestField = document.getElementById("interest");
const outputField = document.getElementById("output");
const subjectOutputField = document.getElementById("subject-output");

const nameInput = document.getElementById("user-name");
const introInput = document.getElementById("user-intro");
const defaultInterestInput = document.getElementById("default-interest");
const saveBtn = document.getElementById("save-profile");
const saveMsg = document.getElementById("save-msg");
const contextInput = document.getElementById("persona-context");
const companyInput = document.getElementById("company-interest");
const roleTypeSelect = document.getElementById("role-type");

const creditsDisplay = document.getElementById("credits-display");
const copyBtn = document.getElementById("copy-email-btn");
const copyBtn2 = document.getElementById("copy-subject-btn");
const copyMsg = document.getElementById("copy-confirmation");

const generateSimpleBtn = document.getElementById("generate-simple-email");
const simpleEmailOutput = document.getElementById("simple-email-output");
const simpleInterestField = document.getElementById("simple-interest");
const simpleRecipientField = document.getElementById("simple-recipient");
const simpleSubjectOutput = document.getElementById("simple-subject-output");
const copySimpleBtn = document.getElementById("copy-simple-email-btn");
const copySimpleSubjectBtn = document.getElementById("copy-simple-subject-btn");
const simpleCopyMsg = document.getElementById("simple-copy-confirmation");

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
  port.postMessage({ type: "login" }); // persistent connection
  loginBtn.disabled = false;
}
loginBtn.addEventListener("click", enforceLogin);

/************ UI DISPLAY ************/
async function loadUI() {
  const { supabaseToken } = await chrome.storage.local.get("supabaseToken");
  if (supabaseToken) {
    console.log("✅ User is logged in");
    loginSection.style.display = "none";
    mainUI.style.display = "block";
    userToken = supabaseToken;
    await loadAfterLogin();
  } else {
    loginSection.style.display = "block";
    mainUI.style.display = "none";
  }
}
loadUI();

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
  if (user.default_interest) {
    defaultInterestInput.value = user.default_interest;
    if (!interestField.value) interestField.value = user.default_interest;
    if (!simpleInterestField.value) simpleInterestField.value = user.default_interest;
  }
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
  tabCraft.classList.remove("active");
  tabSimple.classList.remove("active");
  tabSettings.classList.remove("active");

  if (target === "craft") tabCraft.classList.add("active");
  if (target === "simple") tabSimple.classList.add("active");
  if (target === "settings") tabSettings.classList.add("active");
}

tabCraftBtn.addEventListener("click", () => switchTab("craft"));
tabSimpleBtn.addEventListener("click", () => switchTab("simple"));
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

/************ GENERATE SUBJECT LINE LOGIC ************/
document.getElementById("generate-subject").addEventListener("click", async () => {
  if (!userToken) {
    alert("You must be logged in to generate a subject line.");
    return;
  }

  const user = await getProfile();

  const payload = {
    user_info: {
      intro: user.intro || ""
    },
    company_of_interest: user.company_interest || ""
  };

  subjectOutputField.value = "Generating subject…";

  try {
    const response = await fetch(`${BACKEND_URL}/api/generate-subject`, {
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
    subjectOutputField.value = data.subject;

    await fetchCredits(); // Refresh credits after subject generation
  } catch (err) {
    console.error("Fetch Error:", err);
    subjectOutputField.value = `Error: ${err.message || "Failed to connect."}`;
  }
});

/************ CRAFT EMAIL LOGIC ************/
document.getElementById("craft").addEventListener("click", async () => {
  if (!userToken) {
    alert("You must be logged in to craft emails.");
    return;
  }

  outputField.value = "Crafting email…";

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
    outputField.value = data.generated_email;

    await fetchCredits(); // Refresh credits after crafting
  } catch (err) {
    console.error("Fetch Error:", err);
    outputField.value = `Error: ${err.message || "Failed to connect."}`;
  }
});
/**** BUTTON THAT DOES BOTH AT SAME TIME */

document.getElementById("generate-advanced-email").addEventListener("click", async () => {
  if (!userToken) {
    alert("You must be logged in to generate an email.");
    return;
  }

  outputField.value = "Crafting email…";
  subjectOutputField.value = "Generating subject…";

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

  const subjectPayload = {
    user_info: {
      intro: user.intro || ""
    },
    company_of_interest: user.company_interest || ""
  };

  try {
    // Generate Email
    const emailRes = await fetch(`${BACKEND_URL}/api/process-single-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify(payload)
    });

    const emailData = await emailRes.json();
    if (emailRes.ok) {
      outputField.value = emailData.generated_email || "No email generated.";
    } else {
      outputField.value = emailData.error || "Something went wrong.";
    }

    // Generate Subject
    const subjectRes = await fetch(`${BACKEND_URL}/api/generate-subject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify(subjectPayload)
    });

    const subjectData = await subjectRes.json();
    if (subjectRes.ok) {
      subjectOutputField.value = subjectData.subject || "No subject generated.";
    } else {
      subjectOutputField.value = subjectData.error || "Something went wrong.";
    }

    await fetchCredits(); // Refresh credit count
  } catch (err) {
    console.error("Advanced Email or Subject Error:", err);
    outputField.value = "Error generating email.";
    subjectOutputField.value = "Error generating subject.";
  }
});

/************ COPY BUTTONS ************/
copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(outputField.value);
    copyMsg.textContent = "Copied!";
    setTimeout(() => (copyMsg.textContent = ""), 1500);
  } catch (err) {
    console.error("Copy failed:", err);
    copyMsg.textContent = "Failed to copy.";
  }
});

copyBtn2.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(subjectOutputField.value);
    copyMsg.textContent = "Copied!";
    setTimeout(() => (copyMsg.textContent = ""), 1500);
  } catch (err) {
    console.error("Copy failed:", err);
    copyMsg.textContent = "Failed to copy.";
  }
});

/************ SIMPLE EMAIL LOGIC ************/
generateSimpleBtn.addEventListener("click", async () => {
  if (!userToken) {
    alert("You must be logged in to generate this email.");
    return;
  }

  simpleEmailOutput.value = "Generating...";
  simpleSubjectOutput.value = "Generating...";

  const payload = {
    user_info: {
      name: nameInput.value.trim(),
      intro: introInput.value.trim(),
      company_interest: companyInput.value.trim()
    },
    recipient_name: simpleRecipientField.value.trim(),
    internship_interest: simpleInterestField.value.trim()
  };

  const subjectPayload = {
    user_info: {
      intro: introInput.value.trim()
    },
    company_of_interest: companyInput.value.trim()
  };

  try {
    // Generate Email
    const emailRes = await fetch(`${BACKEND_URL}/api/simple-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify(payload)
    });

    const emailData = await emailRes.json();
    if (emailRes.ok) {
      simpleEmailOutput.value = emailData.generated_email || "No email generated.";
    } else {
      simpleEmailOutput.value = emailData.error || "Something went wrong.";
    }

    // Generate Subject
    const subjectRes = await fetch(`${BACKEND_URL}/api/generate-subject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`
      },
      body: JSON.stringify(subjectPayload)
    });

    const subjectData = await subjectRes.json();
    if (subjectRes.ok) {
      simpleSubjectOutput.value = subjectData.subject || "No subject generated.";
    } else {
      simpleSubjectOutput.value = subjectData.error || "Something went wrong.";
    }

    await fetchCredits(); // Refresh credit count
  } catch (err) {
    console.error("Simple Email or Subject Error:", err);
    simpleEmailOutput.value = "Error generating email.";
    simpleSubjectOutput.value = "Error generating subject.";
  }
});

/************ SIMPLE COPY BUTTONS ************/
copySimpleBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(simpleEmailOutput.value);
    simpleCopyMsg.textContent = "Copied!";
    setTimeout(() => (simpleCopyMsg.textContent = ""), 1500);
  } catch (err) {
    console.error("Copy failed:", err);
    simpleCopyMsg.textContent = "Failed to copy.";
  }
});

copySimpleSubjectBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(simpleSubjectOutput.value);
    simpleCopyMsg.textContent = "Copied!";
    setTimeout(() => (simpleCopyMsg.textContent = ""), 1500);
  } catch (err) {
    console.error("Copy failed:", err);
    simpleCopyMsg.textContent = "Failed to copy.";
  }
});


/** SENDING EMAIL FUNCTIONS */
const recipientEmailField = document.getElementById("recipient-email");
const simpleRecipientEmailField = document.getElementById("simple-recipient-email");

async function sendGmail(toEmail, subject, body) {
  const { gmailToken } = await chrome.storage.local.get("gmailToken");

  const message = [
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    '',
    body
  ].join('\n');

  const rawBase64 = btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gmailToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: rawBase64 })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to send Gmail");
  }
}

/************ GMAIL SEND BUTTON LISTENERS (AFTER DOM READY) ************/
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("send-gmail-btn").addEventListener("click", async () => {
    const to = recipientEmailField.value.trim();
    const subject = subjectOutputField.value.trim();
    const body = outputField.value.trim();

    if (!to || !subject || !body) {
      alert("Missing recipient email, subject, or body");
      return;
    }

    try {
      await sendGmail(to, subject, body);
      document.getElementById("send-status").textContent = "✅ Email sent!";
    } catch (err) {
      console.error("Gmail send failed:", err);
      document.getElementById("send-status").textContent = "❌ Send failed.";
    }

    setTimeout(() => {
      document.getElementById("send-status").textContent = "";
    }, 3000);
  });

  document.getElementById("send-simple-gmail-btn").addEventListener("click", async () => {
    const to = simpleRecipientEmailField.value.trim();
    const subject = simpleSubjectOutput.value.trim();
    const body = simpleEmailOutput.value.trim();

    if (!to || !subject || !body) {
      alert("Missing recipient email, subject, or body");
      return;
    }

    try {
      await sendGmail(to, subject, body);
      document.getElementById("simple-send-status").textContent = "✅ Email sent!";
    } catch (err) {
      console.error("Gmail send failed:", err);
      document.getElementById("simple-send-status").textContent = "❌ Send failed.";
    }

    setTimeout(() => {
      document.getElementById("simple-send-status").textContent = "";
    }, 3000);
  });
});
