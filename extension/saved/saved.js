(async function () {
  const $ = (selector) => document.querySelector(selector);
  let saved = await HomeLens.store.getSaved();
  const premium = await HomeLens.store.isPremium();

  function downloadCsv(csv) {
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "homelens-imoti.csv"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function createCard(item) {
    const element = document.createElement("article");
    element.className = "card";
    element.innerHTML = `<div class="card-image"></div><div class="card-body"><span class="card-source"></span><h2></h2><p class="card-location"></p><div class="card-price"><strong></strong><span></span></div><div class="facts"><div><span>Площ</span><strong>${HomeLens.utils.formatNumber(item.area, 1)} м²</strong></div><div><span>Стаи</span><strong>${item.rooms || "—"}</strong></div><div><span>Тип</span><strong class="type"></strong></div></div><div class="card-actions"><a target="_blank" rel="noreferrer">Отвори обявата</a><button type="button" title="Премахни">✕</button></div></div>`;
    element.querySelector(".card-source").textContent = item.source;
    element.querySelector("h2").textContent = item.title;
    element.querySelector(".card-location").textContent = item.location || "Локация не е разпозната";
    element.querySelector(".card-price strong").textContent = HomeLens.utils.formatMoney(item.priceEur, "EUR", 0);
    element.querySelector(".card-price span").textContent = `${HomeLens.utils.formatMoney(item.pricePerSqm, "EUR", 0)}/м²`;
    element.querySelector(".type").textContent = item.propertyType || "—";
    element.querySelector("a").href = item.url;
    if (item.image) element.querySelector(".card-image").style.backgroundImage = `url(${JSON.stringify(item.image).slice(1, -1)})`;
    element.querySelector("button").addEventListener("click", async () => { saved = await HomeLens.store.removeSaved(item.id); render(); });
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

  render();
  $("#free-note").classList.toggle("hidden", premium);
  $("#sort").addEventListener("change", render);
  $("#settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("#export").addEventListener("click", async () => premium ? downloadCsv(await HomeLens.store.exportCsv()) : alert("CSV експортът е Premium функция."));
})();
