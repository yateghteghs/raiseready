"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SendIcon, XIcon } from "lucide-react";

import { RedFlagCard, type FlagView } from "@/components/simulation/red-flag-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type TurnView = { id: string; turn_index: number; round: number; role: "investor" | "founder" | "system"; content: string };

type Props = {
  simulationId: string;
  investorName: string;
  roundTitles: Record<number, string>;
  plan: number[];
  maxInvestorTurns: number;
  maxAnswerChars: number;
  initialTurns: TurnView[];
  initialFlags: FlagView[];
  docLabels: Record<string, string>;
  /** "live" while answering; "evaluating" after the meeting ends; "closed" otherwise. */
  mode: "live" | "evaluating" | "closed";
};

type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "done"; founderTurn: TurnView; investorTurn: TurnView; redFlags: FlagView[]; ended: boolean }
  | { type: "error"; message: string };

export function Room(props: Props) {
  const router = useRouter();
  const [turns, setTurns] = useState(props.initialTurns);
  const [flags, setFlags] = useState(props.initialFlags);
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState<{ answer: string; reply: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clarifying, setClarifying] = useState<FlagView | null>(null);
  const [mode, setMode] = useState(props.mode);
  const bottom = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  // While the final evaluation runs, refresh until the server shows the results.
  useEffect(() => {
    if (mode !== "evaluating") return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [mode, router]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, pending?.reply, flags.length]);

  const investorTurns = turns.filter((t) => t.role === "investor");
  const currentRound = investorTurns.at(-1)?.round ?? props.plan[0];
  const roundPosition = Math.max(0, props.plan.indexOf(currentRound));

  async function send() {
    const text = answer.trim();
    if (!text || pending || mode !== "live") return;
    setError(null);
    setPending({ answer: text, reply: "" });
    setAnswer("");

    try {
      const res = await fetch(`/api/simulations/${props.simulationId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: text, clarifiesRedFlagId: clarifying?.id ?? null }),
      });
      if (!res.ok || !res.body) throw new Error("request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          if (!line) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "delta") setPending((p) => (p ? { ...p, reply: p.reply + event.text } : p));
          else if (event.type === "reset") setPending((p) => (p ? { ...p, reply: "" } : p));
          else if (event.type === "error") {
            setError(event.message);
            setAnswer(text);
            finished = true;
          } else if (event.type === "done") {
            setTurns((t) => [...t, event.founderTurn, event.investorTurn]);
            setFlags((f) => [...f, ...event.redFlags]);
            setClarifying(null);
            if (event.ended) setMode("evaluating");
            finished = true;
          }
        }
      }
      if (!finished) throw new Error("stream ended early");
    } catch {
      setError("We lost the connection. Your answer wasn't sent; please try again.");
      setAnswer(text);
    } finally {
      setPending(null);
      box.current?.focus();
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Round progress */}
      <div className="bg-background/95 sticky top-0 z-10 grid gap-2 border-b py-3 backdrop-blur">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <p className="font-medium">
            {props.investorName} · Round {roundPosition + 1} of {props.plan.length}: {props.roundTitles[currentRound]}
          </p>
          <p className="text-muted-foreground shrink-0 text-xs">
            Question {Math.min(investorTurns.length, props.maxInvestorTurns)} of up to {props.maxInvestorTurns}
          </p>
        </div>
        <ol className="flex gap-1" aria-label="Rounds">
          {props.plan.map((r, i) => (
            <li
              key={r}
              title={props.roundTitles[r]}
              aria-current={i === roundPosition ? "step" : undefined}
              className={cn("h-1.5 flex-1 rounded-full", i < roundPosition ? "bg-primary" : i === roundPosition ? "bg-primary/60" : "bg-muted")}
            >
              <span className="sr-only">{props.roundTitles[r]}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Conversation */}
      <ol className="grid gap-5" aria-label="Conversation" aria-live="polite">
        {turns.map((t) => (
          <li key={t.id} className="grid gap-3">
            {t.role === "investor" ? (
              <div className="bg-card max-w-[85%] rounded-2xl rounded-tl-sm border p-4 text-base leading-relaxed sm:text-lg">
                <p className="text-muted-foreground mb-1 text-xs">{props.investorName}</p>
                <p className="whitespace-pre-wrap">{t.content}</p>
              </div>
            ) : (
              <div className="bg-muted ml-auto max-w-[85%] rounded-2xl rounded-tr-sm p-4 text-sm leading-relaxed">
                <p className="text-muted-foreground mb-1 text-xs">You</p>
                <p className="whitespace-pre-wrap">{t.content}</p>
              </div>
            )}
            {flags
              .filter((f) => f.turn_id === t.id)
              .map((f) => (
                <RedFlagCard
                  key={f.id}
                  flag={f}
                  docLabels={props.docLabels}
                  onClarify={
                    mode === "live" && !pending
                      ? () => {
                          setClarifying(f);
                          setAnswer((a) => a || "To clarify: ");
                          box.current?.focus();
                        }
                      : undefined
                  }
                />
              ))}
          </li>
        ))}
        {pending ? (
          <li className="grid gap-3">
            <div className="bg-muted ml-auto max-w-[85%] rounded-2xl rounded-tr-sm p-4 text-sm">
              <p className="text-muted-foreground mb-1 text-xs">You</p>
              <p className="whitespace-pre-wrap">{pending.answer}</p>
            </div>
            <div className="bg-card max-w-[85%] rounded-2xl rounded-tl-sm border p-4 text-base sm:text-lg">
              <p className="text-muted-foreground mb-1 text-xs">{props.investorName}</p>
              <p className="whitespace-pre-wrap">
                {pending.reply || <span className="text-muted-foreground">Thinking…</span>}
              </p>
            </div>
          </li>
        ) : null}
      </ol>
      <div ref={bottom} />

      {mode === "evaluating" ? (
        <p className="bg-muted/40 rounded-xl border p-4 text-sm" role="status">
          The meeting is over. Preparing your feedback, which usually takes under a minute…
        </p>
      ) : null}

      {/* Answer box */}
      {mode === "live" ? (
        <form
          className="bg-background/95 sticky bottom-0 grid grid-cols-1 gap-2 border-t pt-3 pb-4 backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {clarifying ? (
            <p className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">Clarifying: {clarifying.description}</span>
              <button type="button" onClick={() => setClarifying(null)} aria-label="Stop clarifying" className="hover:text-foreground">
                <XIcon className="size-4" />
              </button>
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <label htmlFor="answer" className="sr-only">
            Your answer
          </label>
          <div className="flex items-end gap-2">
            <Textarea
              id="answer"
              ref={box}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
              maxLength={props.maxAnswerChars}
              placeholder={pending ? "The investor is responding…" : "Type your answer…"}
              disabled={Boolean(pending)}
              className="max-h-60 min-h-24"
            />
            <Button type="submit" size="icon" disabled={!answer.trim() || Boolean(pending)} aria-label="Send answer">
              <SendIcon />
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">Ctrl + Enter to send · {answer.length}/{props.maxAnswerChars}</p>
        </form>
      ) : null}
    </div>
  );
}
