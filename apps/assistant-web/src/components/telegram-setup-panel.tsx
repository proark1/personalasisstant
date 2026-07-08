"use client";

import {
  CheckCircle2,
  Clipboard,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck
} from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  createTelegramSetup,
  getTelegramBindingStatus,
  sendTelegramTestMessage,
  type TelegramBindingStatusResponse,
  type TelegramSetupResponse,
  type TelegramTestMessageResponse
} from "../api/client";

type RequestState = "idle" | "loading" | "success" | "error";

const DEFAULT_TEST_MESSAGE = "Telegram is connected to your OneBrain assistant.";

export function TelegramSetupPanel() {
  const [botToken, setBotToken] = useState("");
  const [setup, setSetup] = useState<TelegramSetupResponse | null>(null);
  const [status, setStatus] = useState<TelegramBindingStatusResponse | null>(null);
  const [testMessage, setTestMessage] = useState(DEFAULT_TEST_MESSAGE);
  const [testResult, setTestResult] = useState<TelegramTestMessageResponse | null>(null);
  const [setupState, setSetupState] = useState<RequestState>("idle");
  const [statusState, setStatusState] = useState<RequestState>("idle");
  const [testState, setTestState] = useState<RequestState>("idle");
  const [error, setError] = useState<string | null>(null);

  const effectiveStatus = status?.status ?? setup?.status ?? "pending";
  const isVerified = effectiveStatus === "verified";
  const canSubmit = botToken.trim().length >= 8 && setupState !== "loading";

  const statusLabel = getStatusLabel(Boolean(setup), effectiveStatus);

  async function handleSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setSetupState("loading");
    setStatusState("idle");
    setTestState("idle");
    setError(null);
    setStatus(null);
    setTestResult(null);
    try {
      const nextSetup = await createTelegramSetup(botToken.trim());
      setSetup(nextSetup);
      setBotToken("");
      setSetupState("success");
    } catch {
      setSetupState("error");
      setError("Telegram setup could not be created.");
    }
  }

  async function handleStatusCheck() {
    if (!setup) {
      return;
    }
    setStatusState("loading");
    setError(null);
    try {
      const nextStatus = await getTelegramBindingStatus(setup.binding_id);
      setStatus(nextStatus);
      setStatusState("success");
    } catch {
      setStatusState("error");
      setError("Telegram binding status could not be checked.");
    }
  }

  async function handleSendTest() {
    if (!setup || !isVerified || testMessage.trim().length === 0) {
      return;
    }
    setTestState("loading");
    setError(null);
    try {
      const result = await sendTelegramTestMessage(setup.binding_id, testMessage.trim());
      setTestResult(result);
      setTestState("success");
    } catch {
      setTestState("error");
      setError("Telegram test message could not be queued.");
    }
  }

  async function copyCommand() {
    if (!setup || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(setup.binding_command);
  }

  return (
    <section aria-labelledby="telegram-heading" className="telegram-panel">
      <div className="section-header">
        <h2 id="telegram-heading" className="section-title">
          Telegram setup
        </h2>
        <span className="section-meta">{statusLabel}</span>
      </div>

      <div className="telegram-steps" aria-label="Telegram connection steps">
        <span data-active={!setup}>
          <KeyRound size={16} aria-hidden="true" />
          Bot token
        </span>
        <span data-active={Boolean(setup) && !isVerified}>
          <MessageCircle size={16} aria-hidden="true" />
          Private chat
        </span>
        <span data-active={isVerified}>
          <ShieldCheck size={16} aria-hidden="true" />
          Test message
        </span>
      </div>

      <form className="telegram-form" onSubmit={handleSetup}>
        <label className="field-label" htmlFor="telegram-token">
          BotFather token
        </label>
        <div className="token-row">
          <input
            autoComplete="off"
            className="text-field"
            id="telegram-token"
            minLength={8}
            onChange={(event) => setBotToken(event.target.value)}
            placeholder="123456:AA..."
            type="password"
            value={botToken}
          />
          <button className="icon-button" type="submit" disabled={!canSubmit}>
            {setupState === "loading" ? (
              <Loader2 className="spin" size={17} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={17} aria-hidden="true" />
            )}
            <span className="sr-only">Create Telegram binding</span>
          </button>
        </div>
      </form>

      <a
        className="telegram-link"
        href="https://t.me/BotFather"
        rel="noreferrer"
        target="_blank"
      >
        <ExternalLink size={16} aria-hidden="true" />
        Open BotFather
      </a>

      {setup ? (
        <div className="telegram-command">
          <div>
            <span>Send to your bot</span>
            <code>{setup.binding_command}</code>
          </div>
          <button className="icon-button" onClick={copyCommand} type="button">
            <Clipboard size={17} aria-hidden="true" />
            <span className="sr-only">Copy Telegram command</span>
          </button>
        </div>
      ) : null}

      {setup ? (
        <div className="telegram-actions">
          <button
            className="text-button"
            data-variant="primary"
            disabled={statusState === "loading"}
            onClick={handleStatusCheck}
            type="button"
          >
            {statusState === "loading" ? (
              <Loader2 className="spin" size={16} aria-hidden="true" />
            ) : (
              <ShieldCheck size={16} aria-hidden="true" />
            )}
            Check status
          </button>
          <span className="telegram-state" data-state={effectiveStatus}>
            {effectiveStatus}
          </span>
        </div>
      ) : null}

      {isVerified ? (
        <div className="telegram-test">
          <label className="field-label" htmlFor="telegram-test-message">
            Test message
          </label>
          <textarea
            className="text-area"
            id="telegram-test-message"
            maxLength={240}
            onChange={(event) => setTestMessage(event.target.value)}
            rows={3}
            value={testMessage}
          />
          <button
            className="text-button"
            data-variant="primary"
            disabled={testState === "loading" || testMessage.trim().length === 0}
            onClick={handleSendTest}
            type="button"
          >
            {testState === "loading" ? (
              <Loader2 className="spin" size={16} aria-hidden="true" />
            ) : (
              <Send size={16} aria-hidden="true" />
            )}
            Send test
          </button>
        </div>
      ) : null}

      {testResult ? (
        <div className="telegram-result" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {testResult.detail}
        </div>
      ) : null}

      {error ? (
        <div className="telegram-error" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
}

function getStatusLabel(hasSetup: boolean, status: string) {
  if (!hasSetup) {
    return "Not connected";
  }
  if (status === "verified") {
    return "Verified";
  }
  if (status === "paused") {
    return "Paused";
  }
  if (status === "expired") {
    return "Expired";
  }
  return "Waiting";
}
