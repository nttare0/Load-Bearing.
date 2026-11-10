import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // React Flow ships ESM that the server bundler does not need to parse.
    optimizePackageImports: ["@xyflow/react", "lucide-react"],
  },
};

export default nextConfig;
