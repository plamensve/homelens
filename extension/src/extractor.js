(function (root) {
  const HomeLens = root.HomeLens = root.HomeLens || {};
  const U = HomeLens.utils;

  const SELECTORS = {
    "imot.bg": {
      title: ["h1", ".title", "[itemprop='name']"],
      price: [".price", "[class*='price']", "[itemprop='price']"],
      location: [".location", "[class*='location']", ".adParams .location"],
      description: [".description", "[class*='description']", "[itemprop='description']"]
    },
    "homes.bg": {
      title: ["h1", ".property-title", "[itemprop='name']"],
      price: [".price", ".offer-price", "[itemprop='price']"],
      location: [".location", ".address", "[itemprop='address']"],
      description: [".description", ".offer-description", "[itemprop='description']"]
    },
    "olx.bg": {
      title: ["h1", "[data-cy='ad_title']"],
      price: ["[data-testid='ad-price-container']", "h3", "[class*='price']"],
      location: ["[data-testid='location-date']", "[class*='location']"],
      description: ["[data-cy='ad_description']", "[data-testid='ad-description']"]
    }
  };

  function hostKey(hostname) {
    return HomeLens.CONFIG.SUPPORTED_HOSTS.find((host) => hostname === host || hostname.endsWith(`.${host}`)) || "generic";
  }

  function firstText(doc, selectors = []) {
    for (const selector of selectors) {
      const node = doc.querySelector(selector);
      const content = node?.getAttribute?.("content") || node?.textContent;
      if (U.normalizeSpace(content)) return U.normalizeSpace(content);
    }
    return "";
  }

  function firstMeta(doc, selectors = []) {
    for (const selector of selectors) {
      const content = doc.querySelector(selector)?.getAttribute("content");
      if (content) return U.normalizeSpace(content);
    }
    return "";
  }

  function flattenJsonLd(value, output = []) {
    if (!value) return output;
    if (Array.isArray(value)) value.forEach((item) => flattenJsonLd(item, output));
    else if (typeof value === "object") {
      output.push(value);
      if (value["@graph"]) flattenJsonLd(value["@graph"], output);
    }
    return output;
  }

  function readJsonLd(doc) {
    const values = [];
    for (const script of doc.querySelectorAll("script[type='application/ld+json']")) {
      try {
        flattenJsonLd(JSON.parse(script.textContent), values);
      } catch {
        // Невалидният JSON-LD не трябва да блокира анализа.
      }
    }
    const types = ["Product", "Offer", "Apartment", "House", "Residence", "RealEstateListing"];
    return values.find((item) => types.some((type) => [].concat(item["@type"] || []).includes(type))) || values[0] || {};
  }

  function findMatch(text, patterns) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match;
    }
    return null;
  }

  function extractArea(text) {
    const match = findMatch(text, [
      /(?:площ|застроена площ|квадратура)\D{0,20}(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:м²|m²|кв\.?\s*м)/i,
      /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:м²|m²|кв\.?\s*м)/i
    ]);
    return match ? U.parseNumber(match[1]) : null;
  }

  function extractRooms(text, title) {
    const source = `${title} ${text}`;
    const numeric = source.match(/(\d)\s*[- ]?ста(?:ен|йни)/i);
    if (numeric) return Number(numeric[1]);
    const names = [
      ["едностаен", 1], ["двустаен", 2], ["тристаен", 3],
      ["четиристаен", 4], ["многостаен", 5], ["студио", 1]
    ];
    return names.find(([name]) => U.normalizeText(source).includes(name))?.[1] || null;
  }

  function extractPropertyType(text, title) {
    const source = U.normalizeText(`${title} ${text}`);
    if (/къща|вила|house/.test(source)) return "Къща";
    if (/парцел|земя|plot/.test(source)) return "Парцел";
    if (/гараж|паркомясто/.test(source)) return "Гараж";
    if (/офис|магазин|склад|бизнес/.test(source)) return "Бизнес имот";
    return "Апартамент";
  }

  function extractFloor(text) {
    const match = findMatch(text, [/(?:етаж|ет\.)\s*[:\-]?\s*(\d{1,2})\s*(?:\/|от)\s*(\d{1,2})/i, /(?:етаж|ет\.)\s*[:\-]?\s*(\d{1,2})/i]);
    return match ? { current: Number(match[1]), total: match[2] ? Number(match[2]) : null } : null;
  }

  function extractPublishedAt(text, ld) {
    const schemaDate = ld.datePosted || ld.datePublished || ld.uploadDate;
    if (schemaDate && !Number.isNaN(new Date(schemaDate).getTime())) return new Date(schemaDate).toISOString();
    const match = text.match(/(?:публикувана|публикувано|добавена|добавено)\D{0,20}(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/i);
    if (!match) return null;
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function normalizeLocation(value, title) {
    let location = U.normalizeSpace(value);
    if (!location) {
      const match = title.match(/(?:в|гр\.)\s+([^,|–-]+(?:,\s*[^,|–-]+)?)/i);
      location = match?.[1] || "";
    }
    return location.replace(/покажи на картата/ig, "").trim();
  }

  function extractPrice(doc, schema, ld, fullText) {
    const offer = ld.offers || ld;
    const candidates = [
      offer?.price ? `${offer.price} ${offer.priceCurrency || ""}` : "",
      ld.price ? `${ld.price} ${ld.priceCurrency || ""}` : "",
      firstMeta(doc, ["meta[property='product:price:amount']", "meta[itemprop='price']"]),
      firstText(doc, schema.price)
    ].filter(Boolean);
    for (const candidate of candidates) {
      const money = U.parseMoney(candidate);
      if (money && money.amount >= 1000) return money;
    }
    const fallback = fullText.match(/(?:цена\s*[:\-]?\s*)?(\d[\d\s.,]{2,})\s*(€|EUR|лв\.?|BGN)/i);
    return fallback ? U.parseMoney(`${fallback[1]} ${fallback[2]}`) : null;
  }

  function extractProperty(doc = document, locationObj = location) {
    const host = hostKey(locationObj.hostname);
    const schema = SELECTORS[host] || { title: ["h1"], price: ["[itemprop='price']"], location: ["[itemprop='address']"], description: ["[itemprop='description']"] };
    const ld = readJsonLd(doc);
    const fullText = U.normalizeSpace(doc.body?.innerText || "").slice(0, 150000);
    const title = U.normalizeSpace(ld.name || firstMeta(doc, ["meta[property='og:title']"]) || firstText(doc, schema.title) || doc.title);
    const description = U.normalizeSpace(ld.description || firstMeta(doc, ["meta[name='description']"]) || firstText(doc, schema.description));
    const address = ld.address;
    const ldLocation = typeof address === "object" ? [address.addressLocality, address.streetAddress].filter(Boolean).join(", ") : address;
    const locationText = normalizeLocation(ldLocation || firstText(doc, schema.location), title);
    const money = extractPrice(doc, schema, ld, fullText);
    const area = U.parseNumber(ld.floorSize?.value || ld.floorSize) || extractArea(`${title} ${description} ${fullText.slice(0, 30000)}`);
    const canonical = doc.querySelector("link[rel='canonical']")?.href || locationObj.href;
    const url = U.cleanUrl(canonical);
    const image = [].concat(ld.image || [])[0] || firstMeta(doc, ["meta[property='og:image']"]);
    const priceEur = money ? U.toEuro(money.amount, money.currency) : null;

    const publishedAt = extractPublishedAt(fullText.slice(0, 50000), ld);
    const property = {
      id: `${host}:${U.hashString(url)}`,
      source: host,
      url,
      title,
      description: description.slice(0, 5000),
      location: locationText,
      city: locationText.split(",")[0]?.trim() || "",
      district: locationText.split(",").slice(1).join(",").trim(),
      price: money?.amount || null,
      currency: money?.currency || "EUR",
      priceEur,
      area,
      pricePerSqm: priceEur && area ? priceEur / area : null,
      rooms: extractRooms(fullText.slice(0, 40000), title),
      propertyType: extractPropertyType(fullText.slice(0, 40000), title),
      floor: extractFloor(fullText.slice(0, 40000)),
      publishedAt,
      daysOnline: publishedAt ? Math.max(0, Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86400000)) : null,
      image,
      observedAt: new Date().toISOString(),
      fingerprint: ""
    };
    property.fingerprint = U.hashString([
      U.normalizeText(property.location), property.propertyType,
      property.rooms || "", Math.round((property.area || 0) / 5) * 5
    ].join("|"));
    property.isLikelyListing = Boolean(property.priceEur && property.area && property.title);
    return property;
  }

  HomeLens.extractor = { extractProperty, extractArea, extractRooms, extractPropertyType, extractPublishedAt, hostKey };
})(globalThis);
