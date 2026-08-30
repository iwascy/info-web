import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root },
  async redirects() {
    return [
      { source: "/migration/pikpak-115", destination: "/sync/pikpak-to-115-migration", permanent: true }
    ];
  }
};

export default nextConfig;
