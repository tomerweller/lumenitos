/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';
    return [
      {
        source: '/wallet',
        destination: '/',
        permanent: true,
      },
      {
        source: '/scan',
        destination: `https://lumenitos-scan.vercel.app/?network=${network}`,
        permanent: false,
      },
      {
        source: '/scan/:path*',
        destination: `https://lumenitos-scan.vercel.app/:path*?network=${network}`,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
