(async function () {
  const $ = (selector) => document.querySelector(selector);
  let current = null;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  function show(selector) { $(selector).classList.remove("hidden"); }
  function hide(selector) { $(selector).classList.add("hidden"); }
  function setText(selector, value) { $(selector).textContent = value; }

  async function loadPremiumState() {
    const premium = await HomeLens.store.isPremium();
    $("#premium-locked").classList.toggle("hidden", premium);
    $("#premium-active").classList.toggle("hidden", !premium);
    if (premium && current) {
      setText("#premium-market-price", HomeLens.utils.formatMoney(current.analysis.estimatedMarketPrice, "EUR", 0));
      setText("#premium-investment", HomeLens.utils.formatMoney(current.analysis.totalInvestment, "EUR", 0));
      setText("#premium-gross-yield", current.analysis.grossYield ? `${current.analysis.grossYield.toFixed(2)}%` : "Добави наем");
      setText("#premium-net-yield", current.analysis.netYield ? `${current.analysis.netYield.toFixed(2)}%` : "Добави наем");
    }
    return premium;
  }

  function render(result) {
    current = result;
    const { property, analysis, history, change } = result;
    hide("#loading"); show("#analysis-view");
    setText("#source-badge", property.source);
    setText("#property-title", property.title);
    setText("#property-location", property.location || "Локацията не е разпозната");
    setText("#price-sqm", `${HomeLens.utils.formatMoney(property.pricePerSqm, "EUR", 0)}/м²`);
    setText("#total-price", HomeLens.utils.formatMoney(property.priceEur, "EUR", 0));
    setText("#area", `${HomeLens.utils.formatNumber(property.area, 1)} м²`);
    setText("#mortgage", `${HomeLens.utils.formatMoney(analysis.monthlyMortgage, "EUR", 0)}/мес.`);
    setText("#mortgage-note", `${HomeLens.CONFIG.DEFAULTS.mortgageYears} г. • ${HomeLens.CONFIG.DEFAULTS.annualInterestRate}%`);
    setText("#initial-costs", HomeLens.utils.formatMoney(analysis.downPayment + analysis.acquisitionCosts, "EUR", 0));
    if (Number.isFinite(property.daysOnline)) setText("#initial-note", `обявата е онлайн от ${property.daysOnline} дни`);
    setText("#market-verdict", analysis.verdict.label);
    setText("#market-note", analysis.relistedCandidates?.length ? `Възможно повторно публикуване • ${analysis.comparables.length} сравнения` : analysis.comparables.length ? `${analysis.comparables.length} подходящи локални сравнения` : "Запази и разгледай още обяви в същия район");
    $("#market-card").classList.add(analysis.verdict.tone);
    if (change) {
      show("#price-history");
      setText("#history-change", `${change.percent > 0 ? "+" : ""}${change.percent.toFixed(1)}%`);
      setText("#history-note", `${history.length} наблюдения`);
    }
    loadPremiumState();
  }

  try {
    const result = await chrome.tabs.sendMessage(tab.id, { type: "GET_PROPERTY" });
    if (!result?.property?.isLikelyListing) throw new Error("not-listing");
    render(result);
  } catch {
    hide("#loading"); show("#unsupported");
  }

  $("#open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("#open-saved").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("saved/saved.html") }));
  $("#open-listing").addEventListener("click", () => current && chrome.tabs.update(tab.id, { url: current.property.url }));
  $("#save-property").addEventListener("click", async () => {
    if (!current) return;
    const result = await HomeLens.store.saveProperty(current.property);
    setText("#action-status", result.ok ? (result.alreadySaved ? "Имотът вече е запазен." : "Имотът е запазен.") : `Достигна лимита от ${HomeLens.CONFIG.FREE_SAVED_LIMIT} имота.`);
    if (!result.ok) show("#license-form");
  });

  $("#upgrade-monthly").addEventListener("click", () => {
    const url = HomeLens.CONFIG.PREMIUM_CHECKOUT_URL;
    if (url) chrome.tabs.create({ url });
    else { show("#license-form"); setText("#license-status", "Premium продажбите ще бъдат активирани скоро."); }
  });
  $("#upgrade-30-day").addEventListener("click", () => {
    const url = HomeLens.CONFIG.THIRTY_DAY_CHECKOUT_URL;
    if (url) chrome.tabs.create({ url });
    else { show("#license-form"); setText("#license-status", "30-дневният план ще бъде активиран скоро."); }
  });
  $("#activate-license").addEventListener("click", () => show("#license-form"));
  $("#close-license").addEventListener("click", () => hide("#license-form"));
  $("#verify-license").addEventListener("click", async () => {
    setText("#license-status", "Проверка…");
    const result = await chrome.runtime.sendMessage({ type: "VALIDATE_LICENSE", licenseKey: $("#license-key").value });
    setText("#license-status", result.valid ? "Premium е активиран успешно." : result.error);
    if (result.valid) { await loadPremiumState(); setTimeout(() => hide("#license-form"), 800); }
  });
  $("#export-csv").addEventListener("click", async () => {
    const csv = await HomeLens.store.exportCsv();
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "homelens-imoti.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("#privacy-link").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("privacy.html") }));
})();
