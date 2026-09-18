(function (root) {
  const HomeLens = root.HomeLens = root.HomeLens || {};

  function normalizeSpace(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function normalizeText(value) {
    return normalizeSpace(value).toLocaleLowerCase("bg-BG");
  }

  function parseNumber(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const text = normalizeSpace(value).replace(/[^\d.,-]/g, "");
    if (!text) return null;
    let normalized = text;
    const comma = normalized.lastIndexOf(",");
    const dot = normalized.lastIndexOf(".");
    if (comma > dot) normalized = normalized.replace(/\./g, "").replace(",", ".");
    else normalized = normalized.replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseMoney(value) {
    const text = normalizeSpace(value);
    const amount = parseNumber(text);
    if (amount === null) return null;
    const currency = /лв|bgn/i.test(text) ? "BGN" : /\$|usd/i.test(text) ? "USD" : "EUR";
    return { amount, currency };
  }

  function toEuro(amount, currency) {
    if (!Number.isFinite(amount)) return null;
    if (currency === "BGN") return amount / 1.95583;
    return amount;
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function average(values) {
    const valid = values.filter(Number.isFinite);
    return valid.length ? valid.reduce((sum, item) => sum + item, 0) / valid.length : null;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatMoney(value, currency = "EUR", digits = 0) {
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("bg-BG", {
      style: "currency",
      currency,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    }).format(value);
  }

  function formatNumber(value, digits = 0) {
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("bg-BG", { maximumFractionDigits: digits }).format(value);
  }

  function cleanUrl(value) {
    try {
      const url = new URL(value);
      ["utm_source", "utm_medium", "utm_campaign", "fbclid", "gclid"].forEach((key) => url.searchParams.delete(key));
      url.hash = "";
      return url.toString();
    } catch {
      return String(value || "");
    }
  }

  function hashString(value) {
    let hash = 2166136261;
    for (const char of String(value || "")) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function escapeCsv(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  HomeLens.utils = {
    normalizeSpace,
    normalizeText,
    parseNumber,
    parseMoney,
    toEuro,
    median,
    average,
    clamp,
    formatMoney,
    formatNumber,
    cleanUrl,
    hashString,
    escapeCsv
  };
})(globalThis);

