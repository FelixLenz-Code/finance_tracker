import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Standard-Build; das Docker-Image nutzt `next start` mit vollen node_modules
     (robust mit Prisma 7, dessen migrate-CLI diverse Transitiv-Deps braucht). */
};

export default nextConfig;
