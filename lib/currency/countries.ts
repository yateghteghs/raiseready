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

/** The countries founders pick in their profile, by name. */
const COUNTRY_CODES: Record<string, string> = {
  Nigeria: "NG", Ghana: "GH", Kenya: "KE", "South Africa": "ZA", Egypt: "EG", Rwanda: "RW", Uganda: "UG",
  Tanzania: "TZ", Ethiopia: "ET", "Côte d'Ivoire": "CI", Senegal: "SN", Cameroon: "CM", Morocco: "MA",
};

/** An ISO country code from a profile's country name or a two-letter code, or null. */
export function countryCode(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^[A-Z]{2}$/.test(value)) return value;
  return COUNTRY_CODES[value] ?? null;
}
