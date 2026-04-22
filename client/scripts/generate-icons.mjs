/**
 * Generate apple-touch-icon.png from SVG
 * Run: node client/scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SVG for 180x180 apple-touch-icon (square with rounded corners implied by iOS)
const svgIcon = `
<svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="180" height="180" fill="#3182f6"/>
  <path d="M45 65L68 115L90 80L112 115L135 65" stroke="#ffbd51" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

async function generateIcons() {
  const publicDir = join(__dirname, '..', 'public');

  // Generate apple-touch-icon.png (180x180)
  await sharp(Buffer.from(svgIcon))
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));

  console.log('Generated: apple-touch-icon.png (180x180)');
}

generateIcons().catch(console.error);
