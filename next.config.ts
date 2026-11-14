import withPWAInit from "next-pwa";
import path from "node:path";

const pwaOptions = {
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // cache static assets only, everything else goes to the network
  runtimeCaching: [
    { urlPattern: /\/_next\/static\/.+/i, handler: "CacheFirst", options: { cacheName: "next-static", expiration: { maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 } } },
    { urlPattern: /\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?|ttf|otf)$/i, handler: "StaleWhileRevalidate", options: { cacheName: "static-assets", expiration: { maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 } } },
    { urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i, handler: "CacheFirst", options: { cacheName: "google-fonts", expiration: { maxEntries: 8, maxAgeSeconds: 365 * 24 * 60 * 60 } } },
    { urlPattern: /.*/i, handler: "NetworkOnly" },
  ],
};

const withPWA = withPWAInit(pwaOptions as Parameters<typeof withPWAInit>[0]);

export default withPWA({
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(),
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
});
