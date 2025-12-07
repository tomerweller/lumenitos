/**
 * Generate network-specific icons with colored dot indicator in bottom-left corner
 * - Local: blue dot
 * - Testnet: green dot
 * - Mainnet: red dot
 */

const sharp = require('sharp');
const path = require('path');

async function addDot(inputPath, outputPath, size, color) {
  const dotSize = Math.round(size * 0.25); // 25% of icon size
  const padding = Math.round(size * 0.08); // 8% padding from edge

  // Create colored dot SVG
  const dot = Buffer.from(`
    <svg width="${size}" height="${size}">
      <circle
        cx="${padding + dotSize/2}"
        cy="${size - padding - dotSize/2}"
        r="${dotSize/2}"
        fill="${color}"
      />
    </svg>
  `);

  await sharp(inputPath)
    .composite([{
      input: dot,
      top: 0,
      left: 0,
    }])
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

async function main() {
  const publicDir = path.join(__dirname, '..', 'public');

  const BLUE = '#007aff';   // Local development
  const GREEN = '#28a745';  // Testnet
  const RED = '#ff3b30';    // Mainnet

  // Generate local icons (blue dot)
  await addDot(
    path.join(publicDir, 'icon-192.png'),
    path.join(publicDir, 'icon-192-local.png'),
    192,
    BLUE
  );

  await addDot(
    path.join(publicDir, 'icon-512.png'),
    path.join(publicDir, 'icon-512-local.png'),
    512,
    BLUE
  );

  // Generate testnet icons (green dot)
  await addDot(
    path.join(publicDir, 'icon-192.png'),
    path.join(publicDir, 'icon-192-testnet.png'),
    192,
    GREEN
  );

  await addDot(
    path.join(publicDir, 'icon-512.png'),
    path.join(publicDir, 'icon-512-testnet.png'),
    512,
    GREEN
  );

  // Generate mainnet icons (red dot)
  await addDot(
    path.join(publicDir, 'icon-192.png'),
    path.join(publicDir, 'icon-192-mainnet.png'),
    192,
    RED
  );

  await addDot(
    path.join(publicDir, 'icon-512.png'),
    path.join(publicDir, 'icon-512-mainnet.png'),
    512,
    RED
  );

  console.log('Network icons generated successfully!');
}

main().catch(console.error);
