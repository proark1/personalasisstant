// Plaid HTTP client.
//
// Plaid auth is body-based: every POST carries client_id + secret in
// the JSON. We never put either on the wire from the client — the
// Supabase edge function holds the credentials and proxies.
//
// Required secrets:
//   PLAID_CLIENT_ID
//   PLAID_SECRET             (matches the env below)
//   PLAID_ENV                'sandbox' | 'development' | 'production'
//                            (defaults to 'sandbox' so a misconfigured
//                            deploy can't accidentally hit production)
//   APP_URL                  used as the OAuth redirect base for
//                            European bank flows (Plaid Link returns
//                            via this URL).
//
// All helpers throw on non-2xx so callers wrap once.

const KEEPALIVE_MS = 30_000;
const PLAID_VERSION = '2020-09-14';
const CLIENT_NAME = 'DarAI';

export interface PlaidConfig {
  clientId: string;
  secret: string;
  env: 'sandbox' | 'development' | 'production';
  baseUrl: string;
}

export function loadConfig(): PlaidConfig {
  const clientId = Deno.env.get('PLAID_CLIENT_ID') || '';
  const secret = Deno.env.get('PLAID_SECRET') || '';
  const envRaw = (Deno.env.get('PLAID_ENV') || 'sandbox').toLowerCase();
  if (!clientId) throw new Error('PLAID_CLIENT_ID is not configured');
  if (!secret) throw new Error('PLAID_SECRET is not configured');
  if (!['sandbox', 'development', 'production'].includes(envRaw)) {
    throw new Error(`PLAID_ENV must be sandbox|development|production, got ${envRaw}`);
  }
  const env = envRaw as PlaidConfig['env'];
  return {
    clientId,
    secret,
    env,
    baseUrl: `https://${env}.plaid.com`,
  };
}

async function call<T>(
  cfg: PlaidConfig,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Plaid-Version': PLAID_VERSION,
    },
    body: JSON.stringify({
      client_id: cfg.clientId,
      secret: cfg.secret,
      ...body,
    }),
    signal: AbortSignal.timeout(KEEPALIVE_MS),
  });
  const text = await res.text();
  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { /* keep as text */ }
  if (!res.ok) {
    const err = parsed?.error_code || parsed?.error_message || text || `HTTP ${res.status}`;
    const e = new Error(`Plaid ${path} failed: ${err}`);
    (e as Error & { plaidError: unknown; status: number }).plaidError = parsed;
    (e as Error & { plaidError: unknown; status: number }).status = res.status;
    throw e;
  }
  return parsed as T;
}

// ============ link/token/create ============
export interface LinkTokenCreateArgs {
  userId: string;
  language?: string;          // 'en' | 'fr' | 'de' | etc.
  countryCodes?: string[];    // ['US', 'GB', 'DE', ...]
  // Plaid Link uses these to scope what flows are available. We
  // request both transactions + auth for budget tracking + balance.
  products?: string[];
  // Required for European bank flows (PSD2). Set to a URL Plaid
  // will redirect back to after OAuth.
  redirectUri?: string;
  webhookUrl?: string;
}

export interface LinkTokenResponse {
  link_token: string;
  expiration: string;
  request_id: string;
}

export async function createLinkToken(
  cfg: PlaidConfig,
  args: LinkTokenCreateArgs,
): Promise<LinkTokenResponse> {
  return await call<LinkTokenResponse>(cfg, '/link/token/create', {
    user: { client_user_id: args.userId },
    client_name: CLIENT_NAME,
    products: args.products && args.products.length ? args.products : ['transactions'],
    country_codes: args.countryCodes && args.countryCodes.length ? args.countryCodes : ['US'],
    language: args.language || 'en',
    redirect_uri: args.redirectUri,
    webhook: args.webhookUrl,
  });
}

// ============ item/public_token/exchange ============
export interface ExchangeResponse {
  access_token: string;
  item_id: string;
  request_id: string;
}

export async function exchangePublicToken(
  cfg: PlaidConfig,
  publicToken: string,
): Promise<ExchangeResponse> {
  return await call<ExchangeResponse>(cfg, '/item/public_token/exchange', {
    public_token: publicToken,
  });
}

// ============ accounts/get ============
export interface PlaidAccount {
  account_id: string;
  name: string;
  official_name?: string;
  mask?: string;
  type: string;       // 'depository' | 'credit' | 'loan' | 'investment'
  subtype?: string;   // 'checking' | 'savings' | 'credit card' | …
  balances: {
    available?: number | null;
    current?: number | null;
    iso_currency_code?: string | null;
  };
}

export interface AccountsGetResponse {
  accounts: PlaidAccount[];
  item: { item_id: string; institution_id?: string };
  request_id: string;
}

export async function getAccounts(
  cfg: PlaidConfig,
  accessToken: string,
): Promise<AccountsGetResponse> {
  return await call<AccountsGetResponse>(cfg, '/accounts/get', {
    access_token: accessToken,
  });
}

// ============ institutions/get_by_id ============
export interface InstitutionsGetByIdResponse {
  institution: { institution_id: string; name: string; country_codes: string[] };
  request_id: string;
}

export async function getInstitution(
  cfg: PlaidConfig,
  institutionId: string,
  countryCodes: string[],
): Promise<InstitutionsGetByIdResponse> {
  return await call<InstitutionsGetByIdResponse>(cfg, '/institutions/get_by_id', {
    institution_id: institutionId,
    country_codes: countryCodes,
  });
}

// ============ transactions/sync ============
export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;            // positive = outflow, negative = inflow
  iso_currency_code?: string | null;
  unofficial_currency_code?: string | null;
  date: string;              // YYYY-MM-DD
  authorized_date?: string | null;
  name: string;
  merchant_name?: string | null;
  payment_channel?: string | null;
  pending: boolean;
  category?: string[] | null;
  personal_finance_category?: { primary: string; detailed: string; confidence_level?: string } | null;
}

export interface TransactionsSyncResponse {
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removed: { transaction_id: string }[];
  next_cursor: string;
  has_more: boolean;
  accounts: PlaidAccount[];
  request_id: string;
}

export async function syncTransactions(
  cfg: PlaidConfig,
  accessToken: string,
  cursor: string,
  count = 200,
): Promise<TransactionsSyncResponse> {
  return await call<TransactionsSyncResponse>(cfg, '/transactions/sync', {
    access_token: accessToken,
    cursor,
    count,
  });
}

// ============ item/remove ============
// Removes the Item upstream so the access_token can no longer be used.
// We call this on disconnect; the local row is deleted separately.
export async function removeItem(
  cfg: PlaidConfig,
  accessToken: string,
): Promise<void> {
  await call<{ request_id: string }>(cfg, '/item/remove', {
    access_token: accessToken,
  });
}

// ============ helpers ============

// Map Plaid account type/subtype to our local enum-ish account_type.
export function normaliseAccountType(type: string, subtype?: string): string {
  const t = (type || '').toLowerCase();
  const s = (subtype || '').toLowerCase();
  if (t === 'depository') {
    if (s === 'savings') return 'savings';
    return 'checking';
  }
  if (t === 'credit') return 'credit_card';
  if (t === 'loan') return 'loan';
  if (t === 'investment') return 'investment';
  return t || 'checking';
}

// Plaid stores positive=outflow. We store direction as 'expense' /
// 'income' with `amount` always positive.
export function normaliseTransaction(t: PlaidTransaction): {
  amount: number;
  direction: 'expense' | 'income';
} {
  if (t.amount >= 0) return { amount: t.amount, direction: 'expense' };
  return { amount: Math.abs(t.amount), direction: 'income' };
}
