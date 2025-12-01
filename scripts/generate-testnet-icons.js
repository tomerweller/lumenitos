/**
 * Generate testnet icons with red dot indicator in bottom-left corner
 */

const sharp = require('sharp');
const path = require('path');

async function addRedDot(inputPath, outputPath, size) {
  const dotSize = Math.round(size * 0.25); // 25% of icon size
  const padding = Math.round(size * 0.08); // 8% padding from edge

  // Create red dot SVG
  const redDot = Buffer.from(`
    <svg width="${size}" height="${size}">
      <circle
        cx="${padding + dotSize/2}"
        cy="${size - padding - dotSize/2}"
        r="${dotSize/2}"
        fill="#ff3b30"
      />
    </svg>
  `);

  await sharp(inputPath)
    .composite([{
      input: redDot,
      top: 0,
      left: 0,
    }])
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

async function main() {
  const publicDir = path.join(__dirname, '..', 'public');

  // Generate testnet versions of PWA icons
  await addRedDot(
    path.join(publicDir, 'icon-192.png'),
    path.join(publicDir, 'icon-192-testnet.png'),
    192
  );

  await addRedDot(
    path.join(publicDir, 'icon-512.png'),
    path.join(publicDir, 'icon-512-testnet.png'),
    512
  );

  console.log('Testnet icons generated successfully!');
}

main().catch(console.error);
