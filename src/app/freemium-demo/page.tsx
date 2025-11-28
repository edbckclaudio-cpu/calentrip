"use client";
import Script from "next/script";
import App from "@/demo/App.jsx";

export default function Page() {
  return (
    <>
      <Script id="freemium-vars" strategy="beforeInteractive">
        {`
          window.__app_id = "calentrip";
          // Defina window.__firebase_config com seu config do Firebase para ativar autenticação real.
          // Exemplo:
          // window.__firebase_config = {
          //   apiKey: "...",
          //   authDomain: "...",
          //   projectId: "...",
          // };
          // Opcional: token custom (se disponível)
          // window.__initial_auth_token = "...";
        `}
      </Script>
      <App />
    </>
  );
}

