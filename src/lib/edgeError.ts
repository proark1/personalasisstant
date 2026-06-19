// Shared edge-function error helper.
//
// `supabase.functions.invoke()` wraps a non-2xx response as a FunctionsHttpError
// whose `.context` is the raw Response — so the thrown error's `.message` is the
// opaque "Edge Function returned a non-2xx status code". Our edge functions
// return a JSON `{ error }` body with the real reason; this pulls it out so the
// user (and we) see what actually went wrong instead of a generic failure.
//
// Use it in any `catch` around `supabase.functions.invoke(...)`:
//   toast.error(await describeEdgeError(err, 'Couldn’t do the thing'));

export async function describeEdgeError(err: unknown, fallback: string): Promise<string> {
  const ctx = (err as { context?: unknown } | null)?.context;
  if (ctx && typeof (ctx as Response).clone === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      if (body) {
        // Edge functions return { error: "..." }; tolerate nested
        // { error: { message } } and top-level { message } shapes too.
        if (typeof body.error === "string" && body.error) return body.error;
        if (
          body.error &&
          typeof body.error === "object" &&
          typeof body.error.message === "string" &&
          body.error.message
        ) {
          return body.error.message;
        }
        if (typeof body.message === "string" && body.message) return body.message;
      }
    } catch {
      /* response body wasn't JSON — fall through to the message/fallback */
    }
  }
  // Fall back to any message we can find — an Error instance OR a plain object
  // with a string `message` (e.g. a Supabase/PostgrestError, which is NOT an
  // Error instance) — but never the opaque "Edge Function returned a non-2xx
  // status code" message, for which the caller's fallback is more useful.
  let msg = "";
  if (err instanceof Error) {
    msg = err.message;
  } else if (typeof err === "string") {
    msg = err;
  } else if (
    err &&
    typeof err === "object" &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    msg = (err as { message: string }).message;
  }
  return msg && !/non-2xx status code/i.test(msg) ? msg : fallback;
}
