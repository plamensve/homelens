(function (root) {
  const HomeLens = root.HomeLens = root.HomeLens || {};
  const K = HomeLens.STORAGE_KEYS;

  function get(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function set(values) {
    return new Promise((resolve) => chrome.storage.local.set(values, resolve));
  }

  async function getSettings() {
    const result = await get(K.SETTINGS);
    return { ...HomeLens.CONFIG.DEFAULTS, ...(result[K.SETTINGS] || {}) };
  }

  async function saveSettings(settings) {
    await set({ [K.SETTINGS]: { ...HomeLens.CONFIG.DEFAULTS, ...settings } });
  }

  async function getObservations() {
    return (await get(K.OBSERVATIONS))[K.OBSERVATIONS] || [];
  }

  async function addObservation(property) {
    if (!property?.isLikelyListing) return [];
    const observations = await getObservations();
    const latest = [...observations].reverse().find((item) => item.id === property.id);
    const sameDay = latest && latest.observedAt.slice(0, 10) === property.observedAt.slice(0, 10);
    const unchanged = sameDay && latest.priceEur === property.priceEur && latest.area === property.area;
    if (!unchanged) observations.push(property);
    const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const trimmed = observations.filter((item) => new Date(item.observedAt).getTime() >= cutoff).slice(-5000);
    await set({ [K.OBSERVATIONS]: trimmed });
    return trimmed;
  }

  async function getSaved() {
    return (await get(K.SAVED))[K.SAVED] || [];
  }

  async function isPremium() {
    const cache = (await get(K.LICENSE_CACHE))[K.LICENSE_CACHE];
    return Boolean(cache?.valid && new Date(cache.validUntil).getTime() > Date.now());
  }

  async function saveProperty(property) {
    const saved = await getSaved();
    const existingIndex = saved.findIndex((item) => item.id === property.id);
    if (existingIndex >= 0) {
      const next = saved.map((item, index) => index === existingIndex
        ? { ...item, ...property, savedAt: item.savedAt || new Date().toISOString() }
        : item);
      await set({ [K.SAVED]: next });
      return { ok: true, saved: next, alreadySaved: true, updated: true };
    }
    if (!await isPremium() && saved.length >= HomeLens.CONFIG.FREE_SAVED_LIMIT) {
      return { ok: false, code: "FREE_LIMIT", saved };
    }
    const next = [{ ...property, savedAt: new Date().toISOString() }, ...saved];
    await set({ [K.SAVED]: next });
    return { ok: true, saved: next };
  }

  async function removeSaved(propertyId) {
    const next = (await getSaved()).filter((item) => item.id !== propertyId);
    await set({ [K.SAVED]: next });
    return next;
  }

  async function exportCsv() {
    const saved = await getSaved();
    const headers = ["Заглавие", "Локация", "Цена EUR", "Площ", "EUR/м²", "Стаи", "Тип", "Източник", "URL"];
    const rows = saved.map((item) => [item.title, item.location, item.priceEur, item.area, item.pricePerSqm, item.rooms, item.propertyType, item.source, item.url]);
    return [headers, ...rows].map((row) => row.map(HomeLens.utils.escapeCsv).join(",")).join("\n");
  }

  HomeLens.store = { get, set, getSettings, saveSettings, getObservations, addObservation, getSaved, saveProperty, removeSaved, isPremium, exportCsv };
})(globalThis);
