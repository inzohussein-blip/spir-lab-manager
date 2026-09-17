import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Spir Lab Manager — إدارة المختبر",
    short_name: "المختبر",
    description: "إدارة مختبر التحاليل الطبية",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0d9488",
    dir: "rtl",
    lang: "ar",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
