import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The scanner page (src/app/officer/scan/[eventDayId]/page.tsx) drives the
  // camera directly via html5-qrcode, which isn't built to survive being
  // started twice back-to-back on the same DOM node — exactly what Strict
  // Mode's dev-only double-invoke does to effects. Production builds never
  // double-invoke regardless of this setting, so this only affects dev.
  reactStrictMode: false,
};

export default nextConfig;
