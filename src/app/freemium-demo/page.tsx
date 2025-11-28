"use client";
import Script from "next/script";
import App from "@/demo/App.jsx";

export default function Page() {
  return (
    <>
      <Script id="freemium-vars" strategy="beforeInteractive">
        {`
          window.__app_id = "calentrip";
          (function(){
            try {
              const cfg = {
                apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
              };
              if (cfg.apiKey && cfg.authDomain && cfg.projectId) {
                // Injeta config Firebase a partir das variáveis de ambiente públicas
                // Estas variáveis NÃO devem conter segredos (Firebase config é público)
                window.__firebase_config = cfg;
              }
            } catch {}
          })();
          // Opcional: token custom (se disponível)
          // window.__initial_auth_token = "...";
        `}
      </Script>
      <App />
    </>
  );
}
