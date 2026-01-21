import { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

type NativeUser = { email?: string; name?: string; imageUrl?: string; idToken?: string; accessToken?: string } | null;
type Ctx = { user: NativeUser; setUser: (u: NativeUser) => void; status: "authenticated" | "unauthenticated"; loginWithGoogle: () => Promise<void>; logout: () => Promise<void> };

const NativeAuthContext = createContext<Ctx>({ user: null, setUser: () => {}, status: "unauthenticated", loginWithGoogle: async () => {}, logout: async () => {} });

export function NativeAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<NativeUser>(null);
  const status: "authenticated" | "unauthenticated" = user ? "authenticated" : "unauthenticated";
  useEffect(() => {
    try {
      const idToken = typeof window !== "undefined" ? localStorage.getItem("calentrip:idToken") : null;
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("calentrip:accessToken") : null;
      const name = typeof window !== "undefined" ? localStorage.getItem("calentrip:user:name") : null;
      const email = typeof window !== "undefined" ? localStorage.getItem("calentrip:user:email") : null;
      const imageUrl = typeof window !== "undefined" ? localStorage.getItem("calentrip:user:imageUrl") : null;
      if (idToken || accessToken || name || email) setUser({ idToken: idToken || undefined, accessToken: accessToken || undefined, name: name || undefined, email: email || undefined, imageUrl: imageUrl || undefined });
    } catch {}
  }, []);
  async function loginWithGoogle() {
    if (!Capacitor.isNativePlatform()) return;
    const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
    type GoogleAuthPlugin = {
      initialize: (opts?: { scopes?: string[]; serverClientId?: string; clientId?: string }) => Promise<void>;
      signIn: () => Promise<GoogleAuthSignInResult>;
      signOut: () => Promise<void>;
    };
    const api = GoogleAuth as unknown as GoogleAuthPlugin;
    await api.initialize({ scopes: ["openid", "profile", "email"], serverClientId: "301052542782-d5qvmq3f1476ljo3aiu60cgl4il2dgmb.apps.googleusercontent.com" });
    type GoogleAuthSignInResult = { email?: string; name?: string; imageUrl?: string; idToken?: string; accessToken?: string; authentication?: { idToken?: string; accessToken?: string } };
    try { localStorage.setItem("calentrip:targetRoute", "/subscription/checkout/"); } catch {}
    const res: GoogleAuthSignInResult = await api.signIn();
    const auth = res.authentication || {};
    const idToken = res.idToken || auth.idToken;
    const accessToken = res.accessToken || auth.accessToken;
    const u: NativeUser = { email: res.email, name: res.name, imageUrl: res.imageUrl, idToken, accessToken };
    setUser(u);
    try {
      localStorage.setItem("calentrip:idToken", idToken || "");
      localStorage.setItem("calentrip:accessToken", accessToken || "");
      localStorage.setItem("calentrip:user:name", u?.name || "");
      localStorage.setItem("calentrip:user:email", u?.email || "");
      localStorage.setItem("calentrip:user:imageUrl", u?.imageUrl || "");
    } catch {}
    try {
      const route = localStorage.getItem("calentrip:targetRoute") || "/subscription/checkout/";
      localStorage.removeItem("calentrip:targetRoute");
      window.location.href = route;
    } catch {}
  }
  async function logout() {
    try {
      if (Capacitor.isNativePlatform()) {
        const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
        type GoogleAuthPlugin = { initialize: (opts?: { scopes?: string[]; serverClientId?: string; clientId?: string }) => Promise<void>; signOut: () => Promise<void> };
        const api = GoogleAuth as unknown as GoogleAuthPlugin;
        try { await api.initialize({ scopes: ["openid", "profile", "email"], serverClientId: "301052542782-d5qvmq3f1476ljo3aiu60cgl4il2dgmb.apps.googleusercontent.com" }); } catch {}
        const hasToken = typeof window !== "undefined" && (!!localStorage.getItem("calentrip:idToken") || !!localStorage.getItem("calentrip:accessToken"));
        if (hasToken) { await api.signOut().catch(() => {}); }
      }
    } catch { console.warn("SignOut ignorado para evitar crash"); }
    setUser(null);
    try {
      localStorage.removeItem("calentrip:idToken");
      localStorage.removeItem("calentrip:accessToken");
      localStorage.removeItem("calentrip:user:name");
      localStorage.removeItem("calentrip:user:email");
      localStorage.removeItem("calentrip:user:imageUrl");
    } catch {}
  }
  return <NativeAuthContext.Provider value={{ user, setUser, status, loginWithGoogle, logout }}>{children}</NativeAuthContext.Provider>;
}

export function useNativeAuth() {
  return useContext(NativeAuthContext);
}
