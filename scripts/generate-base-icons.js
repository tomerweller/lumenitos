/**
 * Generate base icons with IBM Plex Mono style "L"
 * The L is designed to match the monospace font used in the app title
 */

const sharp = require('sharp');
const path = require('path');

// Create an SVG "L" that matches IBM Plex Mono style
// IBM Plex Mono has thin strokes with slightly squared terminals
function createLSvg(size) {
  // Proportions based on IBM Plex Mono "L" character
  const strokeWidth = Math.round(size * 0.10); // Thinner stroke like monospace font
  const padding = Math.round(size * 0.18); // Padding from edges

  // Vertical stem
  const stemLeft = padding;
  const stemTop = padding;
  const stemBottom = size - padding;
  const stemHeight = stemBottom - stemTop;

  // Horizontal foot
  const footRight = size - padding;
  const footTop = stemBottom - strokeWidth;
  const footWidth = footRight - stemLeft;

  // Create the L shape with squared ends (matching monospace style)
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#0D1210"/>
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
