// Shared helper: send Telegram messages, optionally as voice notes via ElevenLabs TTS.
// Falls back to text if voice generation fails or message is too long.
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
const ELEVENLABS_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL'; // Sarah — warm female voice
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

async function generateVoiceMp3(text: string): Promise<Uint8Array | null> {
  const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!apiKey) return null;
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        }),
      },
    );
    if (!r.ok) {
      console.error('ElevenLabs TTS failed', r.status, await r.text());
      return null;
    }
    return new Uint8Array(await r.arrayBuffer());
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
    fd.append('voice', new Blob([audio], { type: 'audio/mpeg' }), 'reply.mp3');
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
    const audio = await generateVoiceMp3(cleanForVoice);
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
