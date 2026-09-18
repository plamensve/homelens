(function (root) {
  const HomeLens = root.HomeLens = root.HomeLens || {};
  const U = HomeLens.utils;

  function mortgagePayment(principal, annualRate, years) {
    if (![principal, annualRate, years].every(Number.isFinite) || principal <= 0 || years <= 0) return null;
    const months = years * 12;
    const rate = annualRate / 100 / 12;
    return rate === 0 ? principal / months : principal * rate * Math.pow(1 + rate, months) / (Math.pow(1 + rate, months) - 1);
  }

  function comparableScore(property, candidate) {
    if (!candidate || property.id === candidate.id || !candidate.pricePerSqm) return 0;
    let score = 0;
    if (property.city && U.normalizeText(property.city) === U.normalizeText(candidate.city)) score += 4;
    if (property.district && U.normalizeText(property.district) === U.normalizeText(candidate.district)) score += 4;
    if (property.propertyType === candidate.propertyType) score += 2;
    if (property.rooms && property.rooms === candidate.rooms) score += 2;
    if (property.area && candidate.area) score += Math.max(0, 3 - Math.abs(property.area - candidate.area) / 15);
    return score;
  }

  function findComparables(property, observations, limit = 12) {
    const latest = new Map();
    for (const item of observations || []) {
      if (!item?.id || !item.pricePerSqm) continue;
      const current = latest.get(item.id);
      if (!current || current.observedAt < item.observedAt) latest.set(item.id, item);
    }
    return [...latest.values()]
      .map((item) => ({ ...item, comparableScore: comparableScore(property, item) }))
      .filter((item) => item.comparableScore >= 5)
      .sort((a, b) => b.comparableScore - a.comparableScore)
      .slice(0, limit);
  }

  function marketVerdict(deltaPercent, count) {
    if (!count) return { key: "unknown", label: "Недостатъчно данни", tone: "neutral" };
    if (deltaPercent <= -10) return { key: "low", label: "Под пазарното ниво", tone: "positive" };
    if (deltaPercent >= 10) return { key: "high", label: "Над пазарното ниво", tone: "negative" };
    return { key: "fair", label: "Близо до пазарното ниво", tone: "positive" };
  }

  function analyzeProperty(property, observations = [], settings = {}) {
    const config = { ...HomeLens.CONFIG.DEFAULTS, ...settings };
    const comparables = findComparables(property, observations);
    const relistedCandidates = [...new Map((observations || [])
      .filter((item) => item.id !== property.id && item.fingerprint === property.fingerprint)
      .map((item) => [item.id, item])).values()];
    const marketPricePerSqm = U.median(comparables.map((item) => item.pricePerSqm));
    const estimatedMarketPrice = marketPricePerSqm && property.area ? marketPricePerSqm * property.area : null;
    const deltaPercent = marketPricePerSqm && property.pricePerSqm
      ? (property.pricePerSqm - marketPricePerSqm) / marketPricePerSqm * 100
      : null;
    const downPayment = property.priceEur * config.downPaymentPercent / 100;
    const principal = Math.max(0, property.priceEur - downPayment);
    const acquisitionCosts = property.priceEur * config.acquisitionCostsPercent / 100;
    const renovation = (property.area || 0) * config.renovationPerSqm;
    const monthlyMortgage = mortgagePayment(principal, config.annualInterestRate, config.mortgageYears);
    const monthlyRent = Number(settings.monthlyRent) || null;
    const annualNetRent = monthlyRent
      ? monthlyRent * 12 * (1 - config.vacancyPercent / 100) - property.priceEur * config.annualMaintenancePercent / 100
      : null;
    const totalInvestment = property.priceEur + acquisitionCosts + renovation;
    const grossYield = monthlyRent ? monthlyRent * 12 / totalInvestment * 100 : null;
    const netYield = annualNetRent ? annualNetRent / totalInvestment * 100 : null;

    return {
      pricePerSqm: property.pricePerSqm,
      comparables,
      relistedCandidates,
      marketPricePerSqm,
      estimatedMarketPrice,
      deltaPercent,
      verdict: marketVerdict(deltaPercent, comparables.length),
      downPayment,
      principal,
      monthlyMortgage,
      acquisitionCosts,
      renovation,
      totalInvestment,
      monthlyRent,
      grossYield,
      netYield
    };
  }

  function findHistory(propertyId, observations) {
    return (observations || [])
      .filter((item) => item.id === propertyId)
      .sort((a, b) => new Date(a.observedAt) - new Date(b.observedAt));
  }

  function priceChange(history) {
    if (!history || history.length < 2) return null;
    const first = history[0].priceEur;
    const latest = history[history.length - 1].priceEur;
    if (!first || !latest) return null;
    return { amount: latest - first, percent: (latest - first) / first * 100 };
  }

  HomeLens.analyzer = { mortgagePayment, comparableScore, findComparables, analyzeProperty, findHistory, priceChange };
})(globalThis);
