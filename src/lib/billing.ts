import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";
import { setGlobalPremium } from "./premium";
import { Preferences } from "@capacitor/preferences";

type ProductInfo = { title?: string; price?: string };
const RC_PREF_KEY = "calentrip:rc_api_key";

try { console.log("PLATFORM:", Capacitor.getPlatform()); } catch { }

let configured = false;
let lastError: { message?: string; code?: unknown; underlyingErrorMessage?: string } | null = null;

function setLastError(e: unknown) {
    const err = e as { message?: string; code?: unknown; underlyingErrorMessage?: string };
    lastError = { message: err?.message, code: err?.code, underlyingErrorMessage: err?.underlyingErrorMessage };
}

/**
 * Resolve a chave API com hierarquia: 
 * 1. Env (Build) -> 2. Preferences (Nativo/Persistente) -> 3. LocalStorage (Legacy)
 */
async function resolveApiKey(): Promise<string> {
    // 1. Variável de Build
    const envKey = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY;
    if (envKey && envKey.trim() !== "") return envKey;

    // 2. Preferences do Capacitor (Mais estável no Android)
    try {
        const { value } = await Preferences.get({ key: RC_PREF_KEY });
        if (value) return value;
    } catch { }

    // 3. LocalStorage (Fallback)
    if (typeof window !== "undefined") {
        const lsKey = localStorage.getItem(RC_PREF_KEY);
        if (lsKey) return lsKey;
    }

    return "";
}

async function ensureConfigured(appUserID?: string) {
    if (Capacitor.getPlatform() !== "android") return false;
    if (configured) return true;

    const key = await resolveApiKey();

    if (!key) {
        try { console.error("DIAGNÓSTICO: RevenueCat API key ausente"); } catch { }
        return false;
    }

    try {
        // Ativa logs de debug para facilitar rastreio no Logcat/Trae
        try {
            await (Purchases as unknown as { setLogLevel: (opts: { logLevel: "debug" | "info" | "warn" | "error" }) => Promise<void> }).setLogLevel({ logLevel: "debug" });
        } catch { }

        let uid = appUserID;
        if (!uid && typeof window !== "undefined") {
            uid = localStorage.getItem("calentrip:user:email") || undefined;
        }

        await Purchases.configure({ apiKey: key, appUserID: uid });
        
        // Sincroniza o localstorage se a chave veio do Preferences ou Env
        if (typeof window !== "undefined") {
            localStorage.setItem(RC_PREF_KEY, key);
        }

        configured = true;
        console.log("DIAGNÓSTICO: RevenueCat configurado com sucesso.");
        return true;
    } catch (e) {
        try { console.error("Purchases.configure error", e); } catch { }
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
        const res = await (Purchases as unknown as { getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<{ identifier?: string; title?: string; price?: string; priceString?: string }> }> }).getProducts({ productIdentifiers: [productId] });
        const p = (res?.products || [])[0];
        return !!p;
    } catch (e) {
        setLastError(e);
        return false;
    }
}

export async function ensureProduct(productId = "premium_subscription_01") {
    if (Capacitor.getPlatform() !== "android") return null;
    const ok = await ensureConfigured();
    if (!ok) return null;
    try {
        const res = await (Purchases as unknown as { getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<{ identifier?: string; title?: string; price?: string; priceString?: string }> }> }).getProducts({ productIdentifiers: [productId] });
        const p = (res?.products || [])[0];
        if (!p) return null;
        return { found: true, title: p.title, price: p.price };
    } catch (e) {
        setLastError(e);
        return null;
    }
}

export async function purchaseTripPremium(productId = "premium_subscription_01") {
    if (Capacitor.getPlatform() !== "android") return { code: -1 };
    const ok = await ensureConfigured();
    if (!ok) return { code: -1 };
    try {
        const res = await (Purchases as unknown as { getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<unknown> }> }).getProducts({ productIdentifiers: [productId] });
        const product = (res?.products || [])[0];
        if (!product) return { code: -2 };
        const pr = await (Purchases as unknown as { purchaseStoreProduct: (opts: { product: unknown }) => Promise<{ customerInfo?: unknown }> }).purchaseStoreProduct({ product });
        return pr?.customerInfo ? { code: 0 } : { code: -1 };
    } catch (e) {
        setLastError(e);
        return { code: -1 };
    }
}

export async function completePurchaseForTrip(tripId: string, userId?: string) {
    const productId = process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_subscription_01";
    const ready = await isBillingReady();

    if (!ready) {
        if ((userId || "").toLowerCase().includes("demo")) {
            const expiry = Date.now() + 24 * 60 * 60 * 1000;
            setGlobalPremium(expiry);
            return { ok: true } as const;
        }
        return { ok: false, error: "billing" } as const;
    }

    const product = await ensureProduct(productId);
    if (!product) return { ok: false, error: "product" } as const;

    const res = await purchaseTripPremium(productId);
    if (res?.code !== 0) return { ok: false, error: "purchase" } as const;

    const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
    setGlobalPremium(expiry);

    return { ok: true } as const;
}

export async function getBillingDiagnostics(productId = (process.env.NEXT_PUBLIC_GOOGLE_PLAY_PRODUCT_ID || "premium_subscription_01")) {
    const ok = await ensureConfigured();
    let products: Array<{ identifier?: string; title?: string; price?: string }> = [];
    try {
        const r = await (Purchases as unknown as { getProducts: (opts: { productIdentifiers: string[] }) => Promise<{ products?: Array<{ identifier?: string; title?: string; price?: string }> }> }).getProducts({ productIdentifiers: [productId] });
        products = r?.products || [];
    } catch (e) {
        setLastError(e);
    }
    return { configured: ok, products, lastError };
}

export function getBillingEnvStatus() {
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

export async function setRevenueCatApiKey(k: string) {
    if (!k || k.trim() === "") return false;
    
    try {
        // Salva no Preferences (Nativo)
        await Preferences.set({ key: RC_PREF_KEY, value: k.trim() });
        
        // Salva no LocalStorage (Web View)
        if (typeof window !== "undefined") {
            localStorage.setItem(RC_PREF_KEY, k.trim());
        }

        // Força a reconfiguração na próxima chamada
        configured = false;
        console.log("DIAGNÓSTICO: Nova API Key salva. Reinicializando billing...");
        
        // Tenta inicializar imediatamente
        return await ensureConfigured();
    } catch (e) {
        console.error("Erro ao salvar API Key:", e);
        return false;
    }
}
