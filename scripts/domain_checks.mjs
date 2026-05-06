import assert from "node:assert/strict";
import {
  createDefaultPricingSettings,
  detectDamageTypes,
  estimateRepairCost,
  estimateResaleValue,
  inferIphoneProfile
} from "../src/services/pricing.js";
import { scoreDeal } from "../src/services/scoring.js";

const settings = createDefaultPricingSettings();

const profile = inferIphoneProfile("iPhone 13 Pro 256GB sprucken skärm 100% batteri");
assert.equal(profile.generation, "13");
assert.equal(profile.variant, "Pro");
assert.equal(profile.storage, "256");

const damages = detectDamageTypes("Sprucken skärm och baksida trasig");
assert.deepEqual(damages, ["screen", "backGlass"]);

const resaleValue = estimateResaleValue(profile, settings);
assert.equal(resaleValue, 2750);

const repairCost = estimateRepairCost(profile, damages, settings);
assert.equal(repairCost, 1700);

const scored = scoreDeal(
  {
    id: "test-1",
    title: "iPhone 13 Pro 256GB sprucken skärm",
    marketplace: "Blocket",
    brand: "Apple",
    model: "iPhone 13 Pro",
    askingPrice: 900,
    condition: "Sprucken skärm",
    location: "Stockholm",
    ageHours: 4,
    sellerRating: 4.5,
    hasBuyNow: true,
    sourceUrl: "https://example.com",
    sellerText: "Skärmen är sprucken men telefonen startar och batteriet är bytt.",
    demandScore: 92,
    imageVariant: "mint",
    pricingSource: "settings"
  },
  settings
);

assert.equal(scored.riskLevel, "Låg");
assert.ok(scored.confidenceScore >= 70);
assert.ok(Number.isFinite(scored.maxOffer));
assert.ok(scored.recommendation);

console.log("Domain checks passed");
