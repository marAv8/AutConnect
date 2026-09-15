import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow local browsers and phones on the development LAN to load the
  // client runtime when Next is bound to 0.0.0.0. This affects dev only.
  allowedDevOrigins: ["127.0.0.1", "192.168.1.170"],
};

export default nextConfig;
