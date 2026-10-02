import { readFileSync } from "node:fs";
import path from "node:path";

import { Document, Font, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { ReportContent } from "@/lib/reports/content";

let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "lib/reports/fonts");
  // Noto Sans covers ₦ and West African Latin characters, which the built-in PDF fonts lack.
  Font.register({
    family: "Noto Sans",
    fonts: [
      { src: path.join(dir, "NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

let brandLogo: Buffer | null | undefined;
/** The RaiseReady logo for the report header, or null if the file is missing. */
function raiseReadyLogo(): Buffer | null {
  if (brandLogo === undefined) {
    try {
      brandLogo = readFileSync(path.join(process.cwd(), "lib/reports/assets/raiseready-logo.png"));
    } catch {
      brandLogo = null;
    }
  }
  return brandLogo;
}

const GREEN = "#0b6e4f";
const MUTED = "#5b6472";
const BORDER = "#e3e6ea";

const s = StyleSheet.create({
  page: { fontFamily: "Noto Sans", fontSize: 10, color: "#1c2127", padding: 40, lineHeight: 1.45 },
  brand: { fontSize: 9, color: GREEN, fontWeight: 700, marginBottom: 4 },
  brandLogo: { height: 20, alignSelf: "flex-start", objectFit: "contain", objectPositionX: 0, marginBottom: 6 },
  heading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  logo: { maxWidth: 110, maxHeight: 48, objectFit: "contain" },
  issued: { marginTop: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  signature: { height: 44, maxWidth: 180, alignSelf: "flex-start", objectFit: "contain", objectPositionX: 0, marginTop: 6, marginBottom: 2 },
  title: { fontSize: 20, fontWeight: 700, lineHeight: 1.25 },
  subtitle: { color: MUTED, marginTop: 2 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 18, marginBottom: 6 },
  scoreRow: { flexDirection: "row", gap: 16, marginTop: 16 },
  scoreBox: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 12, flexGrow: 1 },
  scoreLabel: { color: MUTED, fontSize: 9 },
  scoreValue: { fontSize: 26, fontWeight: 700, lineHeight: 1.2 },
  barTrack: { height: 5, backgroundColor: "#eef0f2", borderRadius: 3, marginTop: 3 },
  dimRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  dimName: { width: 150 },
  dimBar: { flexGrow: 1, marginRight: 8 },
  dimScore: { width: 24, textAlign: "right" },
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
  card: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 8, marginBottom: 6 },
  small: { fontSize: 8.5, color: MUTED },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 8, color: MUTED, flexDirection: "row", justifyContent: "space-between" },
});

function barColor(score: number) {
  return score < 50 ? "#c2410c" : score < 70 ? "#d99a00" : GREEN;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={s.bullet} wrap={false}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric" });

/** Who issued the report, from the super admin's settings. */
export type ReportSigner = { name: string; title: string | null; image: Buffer | null };

function ReportDocument({ content, logo, signer }: { content: ReportContent; logo?: Buffer | null; signer?: ReportSigner | null }) {
  const c = content;
  return (
    <Document title={`${c.startup.name} readiness report`} author="RaiseReady" creator="RaiseReady">
      <Page size="A4" style={s.page}>
        <View style={s.heading}>
          <View style={{ flex: 1 }}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf images take no alt text */}
            {raiseReadyLogo() ? <Image src={raiseReadyLogo()!} style={s.brandLogo} /> : null}
            <Text style={s.brand}>{raiseReadyLogo() ? "READINESS REPORT" : "RAISEREADY · READINESS REPORT"}</Text>
            <Text style={s.title}>{c.startup.name}</Text>
            <Text style={s.subtitle}>
              {[c.startup.stage, c.startup.industry, c.startup.country].filter(Boolean).join(" · ")} · {dateFormat.format(new Date(c.generated_at))}
            </Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf images take no alt text */}
          {logo ? <Image src={logo} style={s.logo} /> : null}
        </View>

        <View style={s.scoreRow}>
          <View style={s.scoreBox}>
            <Text style={s.scoreLabel}>Readiness score</Text>
            <Text style={s.scoreValue}>{c.readiness.score}</Text>
            <Text>{c.readiness.band}</Text>
          </View>
          {c.simulation ? (
            <View style={s.scoreBox}>
              <Text style={s.scoreLabel}>Practice meeting ({c.simulation.investor}, {c.simulation.difficulty})</Text>
              <Text style={s.scoreValue}>{c.simulation.score}</Text>
              <Text>Investor confidence: {c.simulation.confidence}</Text>
            </View>
          ) : null}
        </View>

        <Text style={s.h2}>Executive summary</Text>
        <Text>{c.executive_summary}</Text>

        <Text style={s.h2}>Score by area</Text>
        {c.readiness.dimensions.map((d) => (
          <View key={d.name} style={s.dimRow} wrap={false}>
            <Text style={s.dimName}>{d.name}</Text>
            <View style={[s.barTrack, s.dimBar]}>
              {d.score !== null ? (
                <View style={{ width: `${d.score}%`, height: 5, borderRadius: 3, backgroundColor: barColor(d.score) }} />
              ) : null}
            </View>
            <Text style={s.dimScore}>{d.score ?? "–"}</Text>
          </View>
        ))}

        {c.strengths.length ? (
          <>
            <Text style={s.h2}>Strengths</Text>
            <Bullets items={c.strengths} />
          </>
        ) : null}

        <Text style={s.h2}>Key risks</Text>
        {c.risks.map((r, i) => (
          <View key={i} style={s.card} wrap={false}>
            <Text style={{ fontWeight: 700 }}>{r.risk}</Text>
            <Text>{r.why_it_matters}</Text>
          </View>
        ))}

        {c.red_flags.length ? (
          <>
            <Text style={s.h2}>Red flags from the practice meeting</Text>
            {c.red_flags.map((f, i) => (
              <View key={i} style={s.card} wrap={false}>
                <Text style={{ fontWeight: 700 }}>
                  {f.type} · {f.severity} risk
                </Text>
                <Text>{f.description}</Text>
                {f.evidence.map((e, j) => (
                  <Text key={j} style={s.small}>
                    {e}
                  </Text>
                ))}
              </View>
            ))}
          </>
        ) : null}

        <Text style={s.h2}>Questions to prepare</Text>
        {c.questions_to_prepare.map((q, i) => (
          <View key={i} style={s.card} wrap={false}>
            <Text style={{ fontWeight: 700 }}>
              {i + 1}. {q.question}
            </Text>
            <Text>{q.guidance}</Text>
          </View>
        ))}

        <Text style={s.h2}>Recommended next steps</Text>
        <Bullets items={c.next_steps} />

        {signer ? (
          <View style={s.issued} wrap={false}>
            <Text style={s.scoreLabel}>Issued by RaiseReady</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf images take no alt text */}
            {signer.image ? <Image src={signer.image} style={s.signature} /> : null}
            <Text style={{ fontWeight: 700 }}>{signer.name}</Text>
            {signer.title ? <Text>{signer.title}</Text> : null}
            <Text style={s.small}>{dateFormat.format(new Date(c.generated_at))}</Text>
            <Text style={[s.small, { marginTop: 6 }]}>
              This is an AI-assisted readiness assessment produced for practice. It is not investment advice, a
              guarantee of funding or an endorsement of the company.
            </Text>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text>
            Generated by RaiseReady. AI-assisted practice feedback, not investment advice. Checklist {c.readiness.rubric_version}.
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/**
 * Renders the report. The startup's logo, if given, goes in the top corner;
 * the signer, if set, adds an "Issued by RaiseReady" block at the end.
 */
export async function renderReportPdf(
  content: ReportContent,
  options: { logo?: Buffer | null; signer?: ReportSigner | null } = {},
): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ReportDocument content={content} logo={options.logo} signer={options.signer} />);
}
