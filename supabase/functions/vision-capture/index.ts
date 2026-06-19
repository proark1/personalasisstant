// Vision-first capture: classify + extract.
//
// Body: { storage_path: string, mime_type?: string, size_bytes?: number,
//         hint_kind?: 'receipt'|'business_card'|... }
//
// Flow:
//   1. Insert vision_captures row (status='classifying').
//   2. Generate a short-lived signed URL for the uploaded image.
//   3. Call Gemini Vision via the generativelanguage API with a forced
//      tool-call. The tool's schema makes it return classification +
//      per-kind structured fields in one round-trip.
//   4. Patch the row with extracted data (status='extracted').
//   5. Return { capture_id, detected_kind, extracted, ocr_text } so
//      the UI can render an editable preview.
//
// Errors anywhere mark status='error' so the user has an audit trail.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertWithinQuota } from "../_shared/ai-quota.ts";
import { strictAppOrigin } from "../_shared/cors.ts";
import { generateStructured } from "../_shared/geminiStructured.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const _MODEL = "gemini-2.5-flash"; // referenced via _shared/geminiStructured.ts default

const ALLOWED_KINDS = [
  "receipt",
  "business_card",
  "medication",
  "whiteboard",
  "label",
  "document",
  "contract",
  "inventory",
  "unknown",
] as const;
type Kind = (typeof ALLOWED_KINDS)[number];

const SYSTEM_PROMPT = [
  "You are a vision worker for a personal assistant. Look at the image and:",
  "  1. Classify what kind of physical thing it is.",
  "  2. Extract structured data appropriate to that kind.",
  "  3. Always also return ocr_text — the verbatim text you can read.",
  "",
  "Kinds:",
  "- receipt:        a transactional receipt (store, restaurant, online order).",
  "- business_card:  a printed personal/business card with contact details.",
  "- medication:     a pill bottle, blister pack, or medication label.",
  "- whiteboard:     a whiteboard / notebook / sticky-note with handwritten or markered notes.",
  "- label:          packaging or signage in a foreign language the user wants translated.",
  "- document:       a printed document that is NOT a contract (e.g. official letter).",
  "- contract:       a contract / lease / subscription agreement.",
  "- inventory:      product packaging where the user wants to track the item (warranty, model number).",
  "- unknown:        none of the above — emit ocr_text only.",
  "",
  'Be conservative with classification. If you are <60% sure, return "unknown" and surface the text.',
].join("\n");

const TOOL = {
  type: "function",
  function: {
    name: "record_vision_capture",
    description: "Record the classification and per-kind extraction.",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ALLOWED_KINDS as unknown as string[] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        ocr_text: { type: "string" },
        source_language: {
          type: "string",
          description: "ISO-639-1 code if foreign-language text was detected.",
        },
        // Per-kind details. The model fills in only the keys for the
        // kind it picked.
        receipt: {
          type: "object",
          properties: {
            merchant: { type: "string" },
            total: { type: "number" },
            currency: { type: "string", description: "ISO 4217" },
            date: { type: "string", description: "YYYY-MM-DD" },
            category: {
              type: "string",
              description: "e.g. groceries, restaurant, transport, electronics",
            },
            line_items: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" }, amount: { type: "number" } },
              },
              maxItems: 50,
            },
            tax: { type: "number" },
          },
        },
        business_card: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            company: { type: "string" },
            role: { type: "string" },
            website: { type: "string" },
            address: { type: "string" },
          },
        },
        medication: {
          type: "object",
          properties: {
            name: { type: "string" },
            dose: { type: "string", description: "e.g. 500 mg" },
            frequency: { type: "string", description: "e.g. twice daily" },
            schedule: { type: "string", description: "with food / morning + evening / etc." },
            prescriber: { type: "string" },
            refill_date: { type: "string", description: "YYYY-MM-DD" },
            warnings: { type: "array", items: { type: "string" }, maxItems: 6 },
          },
        },
        whiteboard: {
          type: "object",
          properties: {
            title: { type: "string" },
            summary: { type: "string" },
            bullets: { type: "array", items: { type: "string" }, maxItems: 30 },
          },
        },
        label: {
          type: "object",
          properties: {
            translation: { type: "string" },
            target_language: {
              type: "string",
              description: "ISO-639-1 to translate INTO. Default en.",
            },
          },
        },
        document: {
          type: "object",
          properties: { title: { type: "string" }, summary: { type: "string" } },
        },
        contract: {
          type: "object",
          properties: {
            name: { type: "string" },
            provider: { type: "string" },
            cost_amount: { type: "number" },
            cost_frequency: { type: "string" },
            renewal_date: { type: "string" },
          },
        },
        inventory: {
          type: "object",
          properties: {
            name: { type: "string" },
            brand: { type: "string" },
            model: { type: "string" },
            serial: { type: "string" },
            warranty_until: { type: "string" },
          },
        },
      },
      required: ["kind", "ocr_text"],
    },
  },
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
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const storagePath = String(body.storage_path || "").trim();
    if (!storagePath || storagePath.includes("..") || storagePath.startsWith("/")) {
      return json({ error: "invalid storage_path" }, 400);
    }
    // Defense in depth: only the calling user's own folder may be scanned.
    if (!storagePath.startsWith(`${user.id}/`)) {
      return json({ error: "storage_path must be inside your own folder" }, 403);
    }
    const mimeType = typeof body.mime_type === "string" ? body.mime_type : null;
    const sizeBytes = Number.isInteger(body.size_bytes) ? body.size_bytes : null;
    const hintKind = ALLOWED_KINDS.includes(body.hint_kind) ? (body.hint_kind as Kind) : null;
    const bucket = typeof body.bucket === "string" ? body.bucket : "chat-attachments";

    // 1. Insert capture row.
    const { data: row, error: insErr } = await admin
      .from("vision_captures")
      .insert({
        user_id: user.id,
        bucket,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        hint_kind: hintKind,
        status: "classifying",
      })
      .select("id")
      .single();
    if (insErr || !row) return json({ error: insErr?.message || "insert failed" }, 500);

    // 2. Signed URL — short-lived, used only for this AI call.
    const { data: signed, error: signErr } = await admin.storage
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 5);
    if (signErr || !signed?.signedUrl) {
      await admin
        .from("vision_captures")
        .update({
          status: "error",
          error_message: signErr?.message || "Could not sign URL",
        })
        .eq("id", row.id);
      return json({ error: "Could not sign image URL" }, 500);
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      await admin
        .from("vision_captures")
        .update({
          status: "error",
          error_message: "GEMINI_API_KEY not configured",
        })
        .eq("id", row.id);
      return json({ error: "AI not configured" }, 503);
    }

    // AI cost gate — rejects when the user has burned their monthly cap.
    try {
      await assertWithinQuota(admin, user.id);
    } catch (e) {
      const code = e instanceof Object && "code" in e ? (e as { code?: string }).code : undefined;
      const errMsg = e instanceof Error ? e.message : String(e);
      await admin
        .from("vision_captures")
        .update({
          status: "error",
          error_message: errMsg,
        })
        .eq("id", row.id);
      return json({ error: errMsg, code }, code === "quota_exceeded" ? 429 : 500);
    }

    // 3. Gemini Vision via gateway, forced tool-call.
    const userText = hintKind
      ? `The user expects this to be a ${hintKind}. If you disagree based on what you see, return your best classification anyway.`
      : "Classify the image and extract structured fields appropriate to that kind. Always return ocr_text.";

    // Native generateContent + responseSchema (the OpenAI-compat endpoint with
    // forced tool_choice fails in our deployment). The native endpoint can't
    // fetch the signed URL, so download the image and send it inline (base64).
    let parsed: Record<string, unknown>;
    try {
      const imgResp = await fetch(signed.signedUrl, { signal: AbortSignal.timeout(15_000) });
      if (!imgResp.ok) throw new Error(`image fetch ${imgResp.status}`);
      const imgMime = imgResp.headers.get("content-type") || "image/jpeg";
      const imgB64 = base64Encode(new Uint8Array(await imgResp.arrayBuffer()));
      parsed = await generateStructured({
        system: SYSTEM_PROMPT,
        parts: [{ text: userText }, { inlineData: { mimeType: imgMime, data: imgB64 } }],
        schema: TOOL.function.parameters,
        temperature: 0,
        timeoutMs: 45_000,
      });
    } catch (e) {
      await admin
        .from("vision_captures")
        .update({
          status: "error",
          error_message: (e as Error).message,
        })
        .eq("id", row.id);
      return json({ error: "AI extraction failed" }, 502);
    }

    const detectedKind: Kind = ALLOWED_KINDS.includes(parsed?.kind) ? parsed.kind : "unknown";
    const ocrText = typeof parsed?.ocr_text === "string" ? parsed.ocr_text.slice(0, 8000) : "";
    const sourceLanguage =
      typeof parsed?.source_language === "string" ? parsed.source_language.slice(0, 8) : null;
    const confidence = typeof parsed?.confidence === "number" ? clamp01(parsed.confidence) : null;
    // Pick out the matching per-kind block.
    const extracted =
      parsed?.[detectedKind] && typeof parsed[detectedKind] === "object"
        ? sanitiseExtracted(detectedKind, parsed[detectedKind])
        : {};

    await admin
      .from("vision_captures")
      .update({
        detected_kind: detectedKind,
        classification_confidence: confidence,
        extracted,
        ocr_text: ocrText,
        source_language: sourceLanguage,
        status: "extracted",
      })
      .eq("id", row.id);

    return json({
      capture_id: row.id,
      detected_kind: detectedKind,
      classification_confidence: confidence,
      extracted,
      ocr_text: ocrText,
      source_language: sourceLanguage,
    });
  } catch (err) {
    console.error("[vision-capture] failed", (err as Error).message);
    return json({ error: (err as Error).message }, 500);
  }
});

// Sanitise + slice each per-kind extraction so a model that hallucinates
// extra keys can't spam our DB. Also clamps strings.
function sanitiseExtracted(kind: Kind, raw: Record<string, unknown>): Record<string, unknown> {
  const s = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const arr = (v: unknown, n: number) => (Array.isArray(v) ? v.slice(0, n) : []);
  switch (kind) {
    case "receipt":
      return {
        merchant: s(raw.merchant, 200),
        total: num(raw.total),
        currency: s(raw.currency, 8),
        date: s(raw.date, 10),
        category: s(raw.category, 80),
        line_items: arr(raw.line_items, 50).map((it: unknown) => {
          const item = it as Record<string, unknown>;
          return { name: s(item?.name, 200), amount: num(item?.amount) };
        }),
        tax: num(raw.tax),
      };
    case "business_card":
      return {
        name: s(raw.name, 200),
        email: s(raw.email, 200),
        phone: s(raw.phone, 80),
        company: s(raw.company, 200),
        role: s(raw.role, 200),
        website: s(raw.website, 200),
        address: s(raw.address, 400),
      };
    case "medication":
      return {
        name: s(raw.name, 200),
        dose: s(raw.dose, 80),
        frequency: s(raw.frequency, 80),
        schedule: s(raw.schedule, 200),
        prescriber: s(raw.prescriber, 200),
        refill_date: s(raw.refill_date, 10),
        warnings: arr(raw.warnings, 6)
          .map((w: unknown) => s(w, 300))
          .filter(Boolean),
      };
    case "whiteboard":
      return {
        title: s(raw.title, 200),
        summary: s(raw.summary, 1000),
        bullets: arr(raw.bullets, 30)
          .map((b: unknown) => s(b, 400))
          .filter(Boolean),
      };
    case "label":
      return {
        translation: s(raw.translation, 4000),
        target_language: s(raw.target_language, 8) || "en",
      };
    case "document":
      return { title: s(raw.title, 200), summary: s(raw.summary, 4000) };
    case "contract":
      return {
        name: s(raw.name, 200),
        provider: s(raw.provider, 200),
        cost_amount: num(raw.cost_amount),
        cost_frequency: s(raw.cost_frequency, 30),
        renewal_date: s(raw.renewal_date, 10),
      };
    case "inventory":
      return {
        name: s(raw.name, 200),
        brand: s(raw.brand, 100),
        model: s(raw.model, 100),
        serial: s(raw.serial, 100),
        warranty_until: s(raw.warranty_until, 10),
      };
    default:
      return {};
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

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
