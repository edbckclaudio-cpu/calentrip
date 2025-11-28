import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CalenTrip",
    short_name: "CalenTrip",
    description: "Planeje, salve e compartilhe seu calendário de viagem.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#007AFF",
    icons: [
      { src: "/icone-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icone-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
  };
}
