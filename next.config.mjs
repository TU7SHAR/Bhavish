/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Cache Components to fix "ComponentMod.handler is not a function" error
  // This is a known bug in Next.js 16.2.x with Turbopack
  cacheComponents: false,

  // Fix workspace root detection when multiple lockfiles exist
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
