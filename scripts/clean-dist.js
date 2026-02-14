// Clean dist/win-unpacked to avoid access denied errors during rebuilds
const fs = require('fs');
const path = require('path');

function rmrf(target) {
  try {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
      console.log('Removed:', target);
    }
  } catch (e) {
    console.error('Failed to remove', target, e.message);
  }
}

const distDir = path.resolve(__dirname, '..', 'dist');
rmrf(path.join(distDir, 'win-unpacked'));