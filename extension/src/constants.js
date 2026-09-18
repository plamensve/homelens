(function (root) {
  const HomeLens = root.HomeLens = root.HomeLens || {};

  HomeLens.CONFIG = Object.freeze({
    APP_NAME: "HomeLens",
    FREE_SAVED_LIMIT: 5,
    FREE_HISTORY_DAYS: 30,
    LICENSE_CACHE_HOURS: 24,
    SUPPORTED_HOSTS: ["imot.bg", "homes.bg", "olx.bg"],

    // Попълни след създаването на продуктите в Lemon Squeezy.
    // Пример: https://homelens.lemonsqueezy.com/buy/xxxxxxxx
    PREMIUM_CHECKOUT_URL: "",
    THIRTY_DAY_CHECKOUT_URL: "",
    LEMON_SQUEEZY_PRODUCT_IDS: [],

    DEFAULTS: {
      annualInterestRate: 3.2,
      mortgageYears: 25,
      downPaymentPercent: 20,
      acquisitionCostsPercent: 4.5,
      renovationPerSqm: 120,
      vacancyPercent: 8,
      annualMaintenancePercent: 1
    }
  });

  HomeLens.STORAGE_KEYS = Object.freeze({
    SETTINGS: "hl_settings",
    OBSERVATIONS: "hl_observations",
    SAVED: "hl_saved",
    LICENSE: "hl_license",
    LICENSE_CACHE: "hl_license_cache"
  });
})(globalThis);

