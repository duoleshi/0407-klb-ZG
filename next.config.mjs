/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["pdf-parse", "sql.js"],
  // 配置 Turbopack 忽略 sql.js 的 WASM 文件
  turbopack: {
    resolveAlias: {
      'sql.js': 'sql.js',
    },
  },
}

export default nextConfig
