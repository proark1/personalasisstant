"use client";

import { Loader2, Mic, MicOff, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { askAssistant } from "../api/client";

// Minimal typing for the Web Speech API (not in the DOM lib types).
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type Turn = { question: string; answer: string; intent: string };
type Status = "idle" | "listening" | "thinking";

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  const ctor =
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
      .webkitSpeechRecognition;
  return ctor ? new ctor() : null;
}

function speak(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

export function VoiceConsole() {
  const [status, setStatus] = useState<Status>("idle");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [draft, setDraft] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setVoiceSupported(getRecognition() !== null);
  }, []);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    setStatus("thinking");
    setError(null);
    try {
      const response = await askAssistant(trimmed);
      setTurns((current) => [
        { question: trimmed, answer: response.answer, intent: response.intent },
        ...current
      ]);
      speak(response.spoken || response.answer);
    } catch {
      setError("I couldn't reach the assistant. Please try again.");
    } finally {
      setStatus("idle");
      setDraft("");
    }
  }

  function toggleListening() {
    if (status === "listening") {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = getRecognition();
    if (!recognition) {
      setVoiceSupported(false);
      return;
    }
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      void ask(transcript);
    };
    recognition.onerror = () => {
      setError("Voice input failed. You can type your question instead.");
      setStatus("idle");
    };
    recognition.onend = () => {
      setStatus((current) => (current === "listening" ? "idle" : current));
    };
    recognitionRef.current = recognition;
    setError(null);
    setStatus("listening");
    recognition.start();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <section className="voice-console" aria-labelledby="voice-heading">
      <div className="section-header">
        <h2 id="voice-heading" className="section-title">
          Ask your assistant
        </h2>
        <span className="section-meta">{voiceSupported ? "voice + text" : "text"}</span>
      </div>

      <div className="voice-controls">
        {voiceSupported ? (
          <button
            type="button"
            className="text-button"
            data-variant={status === "listening" ? "primary" : undefined}
            onClick={toggleListening}
            disabled={status === "thinking"}
          >
            {status === "listening" ? (
              <MicOff size={16} aria-hidden="true" />
            ) : (
              <Mic size={16} aria-hidden="true" />
            )}
            {status === "listening" ? "Stop" : "Push to talk"}
          </button>
        ) : null}
        <form className="voice-form" onSubmit={onSubmit}>
          <input
            className="text-field"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="What does my day look like?"
            aria-label="Ask a question"
          />
          <button className="icon-button" type="submit" disabled={status === "thinking" || !draft.trim()}>
            {status === "thinking" ? (
              <Loader2 className="spin" size={16} aria-hidden="true" />
            ) : (
              <Send size={16} aria-hidden="true" />
            )}
            <span className="sr-only">Send</span>
          </button>
        </form>
      </div>

      {status === "listening" ? <p className="voice-status">Listening…</p> : null}
      {error ? (
        <p className="telegram-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="voice-transcript">
        {turns.map((turn, index) => (
          <article className="voice-turn" key={`${index}-${turn.question}`}>
            <p className="voice-question">{turn.question}</p>
            <p className="voice-answer">{turn.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
