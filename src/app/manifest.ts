import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Delícias da Rê",
    short_name: "Delícias da Rê",
    description: "Peça bolos, doces e tortas da Delícias da Rê.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf5ec",
    theme_color: "#4b2e20",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
