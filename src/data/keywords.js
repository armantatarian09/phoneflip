export const defectKeywords = [
  "trasig",
  "defekt",
  "defekta",
  "skadad",
  "skadade",
  "trasiga",
  "sprucken skärm",
  "skärmen sprucken",
  "skärmproblem",
  "fungerar ej",
  "startar inte",
  "laddar inte",
  "batteriproblem",
  "vattenskadad",
  "låst",
  "iCloud låst",
  "reservdelar",
  "reservdel",
  "reparationsobjekt",
  "rep objekt",
  "skadad",
  "displayproblem",
  "baksida sprucken",
  "Face ID fungerar inte",
  "endast delar",
  "broken",
  "cracked",
  "cracked screen",
  "water damage",
  "does not turn on",
  "battery issue",
  "locked",
  "parts only",
  "repair object",
  "defective",
  "not working",
  "damaged",
  "trasig skärm",
  "skärm trasig",
  "spricka",
  "sprickor",
  "sprucket glas",
  "krossad skärm",
  "krossat glas",
  "trasig display",
  "touch fungerar inte",
  "touch defekt",
  "ghost touch",
  "svart skärm",
  "grön skärm",
  "linjer i skärmen",
  "rand i skärmen",
  "döda pixlar",
  "bakglas sprucket",
  "baksida trasig",
  "frontglas",
  "tar inte laddning",
  "laddproblem",
  "laddport",
  "laddkontakt",
  "ladduttag",
  "dåligt batteri",
  "batteri dåligt",
  "batterihälsa",
  "service batteri",
  "går inte igång",
  "död",
  "no power",
  "bootloop",
  "fastnar på äpplet",
  "fastnar på logga",
  "äppellogo",
  "recovery mode",
  "dfu",
  "vattenskada",
  "fuktskada",
  "fuktskadad",
  "liquid damage",
  "icloudlåst",
  "aktiveringslås",
  "activation lock",
  "kodlåst",
  "lösenkod",
  "glömt kod",
  "avaktiverad",
  "operatörslåst",
  "simlåst",
  "passcode locked",
  "Face ID defekt",
  "Face ID trasig",
  "faceid",
  "kamera trasig",
  "kameraproblem",
  "högtalare trasig",
  "mikrofon trasig",
  "wifi fungerar inte",
  "bluetooth fungerar inte",
  "ingen service",
  "ingen täckning",
  "baseband",
  "moderkort",
  "moderkortsproblem",
  "kretskort",
  "renoveringsobjekt"
];

export const highRiskKeywords = [
  "iCloud låst",
  "låst",
  "locked",
  "vattenskadad",
  "water damage",
  "startar inte",
  "does not turn on",
  "endast delar",
  "parts only",
  "moderkort",
  "moderkortsproblem",
  "baseband",
  "ingen service",
  "ingen täckning",
  "bootloop",
  "activation lock",
  "aktiveringslås",
  "kodlåst",
  "operatörslåst",
  "simlåst",
  "stulen",
  "stulet"
];

export function detectDefectKeywords(...textParts) {
  const haystack = textParts
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("sv-SE");

  return defectKeywords.filter((keyword) => hasKeyword(haystack, keyword));
}

function hasKeyword(haystack, keyword) {
  const normalizedKeyword = keyword.toLocaleLowerCase("sv-SE");

  if (normalizedKeyword === "låst") {
    return /(^|[^a-zåäö])låst([^a-zåäö]|$)/i.test(haystack);
  }

  if (normalizedKeyword === "locked") {
    return /(^|[^a-z])locked([^a-z]|$)/i.test(haystack);
  }

  return haystack.includes(normalizedKeyword);
}
