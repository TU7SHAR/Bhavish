/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix workspace root detection when multiple lockfiles exist
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
