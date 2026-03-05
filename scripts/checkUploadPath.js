const path = require('path');

// Simulate upload middleware path resolution
console.log('🔍 UPLOAD MIDDLEWARE PATH RESOLUTION\n');

// Simulate __dirname from upload.js location
const uploadMiddlewarePath = path.resolve(__dirname, '..', 'middleware');
console.log('1. Upload middleware location:', uploadMiddlewarePath);

// Simulate the BASE_STORAGE_PATH calculation from upload.js
const BASE_STORAGE_PATH = path.resolve(uploadMiddlewarePath, '..', '..', 'tile_uploads');
console.log('2. BASE_STORAGE_PATH from upload.js:', BASE_STORAGE_PATH);

console.log('\n📂 PATH BREAKDOWN:');
console.log('   middleware/upload.js location:', uploadMiddlewarePath);
console.log('   Go up one level (..):', path.resolve(uploadMiddlewarePath, '..'));
console.log('   Go up two levels (.., ..):', path.resolve(uploadMiddlewarePath, '..', '..'));
console.log('   Add tile_uploads:', BASE_STORAGE_PATH);

console.log('\n🎯 EXPECTED DIRECTORY STRUCTURE:');
console.log('   D:\\digihack\\');
console.log('   ├── project\\');
console.log('   │   └── server\\');
console.log('   │       └── middleware\\upload.js');
console.log('   └── tile_uploads\\ ← TARGET');

// Check if directory exists
const fs = require('fs');
console.log('\n📁 DIRECTORY STATUS:');
console.log('   Expected path:', BASE_STORAGE_PATH);
console.log('   Directory exists:', fs.existsSync(BASE_STORAGE_PATH));

// Show what should be created
console.log('\n🛠️ TO CREATE THE DIRECTORY:');
console.log('   mkdir', BASE_STORAGE_PATH.replace('D:\\digihack\\', ''));