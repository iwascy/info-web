import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root },
  async redirects() {
    return [
      { source: "/services/pikpak-115", destination: "/migration/pikpak-115", permanent: true },
      { source: "/sync/pikpak-to-115-migration", destination: "/migration/pikpak-115", permanent: true }
    ];
  }
};

export default nextConfig;
