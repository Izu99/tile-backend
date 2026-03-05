const path = require('path');

console.log('📁 PATH RESOLUTION EXPLANATION\n');

// Current file location (__dirname)
console.log('1. Current file (__dirname):', __dirname);

// Step by step path resolution
const step1 = path.resolve(__dirname, '..');
console.log('2. Go up one level (..):', step1);

const step2 = path.resolve(__dirname, '..', '..');
console.log('3. Go up two levels (.., ..):', step2);

const finalPath = path.resolve(__dirname, '..', '..', 'tile_uploads');
console.log('4. Final path with tile_uploads:', finalPath);

console.log('\n🔍 BREAKDOWN:');
console.log('   __dirname = /project/server/scripts (current script location)');
console.log('   .. = go up one level → /project/server');
console.log('   .. = go up one level → /project');
console.log('   .. = go up one level → / (root workspace)');
console.log('   tile_uploads = add folder name → /tile_uploads');

console.log('\n📂 DIRECTORY STRUCTURE:');
console.log('   workspace/');
console.log('   ├── project/');
console.log('   │   └── server/');
console.log('   │       ├── middleware/upload.js ← __dirname');
console.log('   │       └── scripts/');
console.log('   └── tile_uploads/ ← TARGET FOLDER');

console.log('\n🎯 RESULT:');
console.log('   tile_uploads folder හදෙන්නේ workspace root level එකේ');
console.log('   project folder එකට parallel ලෙස');