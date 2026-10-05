import type { MetadataRoute } from "next";

// Lets students "Add to Home Screen" so the attendance app opens like a
// native app at events.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CMAT Council Attendance",
    short_name: "CMAT Attendance",
    description: "QR-based attendance for CMAT council events",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    icons: [
      { src: "/brand/cmat-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
