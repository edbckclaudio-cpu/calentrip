import type { MetadataRoute } from "next";

export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
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
    "/login",
    "/subscription/checkout",
  ];
  return links.map((p) => ({ url: p, lastModified: now, changeFrequency: "daily", priority: p === "/" ? 1 : 0.7 }));
}
