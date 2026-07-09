"use client";

import {
  CheckCircle2,
  CloudOff,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  Trash2
} from "lucide-react";
import { useState } from "react";
import type { ProviderStatusResponse } from "../api/client";
import {
  disconnectProviderAccount,
  requestProviderSync,
  startProviderOAuth
} from "../api/client";

type ProviderName = "google" | "microsoft";
type RequestState = "idle" | "loading" | "success" | "error";

const providerLabels: Record<ProviderName, string> = {
  google: "Google",
  microsoft: "Microsoft"
};

export function ProviderAccountsPanel({ status }: { status: ProviderStatusResponse }) {
  const [providerStatus, setProviderStatus] = useState(status);
  const [requestState, setRequestState] = useState<Record<string, RequestState>>({});
  const [message, setMessage] = useState<string | null>(null);
  const providers = providerStatus.providers ?? [];
  const accounts = providerStatus.accounts ?? [];

  async function handleConnect(provider: ProviderName) {
    setRequestState((current) => ({ ...current, [`connect:${provider}`]: "loading" }));
    setMessage(null);
    try {
      const result = await startProviderOAuth(provider);
      if (!result.configured || !result.authorization_url) {
        setMessage(result.detail);
        setRequestState((current) => ({ ...current, [`connect:${provider}`]: "error" }));
        return;
      }
      window.location.href = result.authorization_url;
    } catch {
      setMessage(`${providerLabels[provider]} connection could not be started.`);
      setRequestState((current) => ({ ...current, [`connect:${provider}`]: "error" }));
    }
  }

  async function handleSync(accountId: string) {
    setRequestState((current) => ({ ...current, [`sync:${accountId}`]: "loading" }));
    setMessage(null);
    try {
      const result = await requestProviderSync(accountId);
      setMessage(result.detail);
      setProviderStatus((current) => ({
        ...current,
        accounts: (current.accounts ?? []).map((account) =>
          account.provider_account_id === accountId
            ? { ...account, sync_state: "queued" }
            : account
        )
      }));
      setRequestState((current) => ({ ...current, [`sync:${accountId}`]: "success" }));
    } catch {
      setMessage("Provider sync could not be queued.");
      setRequestState((current) => ({ ...current, [`sync:${accountId}`]: "error" }));
    }
  }

  async function handleDisconnect(accountId: string) {
    setRequestState((current) => ({ ...current, [`disconnect:${accountId}`]: "loading" }));
    setMessage(null);
    try {
      const result = await disconnectProviderAccount(accountId);
      setProviderStatus((current) => ({
        ...current,
        accounts: (current.accounts ?? []).map((account) =>
          account.provider_account_id === accountId
            ? { ...account, status: result.status, sync_state: "idle" }
            : account
        )
      }));
      setMessage(result.detail);
      setRequestState((current) => ({ ...current, [`disconnect:${accountId}`]: "success" }));
    } catch {
      setMessage("Provider account could not be disconnected.");
      setRequestState((current) => ({ ...current, [`disconnect:${accountId}`]: "error" }));
    }
  }

  return (
    <section aria-labelledby="providers-heading" className="provider-panel">
      <div className="section-header">
        <h2 id="providers-heading" className="section-title">
          Connections
        </h2>
        <span className="section-meta">{accounts.length}</span>
      </div>

      <div className="provider-configs">
        {providers.map((provider) => {
          const key = provider.provider as ProviderName;
          const loading = requestState[`connect:${key}`] === "loading";
          const missingConfig = provider.missing_config ?? [];
          return (
            <article className="provider-config-row" key={provider.provider}>
              <div className="provider-config-main">
                <span className="provider-icon" data-provider={provider.provider}>
                  {provider.configured ? (
                    <CheckCircle2 size={17} aria-hidden="true" />
                  ) : (
                    <CloudOff size={17} aria-hidden="true" />
                  )}
                </span>
                <div>
                  <strong>{provider.display_name}</strong>
                  <p>{provider.configured ? "OAuth ready" : missingConfig.join(", ")}</p>
                </div>
              </div>
              <button
                className="icon-button"
                onClick={() => handleConnect(key)}
                type="button"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="spin" size={17} aria-hidden="true" />
                ) : (
                  <KeyRound size={17} aria-hidden="true" />
                )}
                <span className="sr-only">Connect {provider.display_name}</span>
              </button>
            </article>
          );
        })}
      </div>

      <div className="provider-account-list">
        {accounts.length > 0 ? (
          accounts.map((account) => {
            const syncLoading =
              requestState[`sync:${account.provider_account_id}`] === "loading";
            const disconnectLoading =
              requestState[`disconnect:${account.provider_account_id}`] === "loading";
            return (
              <article className="provider-account-card" key={account.provider_account_id}>
                <div className="provider-account-top">
                  <div>
                    <strong>{account.display_name || account.email}</strong>
                    <p>{account.email || account.provider_account_ref}</p>
                  </div>
                  <span className="provider-state" data-state={account.status}>
                    {account.status}
                  </span>
                </div>
                <div className="scope-ledger" aria-label="Granted capabilities">
                  <span data-active={account.mail_enabled}>
                    <Mail size={14} aria-hidden="true" />
                    Mail
                  </span>
                  <span data-active={account.calendar_enabled}>Calendar</span>
                  <span data-active={account.missing_scopes.length === 0}>Read scopes</span>
                </div>
                <div className="provider-account-actions">
                  <button
                    className="text-button"
                    onClick={() => handleSync(account.provider_account_id)}
                    type="button"
                    disabled={syncLoading || account.status === "disconnected"}
                  >
                    {syncLoading ? (
                      <Loader2 className="spin" size={16} aria-hidden="true" />
                    ) : (
                      <RefreshCw size={16} aria-hidden="true" />
                    )}
                    Sync
                  </button>
                  <button
                    className="text-button"
                    data-variant="quiet"
                    onClick={() => handleDisconnect(account.provider_account_id)}
                    type="button"
                    disabled={disconnectLoading || account.status === "disconnected"}
                  >
                    {disconnectLoading ? (
                      <Loader2 className="spin" size={16} aria-hidden="true" />
                    ) : (
                      <Trash2 size={16} aria-hidden="true" />
                    )}
                    Disconnect
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <article className="provider-empty">
            <CloudOff size={17} aria-hidden="true" />
            <div>
              <strong>No mail or calendar account</strong>
              <p>Connect read-only Google or Microsoft access when credentials are configured.</p>
            </div>
          </article>
        )}
      </div>

      {message ? (
        <div className="provider-message" role="status">
          {message}
        </div>
      ) : null}
    </section>
  );
}
