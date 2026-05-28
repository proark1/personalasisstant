import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strictAppOrigin } from '../_shared/cors.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": strictAppOrigin(),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  'X-Content-Type-Options': 'nosniff',
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
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { documentPath, documentType } = await req.json();

    // Validate documentPath to prevent path traversal
    if (!documentPath || typeof documentPath !== "string" || documentPath.includes("..") || documentPath.startsWith("/")) {
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
    const isImage = documentType?.startsWith("image/") || 
      documentPath.endsWith(".jpg") || 
      documentPath.endsWith(".jpeg") || 
      documentPath.endsWith(".png") || 
      documentPath.endsWith(".webp");

    const isPdf = documentType === "application/pdf" || documentPath.endsWith(".pdf");

    let content: any[];

    if (isImage) {
      // For images, use vision
      content = [
        {
          type: "text",
          text: `Analyze this contract document image and extract the following information in JSON format:
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

Be thorough but only include information you can clearly extract from the document. Return ONLY valid JSON.`
        },
        {
          type: "image_url",
          image_url: {
            url: signedUrlData.signedUrl
          }
        }
      ];
    } else if (isPdf) {
      // For PDFs, we'll need to download and extract text first
      // Gemini can handle PDF URLs directly
      content = [
        {
          type: "text",
          text: `Analyze this contract document and extract the following information in JSON format:
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

Document URL: ${signedUrlData.signedUrl}

Be thorough but only include information you can clearly extract from the document. Return ONLY valid JSON.`
        }
      ];
    } else {
      throw new Error("Unsupported document type");
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a contract analysis expert. Extract key information from contracts accurately. Always respond with valid JSON only."
          },
          {
            role: "user",
            content
          }
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const content_text = aiResponse.choices?.[0]?.message?.content || "";

    // Parse the JSON from the response
    let extractedData;
    try {
      // Try to find JSON in the response (handle markdown code blocks)
      const jsonMatch = content_text.match(/```json\s*([\s\S]*?)\s*```/) || 
                        content_text.match(/```\s*([\s\S]*?)\s*```/) ||
                        [null, content_text];
      extractedData = JSON.parse(jsonMatch[1] || content_text);
    } catch (parseError) {
      console.error("Failed to parse AI response:", content_text);
      extractedData = { error: "Could not parse contract details" };
    }

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scan contract error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
