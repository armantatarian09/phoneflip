export const iphoneGenerations = ["6", "6s", "7", "8", "x", "xr", "xs", "11", "12", "13", "14", "15", "16", "17"];

export const iphoneVariants = ["base", "mini", "Plus", "Pro", "Pro Max"];

export const storageOptions = ["64", "128", "256", "512", "1024"];

export const damageTypes = [
  { id: "screen", label: "Skärm" },
  { id: "backGlass", label: "Baksida" },
  { id: "battery", label: "Batteri" },
  { id: "chargingPort", label: "Laddport" },
  { id: "faceId", label: "Face ID" },
  { id: "water", label: "Vattenskada" },
  { id: "motherboard", label: "Moderkort" },
  { id: "locked", label: "Låst/iCloud" },
  { id: "parts", label: "Reservdelar" },
  { id: "unknown", label: "Okänt fel" }
];

const baseResaleValues = {
  6: 450,
  "6s": 550,
  7: 700,
  8: 1100,
  x: 1300,
  xr: 1200,
  xs: 1500,
  11: 1500,
  12: 2000,
  13: 2500,
  14: 2900,
  15: 3400,
  16: 5200,
  17: 7000
};

const defaultRepairByGeneration = {
  6: { screen: 650, backGlass: 350, battery: 400, chargingPort: 450, faceId: 0, water: 1200, motherboard: 1600, locked: 250, parts: 450, unknown: 600 },
  "6s": { screen: 700, backGlass: 375, battery: 425, chargingPort: 475, faceId: 0, water: 1300, motherboard: 1650, locked: 250, parts: 500, unknown: 650 },
  7: { screen: 800, backGlass: 400, battery: 450, chargingPort: 500, faceId: 0, water: 1400, motherboard: 1750, locked: 250, parts: 550, unknown: 700 },
  8: { screen: 950, backGlass: 550, battery: 600, chargingPort: 700, faceId: 0, water: 1700, motherboard: 1900, locked: 250, parts: 700, unknown: 800 },
  x: { screen: 1000, backGlass: 600, battery: 700, chargingPort: 750, faceId: 1000, water: 1800, motherboard: 2100, locked: 250, parts: 700, unknown: 800 },
  xr: { screen: 1100, backGlass: 650, battery: 750, chargingPort: 800, faceId: 1100, water: 1850, motherboard: 2150, locked: 250, parts: 750, unknown: 850 },
  xs: { screen: 1100, backGlass: 700, battery: 800, chargingPort: 850, faceId: 1200, water: 1900, motherboard: 2250, locked: 250, parts: 800, unknown: 900 },
  11: { screen: 850, backGlass: 450, battery: 550, chargingPort: 650, faceId: 900, water: 1600, motherboard: 1800, locked: 250, parts: 650, unknown: 750 },
  12: { screen: 950, backGlass: 550, battery: 600, chargingPort: 700, faceId: 1000, water: 1700, motherboard: 1900, locked: 250, parts: 700, unknown: 800 },
  13: { screen: 1050, backGlass: 650, battery: 650, chargingPort: 750, faceId: 1100, water: 1800, motherboard: 2100, locked: 250, parts: 750, unknown: 850 },
  14: { screen: 1200, backGlass: 750, battery: 700, chargingPort: 800, faceId: 1200, water: 1900, motherboard: 2300, locked: 250, parts: 800, unknown: 900 },
  15: { screen: 1400, backGlass: 850, battery: 750, chargingPort: 900, faceId: 1300, water: 2100, motherboard: 2500, locked: 250, parts: 900, unknown: 1000 },
  16: { screen: 1650, backGlass: 950, battery: 850, chargingPort: 950, faceId: 1400, water: 2300, motherboard: 2800, locked: 250, parts: 1000, unknown: 1150 },
  17: { screen: 1900, backGlass: 1100, battery: 950, chargingPort: 1050, faceId: 1550, water: 2500, motherboard: 3200, locked: 250, parts: 1100, unknown: 1300 }
};

export const defaultPricingSettings = {
  version: 1,
  minProfit: 300,
  riskTolerance: "medium",
  maxOfferBuffer: 150,
  resaleValues: iphoneGenerations.reduce((values, generation) => {
    values[generation] = iphoneVariants.reduce((variants, variant) => {
      variants[variant] = baseResaleValues[generation];
      return variants;
    }, {});
    return values;
  }, {}),
  storageAdjustments: {
    64: -150,
    128: 0,
    256: 250,
    512: 450,
    1024: 650
  },
  repairCosts: defaultRepairByGeneration,
  riskPenalties: {
    highRisk: 14,
    locked: 22,
    water: 18,
    motherboard: 22,
    weakDamageSignal: 18,
    lowConfidence: 10
  }
};

export function createDefaultPricingSettings() {
  return structuredCloneSafe(defaultPricingSettings);
}

export function normalizePricingSettings(settings) {
  const defaults = createDefaultPricingSettings();
  const input = settings && typeof settings === "object" ? settings : {};

  return {
    ...defaults,
    ...input,
    resaleValues: mergeNested(defaults.resaleValues, input.resaleValues),
    storageAdjustments: { ...defaults.storageAdjustments, ...(input.storageAdjustments ?? {}) },
    repairCosts: mergeNested(defaults.repairCosts, input.repairCosts),
    riskPenalties: { ...defaults.riskPenalties, ...(input.riskPenalties ?? {}) }
  };
}

export function inferIphoneProfile(...textParts) {
  const text = textParts.filter(Boolean).join(" ");
  const normalized = text.toLocaleLowerCase("sv-SE");
  const generationMatch = normalized.match(/iphone\s?(6s|6|7|8|x|xs|xr|se|1[1-7])/i);
  const rawGeneration = generationMatch?.[1]?.toLocaleLowerCase("sv-SE") ?? "";
  const generation = iphoneGenerations.includes(rawGeneration) ? rawGeneration : "";
  const variant = inferVariant(normalized);
  const storage = inferStorage(normalized);
  const batteryHealth = inferBatteryHealth(normalized);

  return {
    generation,
    variant,
    storage,
    batteryHealth,
    label: generation ? `iPhone ${generation}${variant === "base" ? "" : ` ${variant}`}` : "iPhone"
  };
}

export function detectDamageTypes(...textParts) {
  const text = textParts.filter(Boolean).join(" ").toLocaleLowerCase("sv-SE");
  const matches = [];

  if (/(skärm|skarm|display|screen|glas|touch|sprick|krossad|cracked|frontglas|linjer|pixlar)/i.test(text)) matches.push("screen");
  if (/(baksida|bakglas|back glass|back cracked)/i.test(text)) matches.push("backGlass");
  if (/(batteri|battery|batterihälsa|batterihalsa|service batteri)/i.test(text)) matches.push("battery");
  if (/(ladd|charge|charging|laddport|laddkontakt|ladduttag)/i.test(text)) matches.push("chargingPort");
  if (/(face id|faceid)/i.test(text)) matches.push("faceId");
  if (/(vatten|vattenskad|water|liquid|fukt)/i.test(text)) matches.push("water");
  if (/(moderkort|baseband|ingen service|ingen täckning|ingen tackning|kretskort|motherboard)/i.test(text)) matches.push("motherboard");
  if (/(icloud|activation lock|aktiveringslås|aktiveringslas|kodlåst|kodlast|operatörslåst|operatorlast|simlåst|simlast|passcode|locked)/i.test(text)) matches.push("locked");
  if (/(reservdel|endast delar|parts only|parts|reparationsobjekt|repair object)/i.test(text)) matches.push("parts");

  return matches.length ? [...new Set(matches)] : ["unknown"];
}

export function estimateResaleValue(profile, settings) {
  const normalizedSettings = normalizePricingSettings(settings);
  const generation = profile?.generation || "13";
  const variant = profile?.variant || "base";
  const storage = profile?.storage || "128";
  const baseValue =
    normalizedSettings.resaleValues?.[generation]?.[variant] ??
    normalizedSettings.resaleValues?.[generation]?.base ??
    baseResaleValues[generation] ??
    2200;
  const storageAdjustment = Number(normalizedSettings.storageAdjustments?.[storage] ?? 0);
  return Math.max(300, Math.round(Number(baseValue) + storageAdjustment));
}

export function estimateRepairCost(profile, damages, settings) {
  const normalizedSettings = normalizePricingSettings(settings);
  const generation = profile?.generation || "13";
  const costs = normalizedSettings.repairCosts?.[generation] ?? normalizedSettings.repairCosts?.["13"] ?? {};
  const selectedDamages = Array.isArray(damages) && damages.length ? damages : ["unknown"];
  const total = selectedDamages.reduce((sum, damage) => {
    return sum + Number(costs[damage] ?? costs.unknown ?? 750);
  }, 0);

  return Math.max(0, Math.round(total));
}

export function getRiskLevel(damages, text, settings) {
  const normalizedText = String(text ?? "").toLocaleLowerCase("sv-SE");
  const hasCritical =
    damages.includes("motherboard") ||
    damages.includes("water") ||
    normalizedText.includes("stulen") ||
    normalizedText.includes("stulet");
  const hasHigh = hasCritical || damages.includes("locked") || damages.includes("parts");

  if (hasCritical) return "Hög";
  if (hasHigh) return settings?.riskTolerance === "high" ? "Medel" : "Hög";
  if (damages.includes("unknown")) return "Medel";
  return "Låg";
}

export function getConfidenceScore({ title, model, sellerText, askingPrice, sourceUrl, profile, damages }) {
  let score = 30;
  const descriptionLength = String(sellerText ?? "").trim().length;

  if (profile?.generation) score += 18;
  if (model && String(model).length > 5) score += 10;
  if (Number(askingPrice) > 0) score += 12;
  if (descriptionLength > 40) score += 14;
  if (descriptionLength > 140) score += 8;
  if (sourceUrl) score += 5;
  if (damages?.length && !damages.includes("unknown")) score += 12;
  if (!title || String(title).length < 8) score -= 12;

  return clamp(Math.round(score), 0, 100);
}

export function getRecommendation({ estimatedProfit, riskLevel, confidenceScore, settings }) {
  const minProfit = Number(settings?.minProfit ?? defaultPricingSettings.minProfit);

  if (riskLevel === "Hög" && confidenceScore < 70) return "Undvik";
  if (estimatedProfit >= minProfit * 2 && riskLevel !== "Hög" && confidenceScore >= 70) return "Köp-kandidat";
  if (estimatedProfit >= minProfit && confidenceScore >= 55) return "Förhandla";
  if (estimatedProfit >= 0 && riskLevel !== "Hög") return "Bevaka";
  return "Skippa";
}

export function getMaxOffer({ resaleValue, repairEstimate, settings }) {
  const minProfit = Number(settings?.minProfit ?? defaultPricingSettings.minProfit);
  const buffer = Number(settings?.maxOfferBuffer ?? defaultPricingSettings.maxOfferBuffer);
  return Math.max(0, Math.round(Number(resaleValue) - Number(repairEstimate) - minProfit - buffer));
}

function inferVariant(normalized) {
  if (/pro\s?max|promax/.test(normalized)) return "Pro Max";
  if (/\bpro\b/.test(normalized)) return "Pro";
  if (/\bplus\b/.test(normalized)) return "Plus";
  if (/\bmini\b/.test(normalized)) return "mini";
  return "base";
}

function inferStorage(normalized) {
  const match = normalized.match(/\b(64|128|256|512)\s?gb\b|\b(1)\s?tb\b/i);
  if (!match) return "128";
  if (match[2] === "1") return "1024";
  return match[1];
}

function inferBatteryHealth(normalized) {
  const match = normalized.match(/(\d{2,3})\s?%\s?(?:batteri|battery|bh|hälsa|halsa)?/i);
  if (!match) return "";
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 50 && value <= 100 ? value : "";
}

function mergeNested(defaults, overrides = {}) {
  return Object.entries(defaults).reduce((result, [key, value]) => {
    result[key] = {
      ...value,
      ...(overrides?.[key] ?? {})
    };
    return result;
  }, {});
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
