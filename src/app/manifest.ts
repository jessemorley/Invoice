import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Invoicing",
    short_name: "Invoices",
    description: "Freelance invoicing app",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/app_icon.png",
        sizes: "any",
        type: "image/png",
      },
    ],
  };
}
