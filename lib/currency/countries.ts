/** Local currency for each African country (ISO 3166 code → ISO 4217 code). */
export const COUNTRY_CURRENCY: Record<string, string> = {
  NG: "NGN", GH: "GHS", KE: "KES", ZA: "ZAR", EG: "EGP", RW: "RWF", UG: "UGX", TZ: "TZS", ET: "ETB",
  CI: "XOF", SN: "XOF", BJ: "XOF", TG: "XOF", BF: "XOF", ML: "XOF", NE: "XOF", GW: "XOF",
  CM: "XAF", GA: "XAF", CG: "XAF", TD: "XAF", CF: "XAF", GQ: "XAF",
  MA: "MAD", DZ: "DZD", TN: "TND", LY: "LYD", MR: "MRU", SD: "SDG", SS: "SSP",
  ZM: "ZMW", ZW: "ZWG", BW: "BWP", NA: "NAD", MZ: "MZN", AO: "AOA", MW: "MWK", LS: "LSL", SZ: "SZL",
  CD: "CDF", BI: "BIF", SO: "SOS", DJ: "DJF", ER: "ERN", MU: "MUR", MG: "MGA", SC: "SCR", KM: "KMF",
  SL: "SLE", LR: "LRD", GM: "GMD", GN: "GNF", CV: "CVE", ST: "STN",
};

/** Every African country founders can pick, by the name shown in forms. */
export const AFRICAN_COUNTRIES: { name: string; code: string }[] = [
  ["Algeria", "DZ"], ["Angola", "AO"], ["Benin", "BJ"], ["Botswana", "BW"], ["Burkina Faso", "BF"], ["Burundi", "BI"],
  ["Cabo Verde", "CV"], ["Cameroon", "CM"], ["Central African Republic", "CF"], ["Chad", "TD"], ["Comoros", "KM"],
  ["Congo", "CG"], ["Côte d'Ivoire", "CI"], ["DR Congo", "CD"], ["Djibouti", "DJ"], ["Egypt", "EG"],
  ["Equatorial Guinea", "GQ"], ["Eritrea", "ER"], ["Eswatini", "SZ"], ["Ethiopia", "ET"], ["Gabon", "GA"],
  ["Gambia", "GM"], ["Ghana", "GH"], ["Guinea", "GN"], ["Guinea-Bissau", "GW"], ["Kenya", "KE"], ["Lesotho", "LS"],
  ["Liberia", "LR"], ["Libya", "LY"], ["Madagascar", "MG"], ["Malawi", "MW"], ["Mali", "ML"], ["Mauritania", "MR"],
  ["Mauritius", "MU"], ["Morocco", "MA"], ["Mozambique", "MZ"], ["Namibia", "NA"], ["Niger", "NE"], ["Nigeria", "NG"],
  ["Rwanda", "RW"], ["São Tomé and Príncipe", "ST"], ["Senegal", "SN"], ["Seychelles", "SC"], ["Sierra Leone", "SL"],
  ["Somalia", "SO"], ["South Africa", "ZA"], ["South Sudan", "SS"], ["Sudan", "SD"], ["Tanzania", "TZ"], ["Togo", "TG"],
  ["Tunisia", "TN"], ["Uganda", "UG"], ["Zambia", "ZM"], ["Zimbabwe", "ZW"],
].map(([name, code]) => ({ name, code }));

const COUNTRY_CODES: Record<string, string> = Object.fromEntries(AFRICAN_COUNTRIES.map((c) => [c.name, c.code]));

/** The currency to suggest for a founder's figures: their country's, else US dollars. */
export function defaultCurrencyFor(country: string | null | undefined): string {
  const code = countryCode(country);
  return (code && COUNTRY_CURRENCY[code]) || "USD";
}

/** An ISO country code from a profile's country name or a two-letter code, or null. */
export function countryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^[A-Z]{2}$/.test(value)) return value;
  return COUNTRY_CODES[value] ?? null;
}
