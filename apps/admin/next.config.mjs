/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Transpile workspace packages
  transpilePackages: [
    "@shen-zhen/core",
    "@shen-zhen/database",
    "@shen-zhen/shared",
  ],
};

export default nextConfig;
