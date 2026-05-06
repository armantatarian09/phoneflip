import { detectDefectKeywords, highRiskKeywords } from "../data/keywords.js";
import {
  detectDamageTypes,
  estimateRepairCost,
  estimateResaleValue,
  getConfidenceScore,
  getMaxOffer,
  getRecommendation,
  getRiskLevel,
  inferIphoneProfile,
  normalizePricingSettings
} from "./pricing.js";

const marketplaceWeights = {
  Blocket: 7,
  Tradera: 9,
  Vinted: 5
};

const labelThresholds = [
  { min: 80, label: "Köp-kandidat", tone: "excellent" },
  { min: 65, label: "Förhandla", tone: "good" },
  { min: 45, label: "Bevaka", tone: "risky" },
  { min: 0, label: "Skippa", tone: "avoid" }
];

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function hasAnyKeyword(matches, riskWords) {
  const normalizedMatches = matches.map((match) =>
    match.toLocaleLowerCase("sv-SE")
  );

  return riskWords.some((riskWord) =>
    normalizedMatches.includes(riskWord.toLocaleLowerCase("sv-SE"))
  );
}

function getCheapScore(price) {
  if (price <= 500) return 16;
  if (price <= 1000) return 13;
  if (price <= 1500) return 9;
  if (price <= 2500) return 3;
  return -10;
}

function hasDamageSignal(matches, deal) {
  const haystack = `${deal.title} ${deal.condition} ${deal.sellerText}`.toLocaleLowerCase("sv-SE");
  return matches.length > 0 || /(trasig|defekt|skadad|sprucken|reservdel|delar|reparation|broken|cracked|damaged|parts)/i.test(haystack);
}

export function scoreDeal(deal, settings) {
  const normalizedSettings = normalizePricingSettings(settings);
  const profile = deal.iphoneProfile?.generation
    ? deal.iphoneProfile
    : inferIphoneProfile(deal.title, deal.model, deal.sellerText, deal.condition);
  const damageTypes = deal.damageTypes?.length
    ? deal.damageTypes
    : detectDamageTypes(deal.title, deal.condition, deal.sellerText);
  const keywordMatches = detectDefectKeywords(
    deal.title,
    deal.condition,
    deal.sellerText
  );
  const repairEstimate =
    deal.pricingSource === "manual" && Number.isFinite(Number(deal.repairEstimate))
      ? Number(deal.repairEstimate)
      : estimateRepairCost(profile, damageTypes, normalizedSettings);
  const resaleValue =
    deal.pricingSource === "manual" && Number.isFinite(Number(deal.resaleValue))
      ? Number(deal.resaleValue)
      : estimateResaleValue(profile, normalizedSettings);
  const estimatedProfit = resaleValue - deal.askingPrice - repairEstimate;
  const maxOffer = getMaxOffer({ resaleValue, repairEstimate, settings: normalizedSettings });
  const margin = estimatedProfit / Math.max(resaleValue, 1);
  const discountToMarket = (resaleValue - deal.askingPrice) / Math.max(resaleValue, 1);
  const confidenceScore = getConfidenceScore({
    ...deal,
    profile,
    damages: damageTypes
  });
  const riskLevel = getRiskLevel(
    damageTypes,
    `${deal.title} ${deal.condition} ${deal.sellerText}`,
    normalizedSettings
  );
  const recommendation = getRecommendation({
    estimatedProfit,
    riskLevel,
    confidenceScore,
    settings: normalizedSettings
  });
  const ageScore = clamp(12 - deal.ageHours / 8, 0, 12);
  const demandScore = clamp((deal.demandScore / 100) * 14, 0, 14);
  const profitScore = clamp((estimatedProfit + 250) / 45, 0, 30);
  const priceScore = clamp(discountToMarket * 22, 0, 22);
  const repairScore = clamp((1 - repairEstimate / Math.max(resaleValue, 1)) * 13, 0, 13);
  const marketplaceScore = marketplaceWeights[deal.marketplace] ?? 4;
  const sellerScore = clamp((deal.sellerRating - 3) * 3, 0, 6);
  const cheapScore = getCheapScore(deal.askingPrice);
  const confidenceBonus = clamp((confidenceScore - 45) / 5, -8, 10);
  const damaged = hasDamageSignal(keywordMatches, deal);
  const highRisk = hasAnyKeyword(keywordMatches, highRiskKeywords);

  let riskPenalty = 0;
  if (!damaged) riskPenalty += normalizedSettings.riskPenalties.weakDamageSignal;
  if (highRisk) riskPenalty += normalizedSettings.riskPenalties.highRisk;
  if (damageTypes.includes("locked")) riskPenalty += normalizedSettings.riskPenalties.locked;
  if (damageTypes.includes("water")) riskPenalty += normalizedSettings.riskPenalties.water;
  if (damageTypes.includes("motherboard")) riskPenalty += normalizedSettings.riskPenalties.motherboard;
  if (confidenceScore < 50) riskPenalty += normalizedSettings.riskPenalties.lowConfidence;
  if (margin < 0.12) riskPenalty += 8;

  const rawScore =
    profitScore +
    priceScore +
    repairScore +
    demandScore +
    marketplaceScore +
    sellerScore +
    cheapScore +
    ageScore +
    confidenceBonus -
    riskPenalty;
  const score = Math.round(clamp(rawScore * 0.92));
  const label = labelThresholds.find((threshold) => score >= threshold.min);
  const concerns = getConcerns({ deal, keywordMatches, highRisk, margin, damaged, riskLevel, confidenceScore, damageTypes, maxOffer });
  const positives = getPositives({ deal, estimatedProfit, damaged, confidenceScore, maxOffer, riskLevel });

  return {
    ...deal,
    iphoneProfile: profile,
    damageTypes,
    damageSummary: damageTypes.map(formatDamageType).join(", "),
    repairEstimate,
    resaleValue,
    keywordMatches,
    estimatedProfit,
    maxOffer,
    margin,
    confidenceScore,
    riskLevel,
    recommendation,
    concerns,
    positives,
    flipScore: score,
    dealLabel: recommendation || label.label,
    dealTone: label.tone,
    explanation: explainDeal({
      positives,
      concerns,
      recommendation,
      estimatedProfit
    })
  };
}

function getPositives({ deal, estimatedProfit, damaged, confidenceScore, maxOffer, riskLevel }) {
  const positives = [];
  if (deal.askingPrice <= 500) positives.push("extremt lågt inköpspris");
  else if (deal.askingPrice <= 1500) positives.push("billigt inköpspris");
  if (damaged) positives.push("tydlig skadesignal");
  if (estimatedProfit > 900) positives.push("hög uppskattad vinst");
  if (deal.demandScore >= 85) positives.push("populär modell");
  if (confidenceScore >= 75) positives.push("bra beslutsunderlag");
  if (riskLevel === "Låg") positives.push("låg risknivå");
  if (maxOffer >= deal.askingPrice) positives.push("annonspris under maxbud");
  return positives;
}

function getConcerns({ deal, keywordMatches, highRisk, margin, damaged, riskLevel, confidenceScore, damageTypes, maxOffer }) {
  const concerns = [];
  if (highRisk) concerns.push("riskord i säljarens beskrivning");
  if (!damaged) concerns.push("för svag skadesignal");
  if (deal.askingPrice > 2500) concerns.push("för dyr för billig-flip-läget");
  if (margin < 0.18) concerns.push("svag marginal efter reparation");
  if (damageTypes.includes("locked")) concerns.push("iCloud/lås kräver extra kontroll");
  if (damageTypes.includes("water")) concerns.push("vattenskada kan dölja följdfel");
  if (damageTypes.includes("motherboard")) concerns.push("moderkort/baseband är hög risk");
  if (confidenceScore < 55) concerns.push("låg datakonfidens");
  if (deal.sellerRating < 4.0) concerns.push("lägre säljarbetyg");
  if (maxOffer < deal.askingPrice) concerns.push("annonspris över maxbud");
  if (keywordMatches.includes("vattenskadad")) concerns.push("vattenskada nämns uttryckligen");
  return [...new Set(concerns)];
}

function explainDeal({ positives, concerns, recommendation, estimatedProfit }) {
  const profitText = `Uppskattad vinst ${formatSek(estimatedProfit)}.`;

  if (["Köp-kandidat", "Förhandla"].includes(recommendation)) {
    return `${sentence(positives, "Priset och skadan gör annonsen intressant")}. ${profitText} ${concerns.length ? `Kontrollera ${concerns.slice(0, 2).join(", ")}.` : "Riskbilden ser hanterbar ut."}`;
  }

  return `${sentence(concerns, "Risknivån behöver verifieras")}. ${profitText} ${positives.length ? `Plus: ${positives.slice(0, 2).join(", ")}.` : "Begär mer underlag innan köp."}`;
}

function sentence(items, fallback) {
  if (!items.length) return fallback;
  return `${items[0][0].toLocaleUpperCase("sv-SE")}${items[0].slice(1)}${
    items.length > 1 ? `, ${items.slice(1).join(", ")}` : ""
  }`;
}

function formatDamageType(type) {
  const labels = {
    screen: "Skärm",
    backGlass: "Baksida",
    battery: "Batteri",
    chargingPort: "Laddport",
    faceId: "Face ID",
    water: "Vatten",
    motherboard: "Moderkort",
    locked: "Låst",
    parts: "Reservdelar",
    unknown: "Okänt"
  };
  return labels[type] ?? type;
}

function formatSek(value) {
  return `${Math.round(value).toLocaleString("sv-SE")} kr`;
}

export function scoreDeals(deals, settings) {
  return deals.map((deal) => scoreDeal(deal, settings)).sort((a, b) => {
    if (b.flipScore !== a.flipScore) return b.flipScore - a.flipScore;
    if (a.askingPrice !== b.askingPrice) return a.askingPrice - b.askingPrice;
    return b.estimatedProfit - a.estimatedProfit;
  });
}
