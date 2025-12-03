import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://calentrip.digital";
  const now = new Date();
  const links = [
    "/",
    "/flights/search",
    "/flights/results",
    "/flights/book",
    "/accommodation/search",
    "/entertainment/reservations",
    "/calendar/final",
    "/calendar/month",
    "/legal/privacy",
    "/legal/terms",
    "/profile",
    "/support",
  ];
  return links.map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: "daily", priority: p === "/" ? 1 : 0.7 }));
}

