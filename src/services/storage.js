import { createDefaultPricingSettings, normalizePricingSettings } from "./pricing.js";

const storageVersion = 1;
const settingsKey = "phoneflip-v1-settings";
const watchlistKey = "phoneflip-v1-watchlist";
const ledgerKey = "phoneflip-v1-ledger";
const legacySavedKey = "phoneflip-saved";

export const pipelineStatuses = [
  "Sparad",
  "Kontaktad",
  "Förhandlar",
  "Köpt",
  "Reparerar",
  "Listad",
  "Såld",
  "Skippad"
];

export function loadSettings() {
  const stored = readVersioned(settingsKey);
  return normalizePricingSettings(stored ?? createDefaultPricingSettings());
}

export function saveSettings(settings) {
  writeVersioned(settingsKey, normalizePricingSettings(settings));
}

export function resetSettings() {
  const defaults = createDefaultPricingSettings();
  saveSettings(defaults);
  return defaults;
}

export function loadWatchlist() {
  const stored = readVersioned(watchlistKey);
  if (Array.isArray(stored)) return stored.map(normalizeWatchItem);

  const legacyIds = readRawArray(legacySavedKey);
  return legacyIds.map((dealId) => normalizeWatchItem({ dealId }));
}

export function saveWatchlist(items) {
  writeVersioned(watchlistKey, items.map(normalizeWatchItem));
}

export function loadLedger() {
  const stored = readVersioned(ledgerKey);
  return Array.isArray(stored) ? stored.map(normalizeLedgerItem) : [];
}

export function saveLedger(items) {
  writeVersioned(ledgerKey, items.map(normalizeLedgerItem));
}

export function createWatchItem(deal) {
  const now = new Date().toISOString();
  return normalizeWatchItem({
    id: `watch-${deal.id}`,
    dealId: deal.id,
    status: "Sparad",
    notes: "",
    offerPrice: deal.maxOffer || 0,
    agreedBuyPrice: "",
    repairPlan: deal.damageSummary || deal.condition || "",
    partsCost: deal.repairEstimate || 0,
    otherCosts: "",
    salePrice: "",
    fees: "",
    boughtAt: "",
    soldAt: "",
    createdAt: now,
    updatedAt: now
  });
}

export function createLedgerItem(deal, watchItem = {}) {
  const now = new Date().toISOString();
  return normalizeLedgerItem({
    id: `ledger-${deal.id}`,
    dealId: deal.id,
    title: deal.title,
    model: deal.model,
    status: watchItem.status || "Sparad",
    expectedProfit: deal.estimatedProfit || 0,
    buyPrice: watchItem.agreedBuyPrice || deal.askingPrice || 0,
    repairCost: watchItem.partsCost || deal.repairEstimate || 0,
    otherCosts: watchItem.otherCosts || 0,
    salePrice: watchItem.salePrice || "",
    fees: watchItem.fees || "",
    boughtAt: watchItem.boughtAt || "",
    soldAt: watchItem.soldAt || "",
    notes: watchItem.notes || "",
    createdAt: now,
    updatedAt: now
  });
}

export function calculateActualProfit(item) {
  const salePrice = numberOrZero(item.salePrice);
  const buyPrice = numberOrZero(item.buyPrice);
  const repairCost = numberOrZero(item.repairCost);
  const otherCosts = numberOrZero(item.otherCosts);
  const fees = numberOrZero(item.fees);
  return salePrice - buyPrice - repairCost - otherCosts - fees;
}

export function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeWatchItem(item) {
  return {
    id: item.id || `watch-${item.dealId}`,
    dealId: item.dealId,
    status: pipelineStatuses.includes(item.status) ? item.status : "Sparad",
    notes: item.notes || "",
    offerPrice: item.offerPrice ?? "",
    agreedBuyPrice: item.agreedBuyPrice ?? "",
    repairPlan: item.repairPlan || "",
    partsCost: item.partsCost ?? "",
    otherCosts: item.otherCosts ?? "",
    salePrice: item.salePrice ?? "",
    fees: item.fees ?? "",
    boughtAt: item.boughtAt || "",
    soldAt: item.soldAt || "",
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function normalizeLedgerItem(item) {
  return {
    id: item.id || `ledger-${item.dealId || Date.now()}`,
    dealId: item.dealId || "",
    title: item.title || "Flip",
    model: item.model || "",
    status: pipelineStatuses.includes(item.status) ? item.status : "Sparad",
    expectedProfit: numberOrZero(item.expectedProfit),
    buyPrice: item.buyPrice ?? "",
    repairCost: item.repairCost ?? "",
    otherCosts: item.otherCosts ?? "",
    salePrice: item.salePrice ?? "",
    fees: item.fees ?? "",
    boughtAt: item.boughtAt || "",
    soldAt: item.soldAt || "",
    notes: item.notes || "",
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function readVersioned(key) {
  if (typeof localStorage === "undefined") return null;

  try {
    const payload = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!payload || payload.version !== storageVersion) return null;
    return payload.data;
  } catch {
    return null;
  }
}

function writeVersioned(key, data) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify({ version: storageVersion, data }));
}

function readRawArray(key) {
  if (typeof localStorage === "undefined") return [];

  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
