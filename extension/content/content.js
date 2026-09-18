(async function () {
  if (window.top !== window || document.getElementById("homelens-launcher")) return;

  const property = HomeLens.extractor.extractProperty(document, location);
  if (!property.isLikelyListing) return;
  const observations = await HomeLens.store.addObservation(property);
  const settings = await HomeLens.store.getSettings();
  const premium = await HomeLens.store.isPremium();
  const freeCutoff = Date.now() - HomeLens.CONFIG.FREE_HISTORY_DAYS * 86400000;
  const visibleObservations = premium ? observations : observations.filter((item) => new Date(item.observedAt).getTime() >= freeCutoff);
  const analysis = HomeLens.analyzer.analyzeProperty(property, visibleObservations, settings);
  const history = HomeLens.analyzer.findHistory(property.id, visibleObservations);
  const change = HomeLens.analyzer.priceChange(history);

  const launcher = document.createElement("button");
  launcher.id = "homelens-launcher";
  launcher.type = "button";
  launcher.innerHTML = `<span class="hl-launcher-icon">⌂</span><span><strong>HomeLens</strong><small>${HomeLens.utils.formatMoney(property.pricePerSqm, "EUR", 0)}/м²</small></span>`;
  launcher.setAttribute("aria-label", "Отвори HomeLens анализа");

  const panel = document.createElement("aside");
  panel.id = "homelens-panel";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <div class="hl-panel-head">
      <div><span class="hl-kicker">БЪРЗ АНАЛИЗ</span><h2>HomeLens</h2></div>
      <button type="button" id="hl-close" aria-label="Затвори">×</button>
    </div>
    <div class="hl-panel-price">
      <span>Цена на квадратен метър</span>
      <strong>${HomeLens.utils.formatMoney(property.pricePerSqm, "EUR", 0)}<small>/м²</small></strong>
    </div>
    <div class="hl-panel-grid">
      <div><span>Площ</span><strong>${HomeLens.utils.formatNumber(property.area, 1)} м²</strong></div>
      <div><span>Ипотека от</span><strong>${HomeLens.utils.formatMoney(analysis.monthlyMortgage, "EUR", 0)}/мес.</strong></div>
    </div>
    <div class="hl-verdict hl-${analysis.verdict.tone}">
      <span class="hl-dot"></span><div><strong>${analysis.verdict.label}</strong><small>${analysis.comparables.length ? `${analysis.comparables.length} локални сравнения` : "Събирай обяви, за да подобриш оценката"}</small></div>
    </div>
    ${change ? `<p class="hl-change">Промяна от първото засичане: <strong>${change.percent > 0 ? "+" : ""}${change.percent.toFixed(1)}%</strong></p>` : ""}
    <button id="hl-save" class="hl-primary" type="button">Запази имота</button>
    <p id="hl-status" role="status"></p>
    <p class="hl-disclaimer">Оценката е ориентировъчна и не представлява професионална оценка или финансов съвет.</p>`;

  document.documentElement.append(launcher, panel);
  const close = () => { panel.classList.remove("hl-open"); panel.setAttribute("aria-hidden", "true"); };
  launcher.addEventListener("click", () => { panel.classList.toggle("hl-open"); panel.setAttribute("aria-hidden", String(!panel.classList.contains("hl-open"))); });
  panel.querySelector("#hl-close").addEventListener("click", close);
  panel.querySelector("#hl-save").addEventListener("click", async () => {
    const result = await HomeLens.store.saveProperty(property);
    const status = panel.querySelector("#hl-status");
    if (result.ok) status.textContent = result.alreadySaved ? "Имотът вече е запазен." : "Имотът е запазен.";
    else status.textContent = `Безплатният план позволява ${HomeLens.CONFIG.FREE_SAVED_LIMIT} имота. Отвори HomeLens за Premium.`;
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_PROPERTY") {
      sendResponse({ property, analysis, history, change });
    }
  });
})();
