(function (root) {
  const HomeLens = root.HomeLens = root.HomeLens || {};
  const K = HomeLens.STORAGE_KEYS;

  async function validateLicense(licenseKey) {
    const key = String(licenseKey || "").trim();
    if (!key) return { valid: false, error: "Въведи лицензен ключ." };
    if (!HomeLens.CONFIG.LEMON_SQUEEZY_PRODUCT_IDS.length) {
      return { valid: false, error: "Premium продажбите все още не са конфигурирани." };
    }

    const body = new URLSearchParams({ license_key: key });
    let response;
    try {
      response = await fetch("https://api.lemonsqueezy.com/v1/licenses/validate", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
        body
      });
    } catch {
      return { valid: false, error: "Няма връзка със системата за лицензиране." };
    }
    if (!response.ok) return { valid: false, error: "Лицензът не може да бъде проверен." };
    const data = await response.json();
    const allowed = HomeLens.CONFIG.LEMON_SQUEEZY_PRODUCT_IDS;
    const productId = Number(data.meta?.product_id || data.license_key?.product_id);
    const productMatches = allowed.map(Number).includes(productId);
    const valid = Boolean(data.valid && productMatches && data.license_key?.status === "active");
    const validUntil = new Date(Date.now() + HomeLens.CONFIG.LICENSE_CACHE_HOURS * 3600000).toISOString();
    const cache = {
      valid,
      validUntil,
      productId,
      expiresAt: data.license_key?.expires_at || null,
      customerEmail: data.meta?.customer_email || ""
    };
    await chrome.storage.local.set({ [K.LICENSE]: key, [K.LICENSE_CACHE]: cache });
    return valid ? { valid: true, ...cache } : { valid: false, error: "Ключът е невалиден или абонаментът не е активен." };
  }

  async function refreshLicense() {
    const stored = await chrome.storage.local.get(K.LICENSE);
    return stored[K.LICENSE] ? validateLicense(stored[K.LICENSE]) : { valid: false };
  }

  async function deactivateLicense() {
    await chrome.storage.local.remove([K.LICENSE, K.LICENSE_CACHE]);
    return { valid: false };
  }

  HomeLens.license = { validateLicense, refreshLicense, deactivateLicense };
})(globalThis);
