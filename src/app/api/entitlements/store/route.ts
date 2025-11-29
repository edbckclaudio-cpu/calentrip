export const dynamic = "force-dynamic";

async function getAccessToken(): Promise<string | null> {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || "";
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const cfg = JSON.parse(json);
    const { JWT } = await import("google-auth-library");
    const client = new JWT({ email: cfg.client_email, key: cfg.private_key, scopes: ["https://www.googleapis.com/auth/datastore"] });
    const token = await client.getAccessToken();
    return token as string;
  } catch { return null; }
}

export async function POST(req: Request) {
  try {
    type StoreBody = { tripId?: string; userId?: string; expiresAt?: number; orderId?: string | null; source?: string };
    const raw = await req.json().catch(() => null);
    const body: StoreBody | null = raw && typeof raw === "object" ? (raw as StoreBody) : null;
    const tripId = body?.tripId;
    const userId = body?.userId;
    const expiresAt = Number(body?.expiresAt ?? 0);
    const orderId = body?.orderId ?? null;
    const source = body?.source;
    const projectId = process.env.FIRESTORE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
    if (!tripId || !expiresAt || !projectId) return new Response(JSON.stringify({ ok: false, stored: false, error: "missing" }), { status: 400, headers: { "Content-Type": "application/json" } });

    const access = await getAccessToken();
    if (!access) return new Response(JSON.stringify({ ok: true, stored: false }), { status: 200, headers: { "Content-Type": "application/json" } });

    const docId = `${tripId}-${Math.floor(expiresAt)}`;
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/entitlements?documentId=${encodeURIComponent(docId)}`;
    const payload = {
      fields: {
        tripId: { stringValue: tripId },
        userId: userId ? { stringValue: userId } : { nullValue: null },
        expiresAt: { integerValue: String(Math.floor(expiresAt)) },
        orderId: orderId ? { stringValue: orderId } : { nullValue: null },
        source: { stringValue: source || "google_play" },
        createdAt: { timestampValue: new Date().toISOString() },
      },
    };
    const resp = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const ok = resp.ok;
    return new Response(JSON.stringify({ ok, stored: ok }), { status: ok ? 200 : 400, headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ ok: false, stored: false }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
