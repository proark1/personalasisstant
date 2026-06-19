import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { strictAppOrigin } from "../_shared/cors.ts";
import { generateStructured } from "../_shared/geminiStructured.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "X-Content-Type-Options": "nosniff",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { documentPath, documentType } = await req.json();

    // Validate documentPath to prevent path traversal
    if (
      !documentPath ||
      typeof documentPath !== "string" ||
      documentPath.includes("..") ||
      documentPath.startsWith("/")
    ) {
      return new Response(JSON.stringify({ error: "Invalid document path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Get Supabase client to fetch the document
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get signed URL for the document
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("contract-documents")
      .createSignedUrl(documentPath, 60 * 5); // 5 minutes

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new Error("Failed to get document URL");
    }

    // For PDFs, we'll use vision capabilities with the document
    // For images, we can directly analyze them
    const isImage =
      documentType?.startsWith("image/") ||
      documentPath.endsWith(".jpg") ||
      documentPath.endsWith(".jpeg") ||
      documentPath.endsWith(".png") ||
      documentPath.endsWith(".webp");

    const isPdf = documentType === "application/pdf" || documentPath.endsWith(".pdf");

    if (!isImage && !isPdf) {
      throw new Error("Unsupported document type");
    }

    // The native generateContent endpoint can't fetch the signed URL, so
    // download the document and send it inline (base64).
    const docResp = await fetch(signedUrlData.signedUrl, { signal: AbortSignal.timeout(15_000) });
    if (!docResp.ok) {
      throw new Error("Failed to download document");
    }
    const docMime =
      docResp.headers.get("content-type") ||
      (isPdf
        ? "application/pdf"
        : documentType?.startsWith("image/")
          ? documentType
          : "image/jpeg");
    const docB64 = base64Encode(new Uint8Array(await docResp.arrayBuffer()));

    const promptText = `Analyze this contract document and extract the following information in JSON format:
{
  "name": "contract name or title",
  "provider": "company/provider name",
  "category": "one of: insurance, utilities, subscription, phone, internet, streaming, other",
  "costAmount": number or null,
  "costFrequency": "monthly, quarterly, yearly, or one_time",
  "startDate": "YYYY-MM-DD or null",
  "endDate": "YYYY-MM-DD or null",
  "renewalDate": "YYYY-MM-DD or null",
  "cancellationNoticeDays": number (default 30),
  "autoRenews": boolean,
  "contractNumber": "string or null",
  "notes": "brief summary of key terms"
}

Be thorough but only include information you can clearly extract from the document. Return ONLY valid JSON.`;

    const contractSchema = {
      type: "object",
      properties: {
        name: { type: "string" },
        provider: { type: "string" },
        category: {
          type: "string",
          enum: [
            "insurance",
            "utilities",
            "subscription",
            "phone",
            "internet",
            "streaming",
            "other",
          ],
        },
        costAmount: { type: "number", nullable: true },
        costFrequency: { type: "string", enum: ["monthly", "quarterly", "yearly", "one_time"] },
        startDate: { type: "string", nullable: true },
        endDate: { type: "string", nullable: true },
        renewalDate: { type: "string", nullable: true },
        cancellationNoticeDays: { type: "number" },
        autoRenews: { type: "boolean" },
        contractNumber: { type: "string", nullable: true },
        notes: { type: "string" },
      },
      required: ["name", "provider", "category"],
    };

    let extractedData;
    try {
      extractedData = await generateStructured({
        system:
          "You are a contract analysis expert. Extract key information from contracts accurately. Always respond with valid JSON only.",
        parts: [{ text: promptText }, { inlineData: { mimeType: docMime, data: docB64 } }],
        schema: contractSchema,
        model: "gemini-2.5-flash",
        maxOutputTokens: 2000,
        timeoutMs: 30_000,
      });
    } catch (aiError) {
      const message = aiError instanceof Error ? aiError.message : "AI gateway error";
      console.error("AI gateway error:", message);

      if (message.includes("429")) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (message.includes("402")) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      extractedData = { error: "Could not parse contract details" };
    }

    return new Response(JSON.stringify({ success: true, data: extractedData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scan contract error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
