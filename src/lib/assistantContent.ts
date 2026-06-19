// Strip the `<tool>…</…>` envelope tags the streaming assistant emits
// around side-effect instructions so only natural-language prose is
// rendered to the user.
//
// The pairs below intentionally use mismatched open/close tags
// (`<tool>…</task>` etc.) — that matches what the server actually
// streams. Changing the pattern requires coordinating with the
// `chat` edge function.
const TOOL_BLOCK_PATTERNS: RegExp[] = [
  /<tool>[\s\S]*?<\/task>/g,
  /<tool>[\s\S]*?<\/event>/g,
  /<tool>[\s\S]*?<\/note>/g,
  /<tool>[\s\S]*?<\/contact>/g,
  /<tool>[\s\S]*?<\/contract>/g,
  /<tool>[\s\S]*?<\/project>/g,
  /<tool>[\s\S]*?<\/habit>/g,
  /<tool>[\s\S]*?<\/email>/g,
  /<tool>[\s\S]*?<\/item>/g,
  /<tool>get_summary<\/tool>\s*<type>\w+<\/type>/g,
  /<tool>set_reminder<\/tool>\s*<reminder>\{[\s\S]*?\}<\/reminder>/g,
];

export function cleanAssistantContent(raw: string): string {
  let out = raw;
  for (const pattern of TOOL_BLOCK_PATTERNS) {
    out = out.replace(pattern, "");
  }
  return out.trim();
}
