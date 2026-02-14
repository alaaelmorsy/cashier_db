// Generate a 256x256 .ico from assets/icon/app.png
// Requires: sharp, png-to-ico
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

(async () => {
  try {
    const pngToIco = await import('png-to-ico');
    const toIco = pngToIco.default;

    const srcPng = path.resolve(__dirname, '..', 'assets', 'icon', 'app.png');
    const outPng = path.resolve(__dirname, '..', 'assets', 'icon', 'app-256.png');
    const outIco = path.resolve(__dirname, '..', 'assets', 'icon', 'app.ico');

    if (!fs.existsSync(srcPng)) {
      console.error('Source PNG not found:', srcPng);
      process.exit(1);
    }

    await sharp(srcPng)
      .resize(256, 256, { fit: 'cover' })
      .png({ compressionLevel: 9 })
      .toFile(outPng);

    const icoBuffer = await toIco([outPng]);
    fs.writeFileSync(outIco, icoBuffer);

    console.log('Icon generated successfully at', outIco);
  } catch (err) {
    console.error('Failed to generate .ico:', err);
    process.exit(1);
  }
})();