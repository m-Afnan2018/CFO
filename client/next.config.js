/** @type {import('next').NextConfig} */
// const apiOrigin = process.env.API_ORIGIN || 'http://localhost:4000';
const apiOrigin = 'http://localhost:4000';
const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiOrigin}/api/:path*` },
    ];
  },
};
module.exports = nextConfig;
