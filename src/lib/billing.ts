import { Capacitor, registerPlugin } from "@capacitor/core";

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
