"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";

type NativeUser = { 
  email?: string; 
  name?: string; 
  imageUrl?: string; 
  idToken?: string; 
  accessToken?: string 
} | null;

type GoogleAuthPlugin = {
  initialize: (opts?: { scopes?: string[]; serverClientId?: string; clientId?: string }) => Promise<void>;
  signIn: () => Promise<{ email?: string; name?: string; imageUrl?: string; idToken?: string; accessToken?: string; authentication?: { idToken?: string; accessToken?: string } }>;
  signOut: () => Promise<void>;
};

type Ctx = { 
  user: NativeUser; 
  setUser: (u: NativeUser) => void; 
  status: "authenticated" | "unauthenticated"; 
  authenticating: boolean; 
  initialized: boolean; // Novo: Indica se já terminou de ler o localStorage
  loginWithGoogle: () => Promise<void>; 
  logout: () => Promise<void> 
};

const NativeAuthContext = createContext<Ctx>({ 
  user: null, 
  setUser: () => {}, 
  status: "unauthenticated", 
  authenticating: false, 
  initialized: false, 
  loginWithGoogle: async () => {}, 
  logout: async () => {} 
});

export function NativeAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<NativeUser>(null);
  const [authenticating, setAuthenticating] = useState(false);
  const [initialized, setInitialized] = useState(false); // Novo
  const router = useRouter();

  const status: "authenticated" | "unauthenticated" = user ? "authenticated" : "unauthenticated";

  // 1. Carregamento inicial do disco (Reidratação)
  useEffect(() => {
    const hydrate = async () => {
      try {
        if (typeof window === "undefined") return;

        const idToken = localStorage.getItem("calentrip:idToken");
        const accessToken = localStorage.getItem("calentrip:accessToken");
        const name = localStorage.getItem("calentrip:user:name");
        const email = localStorage.getItem("calentrip:user:email");
        const imageUrl = localStorage.getItem("calentrip:user:imageUrl");

        if (idToken || accessToken || name || email) {
          setUser({ 
            idToken: idToken || undefined, 
            accessToken: accessToken || undefined, 
            name: name || undefined, 
            email: email || undefined, 
            imageUrl: imageUrl || undefined 
          });
        }

        // Renova o grace period na montagem para evitar que o Checkout expulse o usuário
        localStorage.setItem("calentrip:auth_grace_until", String(Date.now() + 3000));
      } catch (e) {
        console.error("Erro na hidratação nativa:", e);
      } finally {
        setInitialized(true); // Agora o Checkout sabe que pode avaliar o usuário
      }
    };

    hydrate();
  }, []);

  async function loginWithGoogle() {
    if (!Capacitor.isNativePlatform()) return;

    setAuthenticating(true);
    
    try {
      // 2. Define um grace period maior durante o processo de login
      localStorage.setItem("calentrip:auth_grace_until", String(Date.now() + 8000));
      localStorage.setItem("calentrip:targetRoute", "/subscription/checkout/");
      localStorage.setItem("calentrip_backup_route", "/subscription/checkout/");

      const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
      const api = GoogleAuth as unknown as GoogleAuthPlugin;
      await api.initialize({ 
        scopes: ["openid", "profile", "email"], 
        serverClientId: "301052542782-d5qvmq3f1476ljo3aiu60cgl4il2dgmb.apps.googleusercontent.com" 
      });

      const res = await api.signIn();
      const auth = res.authentication || {};
      const idToken = res.idToken || auth.idToken;
      const accessToken = res.accessToken || auth.accessToken;

      const u: NativeUser = { 
        email: res.email, 
        name: res.name, 
        imageUrl: res.imageUrl, 
        idToken, 
        accessToken 
      };

      // 3. Salva os dados ANTES de atualizar o estado
      localStorage.setItem("calentrip:idToken", idToken || "");
      localStorage.setItem("calentrip:accessToken", accessToken || "");
      localStorage.setItem("calentrip:user:name", u?.name || "");
      localStorage.setItem("calentrip:user:email", u?.email || "");
      localStorage.setItem("calentrip:user:imageUrl", u?.imageUrl || "");

      setUser(u);
      setAuthenticating(false);

      // 4. NAVEGAÇÃO SPA: Substituído window.location.href por router.push
      // Isso evita que o BridgeActivity reinicie e o estado seja perdido.
      const route = localStorage.getItem("calentrip:targetRoute") || "/subscription/checkout/";
      localStorage.removeItem("calentrip:targetRoute");
      
      router.push(route);

    } catch (error) {
      console.error("Erro no login Google:", error);
      setAuthenticating(false);
    }
  }

  async function logout() {
    try {
      if (Capacitor.isNativePlatform()) {
        const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
        const api = GoogleAuth as unknown as GoogleAuthPlugin;
        
        try { 
          await api.initialize({ 
            scopes: ["openid", "profile", "email"], 
            serverClientId: "301052542782-d5qvmq3f1476ljo3aiu60cgl4il2dgmb.apps.googleusercontent.com" 
          }); 
        } catch {}

        const hasToken = !!localStorage.getItem("calentrip:idToken") || !!localStorage.getItem("calentrip:accessToken");
        if (hasToken) { 
          await api.signOut().catch(() => {}); 
        }
      }
    } catch { 
      console.warn("GoogleAuth.signOut crash evitado."); 
    }

    setUser(null);
    try {
      localStorage.removeItem("calentrip:idToken");
      localStorage.removeItem("calentrip:accessToken");
      localStorage.removeItem("calentrip:user:name");
      localStorage.removeItem("calentrip:user:email");
      localStorage.removeItem("calentrip:user:imageUrl");
      localStorage.removeItem("calentrip:auth_grace_until");
      localStorage.removeItem("calentrip_backup_route");
    } catch {}
  }

  return (
    <NativeAuthContext.Provider value={{ user, setUser, status, authenticating, initialized, loginWithGoogle, logout }}>
      {children}
    </NativeAuthContext.Provider>
  );
}

export function useNativeAuth() {
  return useContext(NativeAuthContext);
}
