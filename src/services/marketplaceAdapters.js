import { conditionOptions, phoneBrands } from "../data/referenceData.js";
import { detectDefectKeywords } from "../data/keywords.js";
import {
  detectDamageTypes,
  estimateRepairCost as estimatePricingRepairCost,
  estimateResaleValue as estimatePricingResaleValue,
  inferIphoneProfile
} from "./pricing.js";
import { scoreDeals } from "./scoring.js";

const importedDealsStorageKey = "phoneflip-imported-deals";
const defaultBlocketDealsUrl =
  "http://127.0.0.1:8787/deals?limit=60&max_price=2500&details=false";
const importFieldOrder = [
  "title",
  "marketplace",
  "brand",
  "model",
  "askingPrice",
  "repairEstimate",
  "resaleValue",
  "condition",
  "location",
  "ageHours",
  "sellerRating",
  "hasBuyNow",
  "sourceUrl",
  "sellerText"
];

const imageVariants = ["mint", "blue", "amber", "violet", "steel", "rose", "lime", "cyan"];

const fieldAliases = {
  id: ["id", "listing id", "annonsid", "object id"],
  title: ["title", "rubrik", "annons", "name", "namn"],
  marketplace: ["marketplace", "marknadsplats", "source", "källa", "site", "platform"],
  brand: ["brand", "märke", "telefonmärke", "manufacturer"],
  model: ["model", "modell", "phone", "telefon"],
  askingPrice: ["askingPrice", "asking price", "price", "pris", "annonspris"],
  repairEstimate: [
    "repairEstimate",
    "repair estimate",
    "repair",
    "reparation",
    "reparationskostnad"
  ],
  resaleValue: [
    "resaleValue",
    "resale value",
    "value",
    "värde",
    "andrahandsvärde",
    "market value"
  ],
  demandScore: ["demandScore", "demand", "efterfrågan"],
  condition: ["condition", "skick", "defect", "fel", "damage", "skada"],
  location: ["location", "plats", "ort", "city", "stad"],
  ageHours: ["ageHours", "age hours", "hours", "ålder", "annonsålder"],
  publishedAt: ["publishedAt", "published", "date", "datum", "createdAt", "skapad"],
  sellerRating: ["sellerRating", "seller rating", "säljarbetyg", "betyg", "rating"],
  hasBuyNow: ["hasBuyNow", "buyNow", "buy now", "köp nu", "kop nu", "direktköp"],
  sourceUrl: ["sourceUrl", "source url", "url", "link", "annonsurl"],
  sellerText: ["sellerText", "seller text", "description", "beskrivning", "text"]
};

const aliasLookup = Object.entries(fieldAliases).reduce((lookup, [field, aliases]) => {
  aliases.forEach((alias) => {
    lookup[normalizeKey(alias)] = field;
  });
  return lookup;
}, {});

export const marketplaceAdapters = [
  {
    name: "CSV/JSON import",
    integrationType: "Aktiv datakälla i dashboarden",
    status: "active"
  },
  {
    name: "Blocket feed",
    integrationType: "Valfri lokal adapter via blocket-api.se REST-endpoints",
    status: "optional"
  },
  {
    name: "Egen API-endpoint",
    integrationType: "Sätt VITE_PHONEFLIP_DEALS_URL till ett JSON-flöde",
    status: "active"
  },
  {
    name: "Marknadsplats-API",
    integrationType: "Koppla via godkända API:er eller partnerflöden",
    status: "ready-for-integration"
  }
];

export function getImportTemplate() {
  return importFieldOrder.join(",");
}

export async function loadMarketplaceDeals(settings) {
  const endpoint = getConfiguredEndpoint();

  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(`API svarade med ${response.status}`);
      }

      const payload = await response.json();
      const records = extractRecords(payload);
      const deals = normalizeDeals(records, endpoint, settings);

      return {
        deals: scoreDeals(deals, settings),
        label: "API-data",
        message: `Läste ${deals.length} annonser från API.`
      };
    } catch (error) {
      const storedDeals = readStoredDeals(settings);

      return {
        deals: scoreDeals(storedDeals, settings),
        label: storedDeals.length ? "Lokal import" : "Ingen datakälla",
        message: storedDeals.length
          ? `API:t kunde inte läsas, visar ${storedDeals.length} lokalt importerade annonser.`
          : `API:t kunde inte läsas: ${error.message}`
      };
    }
  }

  const storedDeals = readStoredDeals(settings);

  return {
    deals: scoreDeals(storedDeals, settings),
    label: storedDeals.length ? "Lokal import" : "Väntar på import",
    message: storedDeals.length
      ? `Läste ${storedDeals.length} importerade annonser.`
      : "Importera CSV eller JSON för att fylla dashboarden."
  };
}

export function importMarketplaceDeals(input, sourceName = "Import", settings) {
  const records = parseMarketplaceDeals(input);
  const deals = normalizeDeals(records, sourceName, settings);
  writeStoredDeals(deals);

  return {
    deals: scoreDeals(deals, settings),
    label: "Lokal import",
    message: `Importerade ${deals.length} annonser.`
  };
}

export function clearImportedDeals() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(importedDealsStorageKey);
}

export function getBlocketImportStartUrl(options = {}) {
  const endpoint = getConfiguredEndpoint() || defaultBlocketDealsUrl;
  const url = new URL(endpoint, getBrowserBaseUrl());
  url.pathname = "/import/blocket/start";
  applyBlocketImportOptions(url, options);
  return url.toString();
}

export function getBlocketImportEstimateUrl(options = {}) {
  const endpoint = getConfiguredEndpoint() || defaultBlocketDealsUrl;
  const url = new URL(endpoint, getBrowserBaseUrl());
  url.pathname = "/import/blocket/estimate";
  applyBlocketImportOptions(url, options);
  return url.toString();
}

export function getBlocketImportStatusUrl(jobId, startUrl) {
  const url = new URL(startUrl, getBrowserBaseUrl());
  url.pathname = "/import/blocket/status";
  url.search = "";
  url.searchParams.set("id", jobId);
  return url.toString();
}

export function parseMarketplaceDeals(input) {
  if (Array.isArray(input)) return input;
  if (input && typeof input === "object") return extractRecords(input);

  const text = String(input ?? "").trim();

  if (!text) {
    throw new Error("Importen är tom.");
  }

  if (text.startsWith("{") || text.startsWith("[")) {
    return extractRecords(JSON.parse(text));
  }

  return parseCsv(text);
}

function extractRecords(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.deals)) return payload.deals;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  throw new Error("JSON måste vara en array eller innehålla deals, items eller results.");
}

function readStoredDeals(settings) {
  if (typeof localStorage === "undefined") return [];

  try {
    const stored = JSON.parse(localStorage.getItem(importedDealsStorageKey) ?? "[]");
    return Array.isArray(stored) ? normalizeDeals(stored, "Lokal import", settings) : [];
  } catch {
    return [];
  }
}

function writeStoredDeals(deals) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(importedDealsStorageKey, JSON.stringify(deals));
}

function getConfiguredEndpoint() {
  return import.meta.env?.VITE_PHONEFLIP_DEALS_URL?.trim() ?? "";
}

function getBrowserBaseUrl() {
  if (typeof window === "undefined") return "http://127.0.0.1:5173/";
  return window.location.href;
}

function applyBlocketImportOptions(url, options) {
  if ("limit" in options && !("pages" in options)) {
    url.searchParams.delete("pages");
  }
  if ("limit" in options && !("candidate_limit" in options)) {
    url.searchParams.delete("candidate_limit");
  }

  Object.entries(options).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = parseDelimitedRows(text, delimiter).filter((row) =>
    row.some((cell) => cell.trim())
  );

  if (rows.length < 2) {
    throw new Error("CSV måste ha en rubrikrad och minst en annonsrad.");
  }

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((row) =>
    headers.reduce((record, header, index) => {
      record[header] = row[index] ?? "";
      return record;
    }, {})
  );
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiters = [",", ";", "\t"];

  return delimiters.reduce((best, delimiter) => {
    const count = firstLine.split(delimiter).length;
    return count > firstLine.split(best).length ? delimiter : best;
  }, ",");
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function normalizeDeals(records, sourceName, settings) {
  if (!records.length) {
    throw new Error("Inga annonser hittades i importen.");
  }

  const normalizedDeals = records.map((record, index) =>
    normalizeDeal(toCanonicalRecord(record), index, sourceName, settings)
  );
  const iphoneDeals = normalizedDeals.filter(isIphoneDeal);

  if (!iphoneDeals.length) {
    throw new Error("Inga iPhone-annonser hittades i importen.");
  }

  return iphoneDeals;
}

function toCanonicalRecord(record) {
  return Object.entries(record ?? {}).reduce((canonicalRecord, [key, value]) => {
    const canonicalKey = aliasLookup[normalizeKey(key)] ?? key;
    canonicalRecord[canonicalKey] = value;
    return canonicalRecord;
  }, {});
}

function normalizeDeal(record, index, sourceName, settings) {
  const title = cleanText(record.title ?? record.model);
  const sellerText = cleanText(record.sellerText ?? record.description);
  const model = cleanText(record.model ?? extractModel(title));
  const askingPrice = parseMoney(record.askingPrice);

  if (!title) {
    throw new Error(`Rad ${index + 1} saknar title/rubrik.`);
  }

  if (!Number.isFinite(askingPrice) || askingPrice <= 0) {
    throw new Error(`Rad ${index + 1} saknar giltigt askingPrice/pris.`);
  }

  const brand = cleanText(record.brand ?? inferBrand(`${title} ${model}`));
  const condition = cleanText(record.condition ?? inferCondition(`${title} ${sellerText}`));
  const iphoneProfile = inferIphoneProfile(title, model, sellerText, condition);
  const damageTypes = detectDamageTypes(title, condition, sellerText);
  const hasStoredPricingSource = cleanText(record.pricingSource) !== "";
  const hasManualRepair = hasStoredPricingSource
    ? record.pricingSource === "manual"
    : cleanText(record.repairEstimate) !== "";
  const hasManualResale = hasStoredPricingSource
    ? record.pricingSource === "manual"
    : cleanText(record.resaleValue) !== "";
  const repairInput = hasManualRepair ? record.repairEstimate : "";
  const resaleInput = hasManualResale ? record.resaleValue : "";
  const repairEstimate = parseMoney(
    repairInput,
    estimatePricingRepairCost(iphoneProfile, damageTypes, settings)
  );
  const resaleValue = parseMoney(
    resaleInput,
    estimatePricingResaleValue(iphoneProfile, settings)
  );
  const marketplace = cleanText(record.marketplace ?? sourceName) || "Import";
  const sourceUrl = cleanText(record.sourceUrl);
  const publishedAge = getAgeHours(record.ageHours, record.publishedAt);
  const hasBuyNow = parseBoolean(record.hasBuyNow ?? record.purchaseType ?? record.shippingType, false);

  return {
    id: cleanText(record.id) || createDealId(`${sourceUrl}${title}${askingPrice}`, index),
    title,
    marketplace,
    brand,
    model: model || title,
    iphoneProfile,
    damageTypes,
    askingPrice,
    repairEstimate,
    resaleValue,
    pricingSource: hasManualRepair || hasManualResale ? "manual" : "settings",
    demandScore: parseNumber(record.demandScore, estimateDemandScore(brand, model)),
    condition,
    location: cleanText(record.location) || "Okänd plats",
    ageHours: publishedAge,
    sellerRating: parseNumber(record.sellerRating, 4),
    hasBuyNow,
    imageVariant: cleanText(record.imageVariant) || imageVariants[index % imageVariants.length],
    sourceUrl,
    sellerText
  };
}

function isIphoneDeal(deal) {
  const text = `${deal.brand} ${deal.model} ${deal.title}`.toLocaleLowerCase("sv-SE");
  if (!(deal.brand === "Apple" || text.includes("iphone") || text.includes("i phone"))) {
    return false;
  }
  return !isAccessoryListing(`${deal.title} ${deal.model} ${deal.condition} ${deal.sellerText}`);
}

function isAccessoryListing(text) {
  const normalized = normalizeKey(text);
  const accessoryTokens = [
    "mobilskal",
    "telefonskal",
    "telefonfodral",
    "planboksfodral",
    "fodral",
    "case",
    "cover",
    "skarmskydd",
    "screenprotector",
    "temperedglass",
    "hardatglas",
    "laddare",
    "charger",
    "laddkabel",
    "kabel",
    "adapter",
    "magsafe",
    "powerbank",
    "mobilhallare",
    "bilhallare",
    "hallare",
    "mount",
    "stativ",
    "tripod",
    "gimbal",
    "selfiepinne",
    "ringlight",
    "mikrofon",
    "microphone",
    "objektiv",
    "lens",
    "videokit",
    "mobilevideokit",
    "smallrig",
    "kamerarig",
    "airpods",
    "horlurar",
    "headset"
  ];
  const hasAccessoryToken = accessoryTokens.some((token) => normalized.includes(token));

  if (!hasAccessoryToken) return false;

  const startsLikePhone =
    normalized.startsWith("iphone") || normalized.startsWith("appleiphone");
  const hasAccessoryContext = [
    "tilliphone",
    "foriphone",
    "passariphone",
    "kompatibeliphone",
    "kompatibelmediphone",
    "compatibleiphone",
    "compatiblewithiphone"
  ].some((token) => normalized.includes(token));
  const mentionsDeviceSale = /(saljer|saljes|min|mobil|telefon)(min)?(apple)?iphone/.test(normalized);

  if (hasAccessoryContext) return true;

  if (startsLikePhone || mentionsDeviceSale) {
    const phoneDetailSignal =
      /\d{2,4}gb|batteri|batterihalsa|trasig|sprucken|defekt|skadad|skarm|display|olast|fungerar|last|icloud/.test(
        normalized
      );
    if (mentionsDeviceSale) return false;
    return !phoneDetailSignal;
  }

  return true;
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeKey(key) {
  return cleanText(key)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/[^a-z0-9]/g, "");
}

function parseMoney(value, fallback = Number.NaN) {
  const text = cleanText(value);
  if (!text) return fallback;

  let normalized = text
    .replace(/\s/g, "")
    .replace(/kr/gi, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalized) return fallback;

  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/,/g, "");
  } else if (normalized.includes(",") && !normalized.includes(".")) {
    normalized = normalized.replace(",", ".");
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function parseNumber(value, fallback) {
  const text = cleanText(value);
  if (!text) return fallback;

  const number = Number(text.replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const text = cleanText(value).toLocaleLowerCase("sv-SE");
  if (!text) return fallback;
  return ["1", "true", "yes", "ja", "köp nu", "kop nu", "buy now", "buynow"].some((token) =>
    text.includes(token)
  );
}

function getAgeHours(ageHours, publishedAt) {
  const explicitAge = parseNumber(ageHours, Number.NaN);
  if (Number.isFinite(explicitAge)) return Math.max(0, Math.round(explicitAge));

  const publishedDate = Date.parse(cleanText(publishedAt));
  if (Number.isFinite(publishedDate)) {
    return Math.max(0, Math.round((Date.now() - publishedDate) / 36e5));
  }

  return 24;
}

function inferBrand(text) {
  const normalizedText = text.toLocaleLowerCase("sv-SE");
  if (normalizedText.includes("iphone") || normalizedText.includes("i phone")) return "Apple";
  return phoneBrands.find((brand) => normalizedText.includes(brand.toLocaleLowerCase("sv-SE"))) ?? "Okänt";
}

function extractModel(title) {
  const match = cleanText(title).match(
    /(iphone\s?(?:se(?:\s?\d{4})?|x(?:r|s(?:\s?max)?)?|\d{1,2}(?:\s?(?:pro|max|mini|plus|promax))?))/i
  );
  return match?.[0] ?? "";
}

function inferCondition(text) {
  const keyword = detectDefectKeywords(text)[0];
  if (!keyword) return "Okänt skick";

  return (
    conditionOptions.find((condition) =>
      keyword.toLocaleLowerCase("sv-SE").includes(condition.toLocaleLowerCase("sv-SE"))
    ) ?? keyword
  );
}

function estimateRepairCost(text) {
  const normalizedText = text.toLocaleLowerCase("sv-SE");

  if (normalizedText.includes("water") || normalizedText.includes("vatten")) return 1800;
  if (normalizedText.includes("icloud") || normalizedText.includes("locked")) return 250;
  if (normalizedText.includes("face id")) return 1100;
  if (normalizedText.includes("startar inte") || normalizedText.includes("does not turn on")) return 1200;
  if (normalizedText.includes("ladd") || normalizedText.includes("charge")) return 700;
  if (normalizedText.includes("batter")) return 550;
  if (normalizedText.includes("reservdel") || normalizedText.includes("parts only")) return 650;
  if (normalizedText.includes("defekt") || normalizedText.includes("defective")) return 850;
  if (normalizedText.includes("skadad") || normalizedText.includes("damaged")) return 800;
  if (normalizedText.includes("trasig") || normalizedText.includes("broken")) return 850;
  if (normalizedText.includes("baksida") || normalizedText.includes("back glass")) return 450;
  if (normalizedText.includes("display") || normalizedText.includes("skärm") || normalizedText.includes("screen")) {
    return 950;
  }

  return 750;
}

function estimateResaleValue({ brand, model, askingPrice, repairEstimate }) {
  const normalizedModel = `${brand} ${model}`.toLocaleLowerCase("sv-SE");
  const knownValues = [
    [/iphone\s?17/, 7000],
    [/iphone\s?16/, 5200],
    [/iphone\s?15/, 3400],
    [/iphone\s?14/, 2900],
    [/iphone\s?13/, 2500],
    [/iphone\s?12/, 2000],
    [/iphone\s?11/, 1500],
    [/iphone\s?x/, 1600],
    [/iphone\s?8/, 1200],
    [/iphone\s?se/, 1400]
  ];

  const knownValue = knownValues.find(([pattern]) => pattern.test(normalizedModel))?.[1];
  if (knownValue) return knownValue;

  const brandBase = {
    Apple: 3200
  };
  const fallback = brandBase[brand] ?? 2200;

  return Math.max(fallback, Math.round((askingPrice + repairEstimate) * 1.45));
}

function estimateDemandScore(brand, model) {
  const text = `${brand} ${model}`.toLocaleLowerCase("sv-SE");

  if (text.includes("iphone")) return 92;
  return 55;
}

function createDealId(value, index) {
  let hash = 0;

  for (let charIndex = 0; charIndex < value.length; charIndex += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(charIndex);
    hash |= 0;
  }

  return `deal-${index + 1}-${Math.abs(hash).toString(36)}`;
}
