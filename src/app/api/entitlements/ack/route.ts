export const dynamic = "force-dynamic";

async function getAccessToken(): Promise<string | null> {
  try {
    const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || "";
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const cfg = JSON.parse(json);
    const { JWT } = await import("google-auth-library");
    const client = new JWT({ email: cfg.client_email, key: cfg.private_key, scopes: ["https://www.googleapis.com/auth/androidpublisher"] });
    const token = await client.getAccessToken();
    return token as string;
  } catch { return null; }
}

export async function POST(req: Request) {
  try {
    type AckBody = { purchaseToken?: string; productId?: string };
    const raw = await req.json().catch(() => null);
    const body: AckBody | null = raw && typeof raw === "object" ? (raw as AckBody) : null;
    const token = body?.purchaseToken;
    const productId = body?.productId;
    const pkg = process.env.GOOGLE_PLAY_PACKAGE || "digital.calentrip.android";
    const expectedProduct = process.env.GOOGLE_PLAY_PRODUCT_ID || "premium_subscription_01";
    if (!token || !productId) return new Response(JSON.stringify({ ok: false, error: "missing" }), { status: 400, headers: { "Content-Type": "application/json" } });
    if (productId !== expectedProduct) return new Response(JSON.stringify({ ok: false, error: "product" }), { status: 400, headers: { "Content-Type": "application/json" } });

    const access = await getAccessToken();
    if (!access) return new Response(JSON.stringify({ ok: false, error: "auth" }), { status: 500, headers: { "Content-Type": "application/json" } });
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`;
    const resp = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" }, body: JSON.stringify({ developerPayload: "calentrip" }) });
    const ok = resp.ok;
    return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 400, headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
