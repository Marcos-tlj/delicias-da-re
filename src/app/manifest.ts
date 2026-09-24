import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Delícias da Rê — Gestão",
    short_name: "Delícias da Rê",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f4f1",
    theme_color: "#2a1c15",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
