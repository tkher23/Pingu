/************ CONFIG ************/
const LOGIN_URL = "https://pingu-login.vercel.app/login.html";

let oauthWindowId = null;

/************ Setup Side Panel Behavior ************/
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

/************ Listen for login popup request ************/
chrome.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener((message) => {
    if (message.type === "login") {
      const extensionId = message.extensionId || chrome.runtime.id;
      const loginUrl = `${LOGIN_URL}?ext=${extensionId}`; // ✅ add ext to URL

      chrome.windows.create({
        url: loginUrl,
        type: "popup",
        width: 500,
        height: 600
      }, (newWindow) => {
        oauthWindowId = newWindow.id;
      });
    }
  });
});


/************ Listen for token received externally from hosted login page ************/
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  const storage = {};
  if (request.supabaseToken) storage.supabaseToken = request.supabaseToken;
  if (request.gmailToken) storage.gmailToken = request.gmailToken;

  chrome.storage.local.set(storage, () => {
    // Notify all side panel instances
    chrome.runtime.sendMessage({ type: "loginComplete" });

    if (oauthWindowId !== null) {
      chrome.windows.remove(oauthWindowId);
      oauthWindowId = null;
    }
  });
});
