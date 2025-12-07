/**
 * Generate base icons with IBM Plex Mono style "L"
 * The L is designed to match the monospace font used in the app title
 */

const sharp = require('sharp');
const path = require('path');

// Create an SVG "L" that matches IBM Plex Mono style
// IBM Plex Mono has thin strokes with small serifs
function createLSvg(size) {
  // IBM Plex Mono proportions - thinner strokes with serifs
  const strokeWidth = Math.round(size * 0.06); // Much thinner stroke
  const serifSize = Math.round(size * 0.03); // Small serifs
  const serifLength = Math.round(size * 0.05); // Serif extension
  const padding = Math.round(size * 0.20); // Padding from edges

  // Vertical stem position
  const stemLeft = padding;
  const stemTop = padding;
  const stemBottom = size - padding;
  const stemHeight = stemBottom - stemTop;

  // Horizontal foot
  const footRight = size - padding;
  const footTop = stemBottom - strokeWidth;
  const footWidth = footRight - stemLeft;

  // Create the L shape with serifs (matching IBM Plex Mono)
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#0D1210"/>

      <!-- Top serif on vertical stem -->
      <rect
        x="${stemLeft - serifLength}"
        y="${stemTop}"
        width="${strokeWidth + serifLength * 2}"
        height="${serifSize}"
        fill="white"
      />

      <!-- Vertical stem -->
      <rect
        x="${stemLeft}"
        y="${stemTop}"
        width="${strokeWidth}"
        height="${stemHeight}"
        fill="white"
      />

      <!-- Horizontal foot -->
      <rect
        x="${stemLeft}"
        y="${footTop}"
        width="${footWidth}"
        height="${strokeWidth}"
        fill="white"
      />

      <!-- Bottom serif on horizontal foot -->
      <rect
        x="${footRight - strokeWidth}"
        y="${footTop - serifLength}"
        width="${strokeWidth}"
        height="${strokeWidth + serifLength * 2}"
        fill="white"
      />
    </svg>
  `;

  return Buffer.from(svg);
}

async function generateIcon(size, outputPath) {
  const svg = createLSvg(size);

  await sharp(svg)
    .png()
    .toFile(outputPath);

  console.log(`Generated: ${outputPath}`);
}

async function main() {
  const publicDir = path.join(__dirname, '..', 'public');

  // Generate base icons
  await generateIcon(512, path.join(publicDir, 'icon-512.png'));
  await generateIcon(192, path.join(publicDir, 'icon-192.png'));

  console.log('Base icons generated successfully!');
  console.log('Run generate-network-icons.js to add network dots.');
}

main().catch(console.error);
