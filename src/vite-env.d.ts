/// <reference types="vite/client" />

// Lib.dom + @types/node already provide NodeJS.Timeout; we previously
// shimmed it as an empty interface for browser-only builds. Keep the
// type alias to satisfy older callers without flagging the empty-iface
// rule.
declare namespace NodeJS {
  type Timeout = ReturnType<typeof setTimeout>;
}
