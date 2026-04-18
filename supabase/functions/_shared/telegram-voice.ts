// Shared helper: send Telegram messages, optionally as voice notes via Gemini TTS.
// Falls back to text if voice generation fails or message is too long.
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const MAX_VOICE_CHARS = 600; // ~30s at normal speed

export interface SendOpts {
  chatId: number;
  text: string;
  preferVoice?: boolean;
  lovableKey: string;
  telegramKey: string;
}

async function sendText(chatId: number, text: string, lovableKey: string, telegramKey: string) {
  await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'X-Connection-Api-Key': telegramKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), parse_mode: 'HTML' }),
  });
}

// Strip HTML for cleaner TTS narration.
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

// Build a minimal WAV header for raw PCM (Gemini returns 24kHz, 16-bit, mono PCM).
function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  new Uint8Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

async function generateVoiceWav(text: string): Promise<Uint8Array | null> {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return null;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
          },
        }),
      },
    );
    if (!r.ok) {
      console.error('Gemini TTS failed', r.status, await r.text());
      return null;
    }
    const data = await r.json();
    const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) {
      console.error('Gemini TTS: no audio data in response');
      return null;
    }
    // Decode base64 PCM → wrap in WAV container so Telegram accepts it.
    const bin = atob(b64);
    const pcm = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);
    return pcmToWav(pcm, 24000);
  } catch (e) {
    console.error('TTS error', e);
    return null;
  }
}

async function sendVoiceNote(
  chatId: number,
  audio: Uint8Array,
  caption: string,
  lovableKey: string,
  telegramKey: string,
): Promise<boolean> {
  try {
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    fd.append('voice', new Blob([audio], { type: 'audio/wav' }), 'reply.wav');
    if (caption) fd.append('caption', caption.slice(0, 1000));
    const r = await fetch(`${GATEWAY_URL}/sendVoice`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': telegramKey,
      },
      body: fd,
    });
    if (!r.ok) {
      console.error('sendVoice failed', r.status, await r.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('sendVoice error', e);
    return false;
  }
}

/**
 * Send a Telegram message. If preferVoice is true and the text is short enough,
 * send as a voice note (with original text as caption). Otherwise send as text.
 */
export async function sendDoriReply(opts: SendOpts): Promise<void> {
  const { chatId, text, preferVoice, lovableKey, telegramKey } = opts;
  const cleanForVoice = stripHtml(text);

  if (preferVoice && cleanForVoice.length > 0 && cleanForVoice.length <= MAX_VOICE_CHARS) {
    const audio = await generateVoiceWav(cleanForVoice);
    if (audio && audio.length > 0) {
      const ok = await sendVoiceNote(chatId, audio, text, lovableKey, telegramKey);
      if (ok) return;
    }
    // fall through to text on any failure
  }
  await sendText(chatId, text, lovableKey, telegramKey);
}

// Base64 helper (kept here so callers don't need to import separately).
export { base64Encode };
