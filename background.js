/************ CONFIG ************/
const LOGIN_URL = "https://pingu-login.vercel.app/login.html";

// Listen for popup requesting login
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "login") {
    handleLoginFlow();
  }
  return true;
});

async function handleLoginFlow() {
  const loginWindow = window.open(LOGIN_URL, "Login", "width=500,height=600");

  // Listen for postMessage from login.html
  window.addEventListener("message", async (event) => {
    if (event.origin !== "https://pingu-login.vercel.app") return;

    const { token } = event.data;
    if (token) {
      await chrome.storage.local.set({ supabaseToken: token });
      loginWindow.close();
    }
  });
}
