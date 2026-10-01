// Generates e2e/fixtures/sample-deck.pdf, a short fictional pitch deck used by
// the end-to-end test. Run: node scripts/make-e2e-deck.mjs
import { createElement as h } from "react";
import { Document, Page, StyleSheet, Text, View, renderToFile } from "@react-pdf/renderer";

const slides = [
  ["Kolo Freight (fictional test company)", ["Same-day trucking for small traders in Lagos.", "Seed round: raising USD 500,000. Contact: founders@kolo.example"]],
  ["Problem", ["Small traders in Lagos wait 3 to 5 days for goods from Apapa port.", "Informal trucking is unreliable and prices change daily."]],
  ["Solution", ["An app that books vetted trucks in under 10 minutes with fixed prices.", "Live tracking and proof of delivery for every trip."]],
  ["Market", ["About 40,000 small importers in Lagos (our estimate from port data).", "Serviceable market: USD 120 million a year in last-mile freight."]],
  ["Traction", ["Monthly revenue: NGN 18 million (August 2026), up from NGN 6 million in February 2026.", "420 paying customers; 35% of revenue from repeat bookings."]],
  ["Business model", ["We take a 12% commission on each trip. Average trip value: NGN 85,000.", "Gross margin 9% after payment and insurance costs."]],
  ["Team", ["Adaeze Okafor, CEO: 6 years in operations at a national logistics firm.", "Tunde Bello, CTO: built dispatch software used by 300 drivers."]],
  ["The ask", ["Raising USD 500,000 on a SAFE.", "Use of funds: 50% engineering, 30% driver onboarding, 20% expansion to Ibadan.", "18 months of runway."]],
];

const s = StyleSheet.create({
  page: { padding: 48, fontSize: 18, lineHeight: 1.4 },
  title: { fontSize: 32, marginBottom: 24, lineHeight: 1.2 },
  line: { marginBottom: 12 },
});

const doc = h(
  Document,
  { title: "Kolo Freight pitch deck (fictional)" },
  slides.map(([title, lines], i) =>
    h(Page, { key: i, size: "A4", orientation: "landscape", style: s.page },
      h(Text, { style: s.title }, title),
      h(View, null, lines.map((l, j) => h(Text, { key: j, style: s.line }, l))),
    ),
  ),
);

await renderToFile(doc, new URL("../e2e/fixtures/sample-deck.pdf", import.meta.url).pathname);
console.log("wrote e2e/fixtures/sample-deck.pdf");
