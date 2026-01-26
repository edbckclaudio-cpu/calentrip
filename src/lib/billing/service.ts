import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { Purchases } from "@revenuecat/purchases-capacitor";

type ProductInfo = { found: boolean; title?: string; price?: string };
type LastError = { message?: string; code?: unknown; underlyingErrorMessage?: string } | null;

const RC_PREF_KEY = "calentrip:rc_api_key";
const RC_ACTIVE_KEY = "calentrip:rc_premium_active";
const RC_UNTIL_KEY = "calentrip:rc_premium_until";

class BillingService {
  private configured = false;
  private bootLogged = false;
  private lastError: LastError = null;

  private setLastError(e: unknown) {
    const err = e as { message?: string; code?: unknown; underlyingErrorMessage?: string };
    this.lastError = { message: err?.message, code: err?.code, underlyingErrorMessage: err?.underlyingErrorMessage };
  }

  private async resolveApiKey(): Promise<string> {
    const envKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY;
    if (envKey && envKey.trim() !== "") return envKey;
    try {
      const { value } = await Preferences.get({ key: RC_PREF_KEY });
      if (value) return value;
    } catch {}
    if (typeof window !== "undefined") {
      const lsKey = localStorage.getItem(RC_PREF_KEY);
      if (lsKey) return lsKey;
    }
    return "";
  }

  async init(appUserID?: string): Promise<boolean> {
    if (Capacitor.getPlatform() !== "android") return false;
    if (this.configured) return true;
    try {
      const key = await this.resolveApiKey();
      if (!key) {
        this.lastError = { message: "Missing RevenueCat API key" };
        return false;
      }
      try { await Preferences.set({ key: RC_PREF_KEY, value: key }); } catch {}
      if (typeof window !== "undefined") {
        try { localStorage.setItem(RC_PREF_KEY, key); } catch {}
      }
      try { await (Purchases as unknown as { setLogLevel: (o: { logLevel: "debug" | "info" | "warn" | "error" }) => Promise<void> }).setLogLevel({ logLevel: "debug" }); } catch {}
      let uid = appUserID;
      if (!uid && typeof window !== "undefined") {
        uid = localStorage.getItem("calentrip:user:email") || undefined;
      }
      await Purchases.configure({ apiKey: key, appUserID: uid });
      this.configured = true;
      if (!this.bootLogged) {
        this.bootLogged = true;
        try { console.log("DIAGN: Billing Sandbox Inicializado com Sucesso"); } catch {}
      }
      return true;
    } catch (e) {
      this.setLastError(e);
      return false;
    }
  }

  getDiagnostics(productId = (process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_subscription_01")) {
    return (async () => {
      const ok = await this.init();
      let products: Array<{ identifier?: string; title?: string; price?: string }> = [];
      try {
        const r = await (Purchases as unknown as { getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<{ identifier?: string; title?: string; price?: string }> }> }).getProducts({ productIdentifiers: [productId] });
        products = r?.products || [];
      } catch (e) {
        this.setLastError(e);
      }
      return { configured: ok, products, lastError: this.lastError };
    })();
  }

  getEnvStatus() {
    const envKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY || "";
    const productId = process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID;
    let lsKey: string | null = null;
    if (typeof window !== "undefined") {
      lsKey = localStorage.getItem(RC_PREF_KEY);
    }
    const key = envKey || lsKey || "";
    const source = envKey ? "env" : (lsKey ? "localStorage" : "none");
    const maskedKey = key ? `${key.slice(0, 8)}…${key.slice(-4)}` : "ausente";
    return { source, keyPresent: !!key, maskedKey, productId };
  }

  async setApiKey(k: string): Promise<boolean> {
    try {
      if (!k || k.trim() === "") return false;
      await Preferences.set({ key: RC_PREF_KEY, value: k.trim() });
      if (typeof window !== "undefined") {
        try { localStorage.setItem(RC_PREF_KEY, k.trim()); } catch {}
      }
      this.configured = false;
      return await this.init();
    } catch (e) {
      this.setLastError(e);
      return false;
    }
  }

  async isReady(): Promise<boolean> {
    if (Capacitor.getPlatform() !== "android") return false;
    const ok = await this.init();
    if (!ok) return false;
    try {
      const productId = process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_subscription_01";
      const res = await (Purchases as unknown as { getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<{ identifier?: string; title?: string; price?: string; priceString?: string }> }> }).getProducts({ productIdentifiers: [productId] });
      const p = (res?.products || [])[0];
      return !!p;
    } catch (e) {
      this.setLastError(e);
      return false;
    }
  }

  async getProductInfo(productId = "premium_subscription_01"): Promise<ProductInfo> {
    if (Capacitor.getPlatform() !== "android") return { found: false };
    const ok = await this.init();
    if (!ok) return { found: false };
    try {
      const res = await (Purchases as unknown as { getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<{ identifier?: string; title?: string; price?: string; priceString?: string }> }> }).getProducts({ productIdentifiers: [productId] });
      const p = (res?.products || [])[0];
      if (!p) return { found: false };
      return { found: true, title: p.title, price: p.price };
    } catch (e) {
      this.setLastError(e);
      return { found: false };
    }
  }

  async purchase(productId = "premium_subscription_01"): Promise<{ code: 0 | -1 | -2 }> {
    if (Capacitor.getPlatform() !== "android") return { code: -1 };
    const ok = await this.init();
    if (!ok) return { code: -1 };
    try {
      const res = await (Purchases as unknown as { getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<unknown> }> }).getProducts({ productIdentifiers: [productId] });
      const product = (res?.products || [])[0];
      if (!product) return { code: -2 };
      const pr = await (Purchases as unknown as { purchaseStoreProduct: (opts: { product: unknown }) => Promise<{ customerInfo?: unknown }> }).purchaseStoreProduct({ product });
      return pr?.customerInfo ? { code: 0 } : { code: -1 };
    } catch (e) {
      this.setLastError(e);
      return { code: -1 };
    }
  }

  async completePurchaseForTrip(tripId: string, userId?: string): Promise<{ ok: boolean; expiry?: number }> {
    const ready = await this.isReady();
    if (!ready) {
      if ((userId || "").toLowerCase().includes("demo")) {
        const expiry = Date.now() + 24 * 60 * 60 * 1000;
        return { ok: true, expiry };
      }
      return { ok: false };
    }
    const pid = process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_subscription_01";
    const info = await this.getProductInfo(pid);
    if (!info?.found) return { ok: false };
    const res = await this.purchase(pid);
    if (res.code !== 0) return { ok: false };
    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await this.refreshPremiumActive();
    return { ok: true, expiry };
  }

  async refreshPremiumActive(entitlementId?: string): Promise<boolean> {
    try {
      if (Capacitor.getPlatform() !== "android") return false;
      const ok = await this.init();
      if (!ok) return false;
      const info = await (Purchases as unknown as { getCustomerInfo: () => Promise<{ entitlements?: { all?: Record<string, { isActive?: boolean; expirationDate?: string | null }> } }> }).getCustomerInfo();
      const all = info?.entitlements?.all || {};
      let active = false;
      let until: string | null = null;
      if (entitlementId && all[entitlementId]?.isActive) {
        active = true;
        until = all[entitlementId]?.expirationDate || null;
      } else {
        for (const k of Object.keys(all)) {
          if (all[k]?.isActive) {
            active = true;
            until = all[k]?.expirationDate || null;
            break;
          }
        }
      }
      await Preferences.set({ key: RC_ACTIVE_KEY, value: active ? "1" : "0" });
      await Preferences.set({ key: RC_UNTIL_KEY, value: until || "" });
      if (typeof window !== "undefined") {
        try { localStorage.setItem(RC_ACTIVE_KEY, active ? "1" : "0"); } catch {}
        if (until) { try { localStorage.setItem(RC_UNTIL_KEY, until); } catch {} } else { try { localStorage.removeItem(RC_UNTIL_KEY); } catch {} }
      }
      return active;
    } catch (e) {
      this.setLastError(e);
      try { await Preferences.set({ key: RC_ACTIVE_KEY, value: "0" }); } catch {}
      if (typeof window !== "undefined") { try { localStorage.setItem(RC_ACTIVE_KEY, "0"); } catch {} }
      return false;
    }
  }

  async getCachedPremiumActive(): Promise<boolean> {
    try {
      const isAndroid = Capacitor.getPlatform() === "android";
      if (isAndroid) {
        const { value } = await Preferences.get({ key: RC_ACTIVE_KEY });
        if (value === "1") return true;
        if (typeof window !== "undefined") return localStorage.getItem(RC_ACTIVE_KEY) === "1";
        return false;
      }
      if (typeof window !== "undefined") return localStorage.getItem(RC_ACTIVE_KEY) === "1";
      return false;
    } catch {
      return false;
    }
  }
}

let singleton: BillingService | null = null;
export function getBillingService(): BillingService {
  if (!singleton) singleton = new BillingService();
  return singleton;
}
