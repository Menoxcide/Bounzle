const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create simple placeholder icons with different sizes
const sizes = [192, 256, 384, 512];

// Simple SVG template for our icon
const createIconSVG = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#8b5cf6"/>
  <circle cx="256" cy="256" r="128" fill="#ffffff"/>
  <circle cx="256" cy="256" r="64" fill="#8b5cf6"/>
</svg>
`;

// Generate icons
async function generateIcons() {
  for (const size of sizes) {
    const svgContent = createIconSVG(size);
    const fileName = `icon-${size}x${size}.png`;
    const filePath = path.join(iconsDir, fileName);
    
    try {
      // Convert SVG to PNG using sharp
      await sharp(Buffer.from(svgContent))
        .resize(size, size)
        .png()
        .toFile(filePath);
      
      console.log(`Created icon: ${fileName}`);
    } catch (error) {
      console.error(`Failed to create ${fileName}:`, error);
    }
  }
  
  console.log('Icon generation complete!');
}

generateIcons().catch(console.error);