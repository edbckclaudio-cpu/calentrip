import { Capacitor, registerPlugin } from "@capacitor/core";
import { setGlobalPremium } from "./premium";

type Result = { ready?: boolean; found?: boolean; title?: string; price?: string; code?: number };
type BillingPlugin = {
  isReady(): Promise<Result>;
  queryProduct(args: { productId: string }): Promise<Result>;
  purchaseTripPremium(args: { productId: string }): Promise<Result>;
  getLastToken(): Promise<{ token?: string | null }>;
  addListener(event: "purchase", cb: (data: { token?: string | null }) => void): { remove: () => void };
};

const Billing = registerPlugin<BillingPlugin>("Billing");

export async function isBillingReady() {
  if (Capacitor.getPlatform() !== "android") return false;
  try { const r = await Billing.isReady(); return !!r?.ready; } catch { return false; }
}

export async function ensureProduct(productId = "trip_premium") {
  if (Capacitor.getPlatform() !== "android") return null;
  try { const r = await Billing.queryProduct({ productId }); return r?.found ? r : null; } catch { return null; }
}

export async function purchaseTripPremium(productId = "trip_premium") {
  if (Capacitor.getPlatform() !== "android") return { code: -1 };
  try { const r = await Billing.purchaseTripPremium({ productId }); return r; } catch { return { code: -1 }; }
}

export async function awaitPurchaseToken(timeoutMs = 15000): Promise<string | null> {
  if (Capacitor.getPlatform() !== "android") return null;
  return await new Promise<string | null>(async (resolve) => {
    let done = false;
    Billing.addListener("purchase", (data) => { if (done) return; done = true; resolve(data?.token || null); });
    try {
      const r = await Billing.getLastToken();
      if (!done && r?.token) { done = true; resolve(r.token); return; }
    } catch {}
    setTimeout(() => { if (!done) resolve(null); }, timeoutMs);
  });
}

export async function completePurchaseForTrip(tripId: string, userId?: string) {
  const productId = process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "trip_premium";
  const ready = await isBillingReady();
  if (!ready) {
    const isDemo = (userId || "").toLowerCase().includes("demo");
    if (isDemo) {
      const expiry = Date.now() + 24 * 60 * 60 * 1000;
      setGlobalPremium(expiry);
      return { ok: true } as const;
    }
    return { ok: false, error: "billing" } as const;
  }
  const product = await ensureProduct(productId);
  if (!product) return { ok: false, error: "product" } as const;
  const res = await purchaseTripPremium(productId);
  if (typeof res?.code === "number" && res.code !== 0) return { ok: false, error: "purchase" } as const;
  const token = await awaitPurchaseToken();
  if (!token) return { ok: false, error: "token" } as const;
  const verifyBody = { tripId, userId, purchaseToken: token, productId };
  try {
    const v = await fetch("/api/entitlements/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(verifyBody) });
    const js = await v.json();
    if (!js?.ok) return { ok: false, error: "verify" } as const;
    const ack = await fetch("/api/entitlements/ack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseToken: token, productId }) });
    const ackJs = await ack.json();
    if (!ackJs?.ok) return { ok: false, error: "ack" } as const;
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const store = await fetch("/api/entitlements/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: "global", userId, expiresAt: expiry, orderId: js?.orderId || null, source: "google_play" }) });
    const stJs = await store.json();
    if (!stJs?.ok) return { ok: false, error: "store" } as const;
    setGlobalPremium(expiry);
    return { ok: true } as const;
  } catch {
    return { ok: false, error: "network" } as const;
  }
}
