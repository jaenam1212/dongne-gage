import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb', // 상품 이미지 최대 5MB 허용
    },
  },
};

export default nextConfig;
