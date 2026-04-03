/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["pdf-parse", "sql.js"],
  // 添加空的 turbopack 配置以消除警告
  turbopack: {},
}

export default nextConfig
