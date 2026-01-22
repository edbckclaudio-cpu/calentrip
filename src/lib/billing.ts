import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";
import { setGlobalPremium } from "./premium";

type ProductInfo = { title?: string; price?: string };
let configured = false;
let lastError: { message?: string; code?: unknown; underlyingErrorMessage?: string } | null = null;
function setLastError(e: unknown) {
  const err = e as { message?: string; code?: unknown; underlyingErrorMessage?: string };
  lastError = { message: err?.message, code: err?.code, underlyingErrorMessage: err?.underlyingErrorMessage };
}

async function ensureConfigured(appUserID?: string) {
  if (Capacitor.getPlatform() !== "android") return false;
  const apiKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY || "";
  let key = apiKey;
  try {
    if (!key && typeof window !== "undefined") {
      const k = localStorage.getItem("calentrip:rc_api_key");
      if (k) key = k;
    }
  } catch {}
  if (!key) { try { console.error("RevenueCat API key ausente"); } catch {} return false; }
  if (configured) return true;
  try {
    try { await (Purchases as unknown as { setLogLevel: (opts: { logLevel: "debug" | "info" | "warn" | "error" }) => Promise<void> }).setLogLevel({ logLevel: "debug" }); } catch {}
    let uid = appUserID;
    try {
      if (!uid && typeof window !== "undefined") {
        const email = localStorage.getItem("calentrip:user:email");
        uid = email || undefined;
      }
    } catch {}
    await Purchases.configure({ apiKey: key, appUserID: uid });
    configured = true;
    return true;
  } catch (e) {
    try { console.error("Purchases.configure error", e); } catch {}
    setLastError(e);
    return false;
  }
}

export async function isBillingReady() {
  if (Capacitor.getPlatform() !== "android") return false;
  const ok = await ensureConfigured();
  if (!ok) return false;
  try {
    const productId = process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_subscription_01";
    const res = await (Purchases as unknown as { getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<ProductInfo> }> }).getProducts({ productIdentifiers: [productId] });
    const p = (res?.products || [])[0];
    return !!p;
  } catch (e) {
    try { console.error("Purchases.getProducts error", e); } catch {}
    setLastError(e);
    return false;
  }
}

export async function ensureProduct(productId = "premium_subscription_01") {
  if (Capacitor.getPlatform() !== "android") return null;
  const ok = await ensureConfigured();
  if (!ok) return null;
  try {
    const res = await (Purchases as unknown as { getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<ProductInfo> }> }).getProducts({ productIdentifiers: [productId] });
    const p = (res?.products || [])[0];
    if (!p) return null;
    return { found: true, title: p.title, price: p.price } as { found: boolean; title?: string; price?: string };
  } catch (e) {
    try { console.error("Purchases.getProducts error", e); } catch {}
    setLastError(e);
    return null;
  }
}

export async function purchaseTripPremium(productId = "premium_subscription_01") {
  if (Capacitor.getPlatform() !== "android") return { code: -1 };
  const ok = await ensureConfigured();
  if (!ok) return { code: -1 };
  try {
    const res = await (Purchases as unknown as {
      getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<unknown> }>;
      purchaseStoreProduct: (opts: { product: unknown }) => Promise<{ customerInfo?: unknown }>;
    }).getProducts({ productIdentifiers: [productId] });
    const product = (res?.products || [])[0];
    if (!product) return { code: -2 };
    const pr = await (Purchases as unknown as {
      purchaseStoreProduct: (opts: { product: unknown }) => Promise<{ customerInfo?: unknown }>;
    }).purchaseStoreProduct({ product });
    return pr?.customerInfo ? { code: 0 } : { code: -1 };
  } catch (e) {
    try { console.error("Purchases.purchaseStoreProduct error", e); } catch {}
    setLastError(e);
    return { code: -1 };
  }
}

export async function completePurchaseForTrip(tripId: string, userId?: string) {
  const productId = process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_subscription_01";
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
  try {
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const store = await fetch("/api/entitlements/store", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: "global", userId, expiresAt: expiry, orderId: null, source: "revenuecat" }) });
    const stJs = await store.json();
    if (!stJs?.ok) return { ok: false, error: "store" } as const;
    setGlobalPremium(expiry);
    return { ok: true } as const;
  } catch {
    return { ok: false, error: "network" } as const;
  }
}

export async function getBillingDiagnostics(productId = (process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_subscription_01")) {
  const cfg = configured;
  const ok = await ensureConfigured();
  let products: Array<{ identifier?: string; price?: string; title?: string }> = [];
  try {
    const r = await (Purchases as unknown as { getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<{ identifier?: string; price?: string; title?: string }> }> }).getProducts({ productIdentifiers: [productId] });
    products = r?.products || [];
  } catch (e) {
    setLastError(e);
  }
  return { configured: cfg || ok, products, lastError };
}

export function getBillingEnvStatus() {
  const envKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY || "";
  const productId = process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || undefined;
  let lsKey: string | undefined;
  try {
    if (typeof window !== "undefined") {
      lsKey = localStorage.getItem("calentrip:rc_api_key") || undefined;
    }
  } catch {}
  const source = envKey ? "env" : (lsKey ? "localStorage" : "none");
  const key = envKey || lsKey || "";
  const maskedKey = key ? `${key.slice(0, 6)}…${key.slice(-4)}` : undefined;
  return { source, keyPresent: !!key, maskedKey, productId };
}
