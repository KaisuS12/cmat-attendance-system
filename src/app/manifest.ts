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
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
  };
}
