(async function () {
  const $ = (selector) => document.querySelector(selector);
  let saved = await HomeLens.store.getSaved();
  const premium = await HomeLens.store.isPremium();
  const settingFields = ["annualInterestRate", "mortgageYears", "downPaymentPercent", "acquisitionCostsPercent", "renovationPerSqm", "monthlyRent", "vacancyPercent", "annualMaintenancePercent"];
  const calculatorSettings = await HomeLens.store.getSettings();

  function downloadCsv(csv) {
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "homelens-imoti.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function createCard(item) {
    const element = document.createElement("article");
    element.className = "card";
    element.innerHTML = `<div class="card-image"><img class="card-photo" alt=""><span class="no-image">⌂</span><button class="gallery-arrow gallery-prev hidden" type="button" aria-label="Предишна снимка">‹</button><button class="gallery-arrow gallery-next hidden" type="button" aria-label="Следваща снимка">›</button><span class="gallery-count"></span></div><div class="card-body"><span class="card-source"></span><h2></h2><p class="card-location"></p><div class="card-price"><strong></strong><span></span></div><div class="facts"><div><span>Площ</span><strong>${HomeLens.utils.formatNumber(item.area, 1)} м²</strong></div><div><span>Стаи</span><strong>${item.rooms || "—"}</strong></div><div><span>Тип</span><strong class="type"></strong></div></div><div class="card-actions"><a target="_blank" rel="noreferrer">Отвори обявата</a><button type="button" title="Премахни">✕</button></div></div>`;
    element.querySelector(".card-source").textContent = item.source;
    element.querySelector("h2").textContent = item.title;
    element.querySelector(".card-location").textContent = item.location || "Локация не е разпозната";
    element.querySelector(".card-price strong").textContent = HomeLens.utils.formatMoney(item.priceEur, "EUR", 0);
    element.querySelector(".card-price span").textContent = `${HomeLens.utils.formatMoney(item.pricePerSqm, "EUR", 0)}/м²`;
    element.querySelector(".type").textContent = item.propertyType || "—";
    element.querySelector("a").href = item.url;
    const images = [...new Set([...(Array.isArray(item.images) ? item.images : []), item.image].filter((value) => {
      try { return /^https?:$/.test(new URL(value).protocol); } catch { return false; }
    }))];
    const photo = element.querySelector(".card-photo");
    const counter = element.querySelector(".gallery-count");
    const previous = element.querySelector(".gallery-prev");
    const next = element.querySelector(".gallery-next");
    let imageIndex = 0;
    const renderImage = () => {
      if (images.length) photo.src = images[imageIndex];
      else photo.removeAttribute("src");
      counter.textContent = images.length > 1 ? `${imageIndex + 1}/${images.length}` : "";
      previous.classList.toggle("hidden", images.length < 2);
      next.classList.toggle("hidden", images.length < 2);
    };
    photo.addEventListener("load", () => element.querySelector(".card-image").classList.add("has-image"));
    photo.addEventListener("error", () => element.querySelector(".card-image").classList.remove("has-image"));
    previous.addEventListener("click", (event) => { event.stopPropagation(); imageIndex = (imageIndex - 1 + images.length) % images.length; renderImage(); });
    next.addEventListener("click", (event) => { event.stopPropagation(); imageIndex = (imageIndex + 1) % images.length; renderImage(); });
    renderImage();
    element.querySelector(".card-actions button").addEventListener("click", async () => { saved = await HomeLens.store.removeSaved(item.id); render(); });
    return element;
  }

  function sorted() {
    const mode = $("#sort").value;
    return [...saved].sort((a, b) => mode === "price-asc" ? a.priceEur - b.priceEur : mode === "sqm-asc" ? a.pricePerSqm - b.pricePerSqm : mode === "area-desc" ? b.area - a.area : new Date(b.savedAt) - new Date(a.savedAt));
  }

  function render() {
    $("#properties").replaceChildren(...sorted().map(createCard));
    $("#empty").classList.toggle("hidden", saved.length > 0);
    $("#saved-count").textContent = saved.length;
    $("#average-sqm").textContent = HomeLens.utils.formatMoney(HomeLens.utils.average(saved.map((item) => item.pricePerSqm)), "EUR", 0);
    $("#average-price").textContent = HomeLens.utils.formatMoney(HomeLens.utils.average(saved.map((item) => item.priceEur)), "EUR", 0);
  }

  function readCalculatorSettings() {
    const values = {};
    settingFields.forEach((key) => { values[key] = Number(document.getElementById(key).value) || 0; });
    return values;
  }

  function renderCalculatorPreview() {
    const values = readCalculatorSettings();
    const examplePrice = 150000;
    const downPayment = examplePrice * values.downPaymentPercent / 100;
    const principal = examplePrice - downPayment;
    const payment = HomeLens.analyzer.mortgagePayment(principal, values.annualInterestRate, values.mortgageYears);
    $("#preview-down").textContent = HomeLens.utils.formatMoney(downPayment, "EUR", 0);
    $("#preview-payment").textContent = `${HomeLens.utils.formatMoney(payment, "EUR", 0)}/мес.`;
    $("#preview-costs").textContent = HomeLens.utils.formatMoney(examplePrice * values.acquisitionCostsPercent / 100, "EUR", 0);
  }

  function activateTab(name, updateHash = true) {
    const tab = name === "calculator" ? "calculator" : "saved";
    document.querySelectorAll(".tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
    $("#panel-saved").classList.toggle("hidden", tab !== "saved");
    $("#panel-calculator").classList.toggle("hidden", tab !== "calculator");
    $("#export").classList.toggle("hidden", tab !== "saved");
    if (updateHash) history.replaceState(null, "", `#${tab}`);
  }

  render();
  settingFields.forEach((key) => {
    const input = document.getElementById(key);
    input.value = calculatorSettings[key] ?? "";
    input.addEventListener("input", renderCalculatorPreview);
  });
  renderCalculatorPreview();
  $("#free-note").classList.toggle("hidden", premium);
  $("#sort").addEventListener("change", render);
  $("#export").addEventListener("click", async () => premium ? downloadCsv(await HomeLens.store.exportCsv()) : alert("CSV експортът е Premium функция."));
  document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.tab)));
  $("#save-settings").addEventListener("click", async () => {
    await HomeLens.store.saveSettings(readCalculatorSettings());
    $("#settings-status").textContent = "Настройките са запазени и ще се използват при следващия анализ.";
    $("#settings-badge").textContent = "Запазено";
    setTimeout(() => { $("#settings-badge").textContent = "Локални настройки"; }, 1800);
  });
  window.addEventListener("hashchange", () => activateTab(location.hash.slice(1), false));
  activateTab(location.hash.slice(1), false);
})();
