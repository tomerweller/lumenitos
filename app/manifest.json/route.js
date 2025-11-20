export async function GET() {
  const isTestnet = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'mainnet';
  const appName = isTestnet ? "Lumenitos (testnet)" : "Lumenitos";

  const manifest = {
    name: appName,
    short_name: appName,
    description: "Experimental Stellar Smart Wallet",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      'Content-Type': 'application/manifest+json',
    },
  });
}
