import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null) as { idToken?: string } | null;
    const idToken = body?.idToken || "";
    if (typeof idToken !== "string" || idToken.length < 10) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

