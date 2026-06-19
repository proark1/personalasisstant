// Exchange a Plaid public_token for an access_token and persist
// the connection + initial accounts. We deliberately DO NOT pull
// transactions in this function — that's plaid-sync's job, called
// immediately after by the frontend (or eagerly here, but keeping
// them split keeps the exchange call snappy).
//
// Body: { public_token: string, institution?: { id, name, country_codes? } }
//
// Behavior:
//   1. POST /item/public_token/exchange → access_token + item_id.
//   2. Upsert bank_connections row (sync_cursor='', status='good').
//   3. POST /accounts/get → upsert into financial_accounts. Each
//      account row gets bank_connection_id back-ref and external_id
//      set to Plaid's account_id so /plaid-sync can match.
//   4. Return { connection_id, accounts_count } so the UI can
//      navigate to the new connection's detail card.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  exchangePublicToken,
  getAccounts,
  getInstitution,
  loadConfig,
  normaliseAccountType,
} from "../_shared/plaid.ts";
import { encryptToken } from "../_shared/encryption.ts";
import { strictAppOrigin } from "../_shared/cors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
      error: uErr,
    } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const publicToken = String(body.public_token || "").trim();
    if (!publicToken) return json({ error: "public_token is required" }, 400);

    const institutionInput =
      body.institution && typeof body.institution === "object" ? body.institution : null;
    const institutionId: string | null = institutionInput?.id ? String(institutionInput.id) : null;
    const institutionNameHint: string | null = institutionInput?.name
      ? String(institutionInput.name)
      : null;
    const countryCodes: string[] = Array.isArray(institutionInput?.country_codes)
      ? institutionInput.country_codes.map((c: unknown) => String(c).toUpperCase()).slice(0, 5)
      : ["US"];

    let cfg;
    try {
      cfg = loadConfig();
    } catch (e) {
      return json({ error: "Plaid not configured", details: (e as Error).message }, 503);
    }

    // 1. Exchange.
    let exchanged;
    try {
      exchanged = await exchangePublicToken(cfg, publicToken);
    } catch (e) {
      console.error("[plaid-exchange] exchange failed", (e as Error).message);
      return json({ error: (e as Error).message }, 502);
    }

    // 2. Look up the institution name if we don't have it.
    let institutionName: string | null = institutionNameHint;
    if (institutionId && !institutionName) {
      try {
        const inst = await getInstitution(cfg, institutionId, countryCodes);
        institutionName = inst.institution.name;
      } catch (e) {
        console.warn("[plaid-exchange] institution lookup failed", (e as Error).message);
      }
    }

    // 3. Upsert bank_connections — access_token is encrypted at rest;
    //    the DB never sees the plaintext.
    let cipher: string;
    try {
      cipher = await encryptToken(exchanged.access_token);
    } catch (e) {
      console.error("[plaid-exchange] encrypt failed", (e as Error).message);
      return json({ error: `BANK_TOKEN_SECRET misconfigured: ${(e as Error).message}` }, 503);
    }
    const { data: conn, error: connErr } = await admin
      .from("bank_connections")
      .upsert(
        {
          user_id: user.id,
          provider: "plaid",
          external_item_id: exchanged.item_id,
          access_token_ciphertext: cipher,
          institution_id: institutionId,
          institution_name: institutionName,
          status: "good",
          sync_cursor: "",
          metadata: { country_codes: countryCodes },
        },
        { onConflict: "user_id,provider,external_item_id" },
      )
      .select("id")
      .single();
    if (connErr || !conn) {
      console.error("[plaid-exchange] connection upsert failed", connErr?.message);
      return json({ error: connErr?.message || "connection upsert failed" }, 500);
    }

    // 4. Pull accounts and upsert.
    let accountsCount = 0;
    try {
      // Use the just-exchanged plaintext for this one call (still in
      // memory locally) — never re-read from the DB.
      const accounts = await getAccounts(cfg, exchanged.access_token);
      const rows = accounts.accounts.map((a) => ({
        user_id: user.id,
        bank_connection_id: conn.id,
        source: "plaid",
        external_id: a.account_id,
        name: a.official_name || a.name,
        account_type: normaliseAccountType(a.type, a.subtype),
        subtype: a.subtype || null,
        mask: a.mask || null,
        currency: a.balances.iso_currency_code || "USD",
        current_balance: a.balances.current ?? a.balances.available ?? 0,
        institution: institutionName,
        is_active: true,
      }));
      if (rows.length) {
        const { error: accErr, count } = await admin.from("financial_accounts").upsert(rows, {
          onConflict: "user_id,source,external_id",
          count: "exact",
        });
        if (accErr) {
          console.error("[plaid-exchange] account upsert failed", accErr.message);
          return json(
            {
              error: accErr.message,
              connection_id: conn.id,
            },
            500,
          );
        }
        accountsCount = count ?? rows.length;
      }
    } catch (e) {
      console.error("[plaid-exchange] accounts fetch failed", (e as Error).message);
      // Mark the connection healthy anyway — accounts can be re-pulled
      // by /plaid-sync. We just report what happened.
      return json({
        connection_id: conn.id,
        accounts_count: 0,
        warning: (e as Error).message,
      });
    }

    return json({
      connection_id: conn.id,
      accounts_count: accountsCount,
      institution_name: institutionName,
    });
  } catch (err) {
    console.error("[plaid-exchange] failed", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
