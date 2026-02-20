/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // 输出到 docs 文件夹 (GitHub Pages 默认读取这个)
  distDir: 'docs',
}

module.exports = nextConfig
