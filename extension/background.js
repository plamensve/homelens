importScripts("src/constants.js", "src/utils.js", "src/storage.js", "src/license.js");

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  chrome.alarms.create("homelens-license-refresh", { periodInMinutes: 12 * 60 });
  if (reason === "install") {
    await HomeLens.store.saveSettings(HomeLens.CONFIG.DEFAULTS);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "homelens-license-refresh") HomeLens.license.refreshLicense();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const actions = {
    VALIDATE_LICENSE: () => HomeLens.license.validateLicense(message.licenseKey),
    REFRESH_LICENSE: () => HomeLens.license.refreshLicense(),
    DEACTIVATE_LICENSE: () => HomeLens.license.deactivateLicense()
  };
  if (!actions[message?.type]) return false;
  actions[message.type]().then(sendResponse).catch((error) => sendResponse({ valid: false, error: error.message }));
  return true;
});

