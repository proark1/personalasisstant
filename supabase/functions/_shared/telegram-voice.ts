// Shared helper: send Telegram messages, optionally as voice notes via Gemini TTS.
// Falls back to text if voice generation fails or message is too long.
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const DEFAULT_REPLY_VOICE_CHARS = 600; // ~30s at normal speed
const DEFAULT_BRIEFING_VOICE_CHARS = 3000; // ~2 minutes at normal speed

export interface SendOpts {
  chatId: number;
  text: string;
  preferVoice?: boolean;
  telegramKey: string;
  // IANA-like tag from profiles.locale ("en-US", "de", "fr-FR"…). Used
  // to pick a Gemini TTS voice that suits the language. Null/undefined
  // falls back to the default voice.
  locale?: string | null;
}

export interface SendVoiceMessageOpts {
  chatId: number;
  script: string;
  fallbackText: string;
  telegramKey: string;
  locale?: string | null;
  caption?: string;
  maxChars?: number;
  /**
   * When true, send fallbackText if voice cannot be delivered. Keep this false
   * when the caller will send the text companion itself to avoid duplicates.
   */
  sendFallbackText?: boolean;
}

export interface SendVoiceMessageResult {
  ok: boolean;
  sent: 'voice' | 'text' | 'skipped';
  reason?: string;
}

// Best-effort locale → Gemini TTS voice mapping. Gemini's prebuilt voices
// can speak any input language, but each one has a tonal "accent" that
// fits some better than others. The defaults below reflect that —
// callers that pass null/unknown locales get Kore (warm, neutral).
function pickVoiceForLocale(locale?: string | null): string {
  if (!locale) return 'Kore';
  const lang = locale.toLowerCase().split(/[-_]/)[0];
  switch (lang) {
    case 'de':  return 'Puck';        // brighter, fits German
    case 'fr':  return 'Aoede';       // softer, French-friendly
    case 'es':  return 'Achird';      // warm Spanish lean
    case 'it':  return 'Charon';      // expressive Italian lean
    case 'pt':  return 'Algenib';     // Portuguese
    case 'nl':  return 'Iapetus';     // Dutch
    case 'pl':  return 'Schedar';     // Polish
    case 'ru':  return 'Fenrir';      // Russian
    case 'ar':  return 'Sadachbia';   // Arabic
    case 'ja':  return 'Despina';     // Japanese — lighter
    case 'ko':  return 'Laomedeia';   // Korean
    case 'zh':  return 'Pulcherrima'; // Mandarin
    case 'tr':  return 'Vindemiatrix';// Turkish
    case 'en':
    default:    return 'Kore';
  }
}

async function sendText(chatId: number, text: string, telegramKey: string) {
  await fetch(`https://api.telegram.org/bot${telegramKey}/sendMessage`, {
    method: 'POST',
    headers: {
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

async function generateVoiceWav(text: string, voiceName = 'Kore'): Promise<Uint8Array | null> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
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
              voiceConfig: { prebuiltVoiceConfig: { voiceName } },
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
  telegramKey: string,
): Promise<boolean> {
  try {
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    // Cast to BlobPart — Deno's Uint8Array typing (ArrayBufferLike) is not
    // directly assignable to lib.dom's BlobPart (ArrayBuffer-only) but works at runtime.
    fd.append('voice', new Blob([audio as unknown as BlobPart], { type: 'audio/wav' }), 'reply.wav');
    if (caption) fd.append('caption', caption.slice(0, 1000));
    const r = await fetch(`https://api.telegram.org/bot${telegramKey}/sendVoice`, {
      method: 'POST',
      headers: {
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

export function defaultBriefingVoiceLimit(): number {
  return DEFAULT_BRIEFING_VOICE_CHARS;
}

/**
 * Send a Telegram voice note for any chat (private or group). Callers can opt
 * out of fallback text when they always send a separate text companion.
 */
export async function sendVoiceMessage(opts: SendVoiceMessageOpts): Promise<SendVoiceMessageResult> {
  const {
    chatId,
    fallbackText,
    telegramKey,
    locale,
    caption = '',
    maxChars = DEFAULT_REPLY_VOICE_CHARS,
    sendFallbackText = true,
  } = opts;
  const cleanForVoice = stripHtml(opts.script);

  async function fallback(reason: string): Promise<SendVoiceMessageResult> {
    if (sendFallbackText) {
      await sendText(chatId, fallbackText, telegramKey);
      return { ok: true, sent: 'text', reason };
    }
    return { ok: false, sent: 'skipped', reason };
  }

  if (!cleanForVoice) return fallback('empty_script');
  if (cleanForVoice.length > maxChars) return fallback('script_too_long');

  const audio = await generateVoiceWav(cleanForVoice, pickVoiceForLocale(locale));
  if (audio && audio.length > 0) {
    const ok = await sendVoiceNote(chatId, audio, caption || fallbackText, telegramKey);
    if (ok) return { ok: true, sent: 'voice' };
  }
  return fallback('voice_generation_or_send_failed');
}

/**
 * Send a Telegram message. If preferVoice is true and the text is short enough,
 * send as a voice note (with original text as caption). Otherwise send as text.
 */
export async function sendDoriReply(opts: SendOpts): Promise<void> {
  const { chatId, text, preferVoice, telegramKey, locale } = opts;

  if (preferVoice) {
    const res = await sendVoiceMessage({
      chatId,
      script: text,
      fallbackText: text,
      telegramKey,
      locale,
      maxChars: DEFAULT_REPLY_VOICE_CHARS,
      sendFallbackText: true,
    });
    if (res.ok) return;
  }
  await sendText(chatId, text, telegramKey);
}

// Base64 helper (kept here so callers don't need to import separately).
export { base64Encode };
