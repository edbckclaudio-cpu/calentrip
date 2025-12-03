import { auth } from "@/auth";

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

export async function POST() {
  try {
    const session = await auth();
    const userId = session?.user?.email || session?.user?.name || null;
    const projectId = process.env.FIRESTORE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
    if (!userId || !projectId) return new Response(JSON.stringify({ ok: false, error: "missing" }), { status: 400, headers: { "Content-Type": "application/json" } });

    const access = await getAccessToken();
    if (!access) return new Response(JSON.stringify({ ok: false, error: "auth" }), { status: 500, headers: { "Content-Type": "application/json" } });

    const queryUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery`;
    const queryPayload = {
      structuredQuery: {
        from: [{ collectionId: "entitlements" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "userId" },
            op: "EQUAL",
            value: { stringValue: userId },
          },
        },
      },
    };
    const resp = await fetch(queryUrl, { method: "POST", headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" }, body: JSON.stringify(queryPayload) });
    const rows = await resp.json().catch(() => []);
    const names: string[] = (rows || []).map((r: any) => r?.document?.name).filter(Boolean);
    for (const name of names) {
      try { await fetch(`https://firestore.googleapis.com/v1/${name}`, { method: "DELETE", headers: { Authorization: `Bearer ${access}` } }); } catch {}
    }
    return new Response(JSON.stringify({ ok: true, removed: names.length }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
}
