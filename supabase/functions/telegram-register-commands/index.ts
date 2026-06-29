import { strictAppOrigin } from "../_shared/cors.ts";
import {
  TELEGRAM_COMMANDS,
  TELEGRAM_GROUP_COMMANDS,
  TELEGRAM_GROUP_COMMANDS_DE,
  TELEGRAM_PRIVATE_COMMANDS,
  TELEGRAM_PRIVATE_COMMANDS_DE,
  TELEGRAM_WORKSPACE_COMMANDS,
  TELEGRAM_WORKSPACE_COMMANDS_DE,
  type TelegramBotCommand,
  validateTelegramCommands,
} from "../_shared/telegram-commands.ts";
// One-shot registration of Dori's slash commands with Telegram (BotFather menu).
// Call this once after deploy to populate the autocomplete menu users see when typing "/".
const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;

type CommandRegistration = {
  label: string;
  commands: readonly TelegramBotCommand[];
  scope?: Record<string, unknown>;
  language_code?: string;
};

const BASE_REGISTRATIONS: CommandRegistration[] = [
  // Backward-compatible default for clients that do not support scoped menus.
  { label: "default", commands: TELEGRAM_COMMANDS },
  { label: "private", commands: TELEGRAM_PRIVATE_COMMANDS, scope: { type: "all_private_chats" } },
  {
    label: "private_de",
    commands: TELEGRAM_PRIVATE_COMMANDS_DE,
    scope: { type: "all_private_chats" },
    language_code: "de",
  },
  { label: "groups", commands: TELEGRAM_GROUP_COMMANDS, scope: { type: "all_group_chats" } },
  {
    label: "groups_de",
    commands: TELEGRAM_GROUP_COMMANDS_DE,
    scope: { type: "all_group_chats" },
    language_code: "de",
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const auth = req.headers.get("Authorization") || "";
    if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const workspaceChatIds = Array.isArray(body?.workspaceChatIds)
      ? body.workspaceChatIds
          .map((id: unknown) => Number(id))
          .filter((id: number) => Number.isFinite(id))
      : [];
    const registrations: CommandRegistration[] = [
      ...BASE_REGISTRATIONS,
      ...workspaceChatIds.flatMap((chatId: number): CommandRegistration[] => [
        {
          label: `workspace_${chatId}`,
          commands: TELEGRAM_WORKSPACE_COMMANDS,
          scope: { type: "chat", chat_id: chatId },
        },
        {
          label: `workspace_${chatId}_de`,
          commands: TELEGRAM_WORKSPACE_COMMANDS_DE,
          scope: { type: "chat", chat_id: chatId },
          language_code: "de",
        },
      ]),
    ];
    const validationErrors = registrations.flatMap((entry) =>
      validateTelegramCommands(entry.commands).map((error) => `${entry.label}: ${error}`),
    );
    if (validationErrors.length > 0) {
      return new Response(JSON.stringify({ ok: false, errors: validationErrors }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const entry of registrations) {
      const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_API_KEY}/setMyCommands`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          commands: entry.commands,
          ...(entry.scope ? { scope: entry.scope } : {}),
          ...(entry.language_code ? { language_code: entry.language_code } : {}),
        }),
      });
      const data = await r.json();
      results.push({
        label: entry.label,
        ok: r.ok,
        telegram: data,
        registered: entry.commands.length,
      });
    }
    const ok = results.every((r) => r.ok);
    return new Response(JSON.stringify({ ok, results }), {
      status: ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
