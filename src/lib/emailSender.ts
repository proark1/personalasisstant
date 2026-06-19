/**
 * Reconstructs sender name and email from potentially corrupted database records.
 * The gmail-sync parser had a bug where from_name got only the first char
 * and from_email got the rest of the name + the actual email in angle brackets.
 */
export function reconstructSender(
  fromName: string | null,
  fromEmail: string,
): { name: string; email: string } {
  if (fromEmail.includes("<")) {
    const match = fromEmail.match(/^(.*?)\s*<([^>]+)>?$/);
    if (match) {
      const fullName = ((fromName || "") + match[1]).replace(/^"|"$/g, "").trim();
      return { name: fullName, email: match[2].toLowerCase().trim() };
    }
  }
  return {
    name: fromName || fromEmail.split("@")[0],
    email: fromEmail,
  };
}
