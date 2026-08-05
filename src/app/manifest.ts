import type { MetadataRoute } from "next";

/**
 * Installed-app identity for browsers that offer "add to home screen". Names
 * stay in Arabic-first order to match the default locale, and the icons are the
 * same two files the browser tab already uses — one mark, no separate set to
 * keep in sync.
 *
 * `theme_color` is the brand dark rather than a surface colour: it paints the
 * system chrome around the app, where the plate of the mark is the reference.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "صراف — Saraf",
    short_name: "صراف",
    description: "لوحة إدارة صراف — Saraf back-office administration",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1c1e1c",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
