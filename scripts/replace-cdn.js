const fs = require('fs');
const path = require('path');

function replaceCDNInFile(filePath, rendererDir) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  const cdnPatternWithConfig = /<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*<script>[\s\S]*?<\/script>/;
  const cdnPatternSimple = /<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/;
  
  const fileDir = path.dirname(filePath);
  const relativePath = path.relative(fileDir, path.join(rendererDir, 'tailwind-output.css')).replace(/\\/g, '/');
  
  if (cdnPatternWithConfig.test(content)) {
    content = content.replace(cdnPatternWithConfig, `<link rel="stylesheet" href="${relativePath}">`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
    return true;
  } else if (cdnPatternSimple.test(content)) {
    content = content.replace(cdnPatternSimple, `<link rel="stylesheet" href="${relativePath}">`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
    return true;
  }
  
  return false;
}

function findHTMLFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findHTMLFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

const rendererDir = path.join(__dirname, '../src/renderer');
const htmlFiles = findHTMLFiles(rendererDir);

let updatedCount = 0;
htmlFiles.forEach(file => {
  if (replaceCDNInFile(file, rendererDir)) {
    updatedCount++;
  }
});

console.log(`\n✓ Done! Updated ${updatedCount} file(s).`);
