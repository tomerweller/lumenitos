import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const isLocal = process.env.NODE_ENV === 'development';
  const isTestnet = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'mainnet';
  // Local: blue dot, Testnet: green dot, Mainnet: red dot
  const iconName = isLocal ? 'icon-192-local.png' : isTestnet ? 'icon-192-testnet.png' : 'icon-192-mainnet.png';
  const iconPath = join(process.cwd(), 'public', iconName);

  const iconBuffer = readFileSync(iconPath);

  return new Response(iconBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
