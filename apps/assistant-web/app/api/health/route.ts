import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "assistant-web",
    status: "ok"
  });
}
