import { Document, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import { PLACEHOLDER, SLIDE_LABELS, type Deck, type Slide } from "@/lib/ai/schemas/deck";
import { validateImage } from "@/lib/images/rules";
import { registerFonts } from "@/lib/reports/pdf";

const GREEN = "#0b6e4f";
const INK = "#111827";
const MUTED = "#5b6472";
const AMBER = "#b45309";

// 16:9 slides, in points.
const SIZE = { width: 960, height: 540 };

const s = StyleSheet.create({
  page: { fontFamily: "Noto Sans", color: INK, padding: 0 },
  bar: { position: "absolute", top: 0, left: 0, right: 0, height: 8, backgroundColor: GREEN },
  side: { position: "absolute", top: 0, left: 0, bottom: 0, width: 18, backgroundColor: GREEN },
  body: { paddingHorizontal: 44, paddingTop: 34, flexGrow: 1 },
  label: { fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: 1.5 },
  title: { fontSize: 30, fontWeight: 700, marginTop: 8, marginBottom: 24, lineHeight: 1.25 },
  row: { flexDirection: "row", gap: 24 },
  bullets: { flexGrow: 1, flexBasis: 0 },
  bullet: { flexDirection: "row", marginBottom: 14 },
  dot: { width: 20, fontSize: 19, color: GREEN },
  bulletText: { flex: 1, fontSize: 19, lineHeight: 1.35 },
  visual: { width: 280, backgroundColor: "#f3f5f7", borderRadius: 8, padding: 16 },
  small: { fontSize: 10, color: MUTED },
  footer: { position: "absolute", bottom: 18, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", fontSize: 9, color: MUTED },
  bigTitle: { fontSize: 44, fontWeight: 700, marginTop: 150, lineHeight: 1.2 },
  tagline: { fontSize: 20, color: MUTED, marginTop: 12 },
  logo: { position: "absolute", top: 50, left: 64, width: 200, height: 90, objectFit: "contain", objectPosition: "left" },
});

/** Text with "[Add: ...]" placeholders picked out in amber. */
function Marked({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(PLACEHOLDER)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <Text key={m.index} style={{ color: AMBER, fontWeight: 700 }}>
        {m[0]}
      </Text>,
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

function TitlePage({ deck, slide, logo }: { deck: Deck; slide: Slide; logo: Buffer | null }) {
  return (
    <Page size={SIZE} style={s.page}>
      <View style={s.side} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf images take no alt text */}
      {logo ? <Image src={logo} style={s.logo} /> : null}
      <View style={{ paddingHorizontal: 64 }}>
        <Text style={s.bigTitle}>
          <Marked text={slide.title || deck.title} />
        </Text>
        <Text style={s.tagline}>
          <Marked text={deck.tagline} />
        </Text>
        {slide.bullets.length ? (
          <Text style={[s.small, { marginTop: 40, fontSize: 13 }]}>
            <Marked text={slide.bullets.join("   ·   ")} />
          </Text>
        ) : null}
      </View>
    </Page>
  );
}

function ContentPage({ slide, n, startupName }: { slide: Slide; n: number; startupName: string }) {
  return (
    <Page size={SIZE} style={s.page}>
      <View style={s.bar} />
      <View style={s.body}>
        <Text style={s.label}>{SLIDE_LABELS[slide.kind].toUpperCase()}</Text>
        <Text style={s.title}>
          <Marked text={slide.title} />
        </Text>
        <View style={s.row}>
          <View style={s.bullets}>
            {slide.bullets.map((b, i) => (
              <View key={i} style={s.bullet} wrap={false}>
                <Text style={s.dot}>•</Text>
                <Text style={s.bulletText}>
                  <Marked text={b} />
                </Text>
              </View>
            ))}
          </View>
          {slide.visual ? (
            <View style={s.visual}>
              <Text style={[s.small, { fontWeight: 700, marginBottom: 6 }]}>Suggested visual</Text>
              <Text style={{ fontSize: 13 }}>{slide.visual}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={s.footer}>
        <Text>{startupName}</Text>
        <Text>{n}</Text>
      </View>
    </Page>
  );
}

/** The deck as a PDF, one landscape page per slide. Speaker notes stay in the PowerPoint file. */
export async function renderDeckPdf(deck: Deck, options: { startupName: string; logo: Buffer | null }): Promise<Buffer> {
  registerFonts();
  const logo = options.logo && validateImage(options.logo).ok ? options.logo : null;
  return renderToBuffer(
    <Document title={deck.title} author={options.startupName}>
      {deck.slides.map((slide, i) =>
        slide.kind === "title" ? (
          <TitlePage key={i} deck={deck} slide={slide} logo={logo} />
        ) : (
          <ContentPage key={i} slide={slide} n={i + 1} startupName={options.startupName} />
        ),
      )}
    </Document>,
  );
}
