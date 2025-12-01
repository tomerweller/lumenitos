import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET() {
  const isTestnet = process.env.NEXT_PUBLIC_STELLAR_NETWORK !== 'mainnet';
  // Use testnet icon with green dot, or mainnet icon with red dot
  const iconName = isTestnet ? 'icon-192-testnet.png' : 'icon-192-mainnet.png';
  const iconPath = join(process.cwd(), 'public', iconName);

  const iconBuffer = readFileSync(iconPath);

  return new Response(iconBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
