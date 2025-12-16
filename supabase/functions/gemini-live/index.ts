import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
};

interface LiveSessionRequest {
  action: 'send_text';
  personality?: string;
  text?: string;
}

const personalityPrompts: Record<string, string> = {
  balanced: "You are Flux, a helpful and balanced AI assistant. Be clear, supportive, and efficient.",
  strict: "You are Flux in strict mode. Be direct, focused on productivity, and push the user to complete their tasks. No fluff, just results.",
  supportive: "You are Flux in supportive mode. Be empathetic, encouraging, and understanding. Celebrate progress and be patient.",
  creative: "You are Flux in creative mode. Think outside the box, brainstorm freely, and encourage exploration of new ideas.",
};

serve(async (req) => {
  // Handle WebSocket upgrade for live audio
  const upgradeHeader = req.headers.get("upgrade") || "";
  
  if (upgradeHeader.toLowerCase() === "websocket") {
    return handleWebSocket(req);
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle regular HTTP requests for text-based interaction
  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const { action, personality = 'balanced', text } = await req.json() as LiveSessionRequest;

    const systemPrompt = `${personalityPrompts[personality] || personalityPrompts.balanced}

You are having a real-time voice conversation. Keep responses conversational, natural, and concise (1-3 sentences unless more detail is needed).

You can help with:
- Task management (creating, updating, completing tasks)
- Calendar scheduling (creating events, checking availability)
- General questions and brainstorming
- Productivity advice

When the user asks to create a task or schedule an event, confirm what you'll do and provide brief confirmation.`;

    if (action === 'send_text') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nUser says: ${text}` }]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 256,
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't process that. Please try again.";

      return new Response(
        JSON.stringify({ text: responseText }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error('Gemini Live error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleWebSocket(req: Request): Promise<Response> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    return new Response('GEMINI_API_KEY is not configured', { status: 500 });
  }

  const url = new URL(req.url);
  const personality = url.searchParams.get('personality') || 'balanced';
  
  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  const systemPrompt = `${personalityPrompts[personality] || personalityPrompts.balanced}

You are having a real-time voice conversation. Keep responses conversational, natural, and concise (1-3 sentences unless more detail is needed).

You can help with:
- Task management (creating, updating, completing tasks)
- Calendar scheduling (creating events, checking availability)
- General questions and brainstorming
- Productivity advice`;

  // Connect to Gemini Live API
  const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
  
  let geminiSocket: WebSocket | null = null;
  let isSetupComplete = false;

  clientSocket.onopen = () => {
    console.log('Client connected, connecting to Gemini...');
    
    geminiSocket = new WebSocket(geminiWsUrl);

    geminiSocket.onopen = () => {
      console.log('Connected to Gemini Live API');
      
      // Send setup message
      const setupMessage = {
        setup: {
          model: "models/gemini-2.0-flash-live-001",
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Puck"
                }
              }
            }
          },
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          }
        }
      };
      
      geminiSocket!.send(JSON.stringify(setupMessage));
      console.log('Sent setup message to Gemini');
    };

    geminiSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received from Gemini:', JSON.stringify(data).substring(0, 200));
        
        if (data.setupComplete) {
          isSetupComplete = true;
          clientSocket.send(JSON.stringify({ type: 'setup_complete' }));
          console.log('Gemini setup complete');
          return;
        }

        // Forward audio and text responses to client
        if (data.serverContent) {
          const content = data.serverContent;
          
          if (content.modelTurn?.parts) {
            for (const part of content.modelTurn.parts) {
              if (part.inlineData?.data) {
                // Audio data
                clientSocket.send(JSON.stringify({
                  type: 'audio',
                  data: part.inlineData.data,
                  mimeType: part.inlineData.mimeType
                }));
              }
              if (part.text) {
                // Text response
                clientSocket.send(JSON.stringify({
                  type: 'text',
                  text: part.text
                }));
              }
            }
          }
          
          if (content.turnComplete) {
            clientSocket.send(JSON.stringify({ type: 'turn_complete' }));
          }
        }
      } catch (e) {
        console.error('Error processing Gemini message:', e);
      }
    };

    geminiSocket.onerror = (error) => {
      console.error('Gemini WebSocket error:', error);
      clientSocket.send(JSON.stringify({ type: 'error', message: 'Gemini connection error' }));
    };

    geminiSocket.onclose = (event) => {
      console.log('Gemini WebSocket closed:', event.code, event.reason);
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: 'disconnected' }));
      }
    };
  };

  clientSocket.onmessage = (event) => {
    if (!geminiSocket || geminiSocket.readyState !== WebSocket.OPEN) {
      console.log('Gemini socket not ready, buffering message');
      return;
    }

    try {
      const message = JSON.parse(event.data);
      console.log('Received from client:', message.type);

      if (message.type === 'audio') {
        // Send audio to Gemini
        const realtimeInput = {
          realtimeInput: {
            mediaChunks: [{
              mimeType: "audio/pcm;rate=16000",
              data: message.data
            }]
          }
        };
        geminiSocket.send(JSON.stringify(realtimeInput));
      } else if (message.type === 'text') {
        // Send text to Gemini
        const clientContent = {
          clientContent: {
            turns: [{
              role: "user",
              parts: [{ text: message.text }]
            }],
            turnComplete: true
          }
        };
        geminiSocket.send(JSON.stringify(clientContent));
      }
    } catch (e) {
      console.error('Error processing client message:', e);
    }
  };

  clientSocket.onclose = () => {
    console.log('Client disconnected');
    if (geminiSocket && geminiSocket.readyState === WebSocket.OPEN) {
      geminiSocket.close();
    }
  };

  clientSocket.onerror = (error) => {
    console.error('Client WebSocket error:', error);
  };

  return response;
}
