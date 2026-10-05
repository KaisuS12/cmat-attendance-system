import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The app itself needs the camera (scanner) and location (QR generation);
  // nothing embedded may ask for them, and nothing needs the microphone.
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // The scanner page (src/components/Scanner.tsx) drives the
  // camera directly via html5-qrcode, which isn't built to survive being
  // started twice back-to-back on the same DOM node — exactly what Strict
  // Mode's dev-only double-invoke does to effects. Production builds never
  // double-invoke regardless of this setting, so this only affects dev.
  reactStrictMode: false,
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
