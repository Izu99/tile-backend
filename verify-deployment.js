#!/usr/bin/env node

/**
 * Pre-Deployment Verification Script
 * Checks all critical paths, dependencies, and configurations before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Starting Pre-Deployment Verification...\n');

let hasErrors = false;
let warnings = 0;

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
};

function success(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function error(message) {
    console.log(`${colors.red}❌ ${message}${colors.reset}`);
    hasErrors = true;
}

function warning(message) {
    console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
    warnings++;
}

function info(message) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

// 1. Check Critical Files Exist
console.log('📁 Checking Critical Files...');
const criticalFiles = [
    'server.js',
    'package.json',
    '.env',
    'config/database.js',
    'middleware/errorHandler.js',
    'middleware/auth.js',
    'utils/responseHandler.js',
];

criticalFiles.forEach(file => {
    if (fs.existsSync(file)) {
        success(`File exists: ${file}`);
    } else {
        if (file === '.env') {
            warning(`File missing: ${file} (required for production)`);
        } else {
            error(`File missing: ${file}`);
        }
    }
});

console.log('');

// 2. Check All Require Paths
console.log('🔗 Checking Require Paths...');
const requireChecks = [
    { file: './middleware/errorHandler', desc: 'Error Handler' },
    { file: './middleware/auth', desc: 'Auth Middleware' },
    { file: './utils/responseHandler', desc: 'Response Handler' },
    { file: './config/database', desc: 'Database Config' },
    { file: './utils/modelLoader', desc: 'Model Loader' },
    { file: './services/cacheService', desc: 'Cache Service' },
    { file: './services/websocketService', desc: 'WebSocket Service' },
];

requireChecks.forEach(({ file, desc }) => {
    try {
        require(file);
        success(`${desc}: ${file}`);
    } catch (e) {
        error(`${desc} failed: ${e.message}`);
    }
});

console.log('');

// 3. Check Models Directory
console.log('📦 Checking Models...');
const modelsDir = './models';
if (fs.existsSync(modelsDir)) {
    const models = fs.readdirSync(modelsDir).filter(f => f.endsWith('.js'));
    models.forEach(model => {
        try {
            require(`./models/${model}`);
            success(`Model loaded: ${model}`);
        } catch (e) {
            error(`Model failed: ${model} - ${e.message}`);
        }
    });
} else {
    error('Models directory not found');
}

console.log('');

// 4. Check Routes Directory
console.log('🛣️  Checking Routes...');
const routesDir = './routes';
if (fs.existsSync(routesDir)) {
    const routes = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
    routes.forEach(route => {
        try {
            require(`./routes/${route}`);
            success(`Route loaded: ${route}`);
        } catch (e) {
            error(`Route failed: ${route} - ${e.message}`);
        }
    });
} else {
    error('Routes directory not found');
}

console.log('');

// 5. Check Controllers Directory
console.log('🎮 Checking Controllers...');
const controllersDir = './controllers';
if (fs.existsSync(controllersDir)) {
    const controllers = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));
    controllers.forEach(controller => {
        try {
            require(`./controllers/${controller}`);
            success(`Controller loaded: ${controller}`);
        } catch (e) {
            error(`Controller failed: ${controller} - ${e.message}`);
        }
    });
} else {
    error('Controllers directory not found');
}

console.log('');

// 6. Check Environment Variables
console.log('🔐 Checking Environment Variables...');
require('dotenv').config();

const requiredEnvVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_EXPIRE',
    'NODE_ENV',
];

requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
        success(`Environment variable set: ${envVar}`);
    } else {
        error(`Environment variable missing: ${envVar}`);
    }
});

console.log('');

// 7. Check Package Dependencies
console.log('📚 Checking Dependencies...');
const packageJson = require('./package.json');
const requiredDeps = [
    'express',
    'mongoose',
    'jsonwebtoken',
    'bcryptjs',
    'dotenv',
    'cors',
    'helmet',
    'compression',
];

requiredDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
        success(`Dependency installed: ${dep}`);
    } else {
        error(`Dependency missing: ${dep}`);
    }
});

console.log('');

// 8. Check Node Modules
console.log('📦 Checking Node Modules...');
if (fs.existsSync('./node_modules')) {
    success('node_modules directory exists');
    
    // Check if critical modules are installed
    const criticalModules = ['express', 'mongoose', 'jsonwebtoken'];
    criticalModules.forEach(mod => {
        if (fs.existsSync(`./node_modules/${mod}`)) {
            success(`Module installed: ${mod}`);
        } else {
            error(`Module not installed: ${mod}`);
        }
    });
} else {
    error('node_modules directory not found - run npm install');
}

console.log('');

// 9. Check File Permissions (Unix-like systems)
if (process.platform !== 'win32') {
    console.log('🔒 Checking File Permissions...');
    try {
        fs.accessSync('./server.js', fs.constants.R_OK);
        success('server.js is readable');
    } catch (e) {
        error('server.js is not readable');
    }
}

console.log('');

// 10. Check for Common Issues
console.log('🔍 Checking for Common Issues...');

// Check for case-sensitivity issues in requires
const checkCaseSensitivity = (dir) => {
    if (!fs.existsSync(dir)) return;
    
    // Skip node_modules directory
    if (dir.includes('node_modules')) return;
    
    const files = fs.readdirSync(dir, { withFileTypes: true });
    files.forEach(file => {
        if (file.isDirectory()) {
            checkCaseSensitivity(path.join(dir, file.name));
        } else if (file.name.endsWith('.js')) {
            const filePath = path.join(dir, file.name);
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Check for Windows-style paths (but exclude regex escape sequences and this verification file)
            if (content.includes('\\\\') && !filePath.includes('verify-deployment.js')) {
                // Check if it's a regex escape sequence (safe to ignore)
                // Common patterns: .replace(/[...\\]/g, '\\$&') or /[...\\]/ or [\]\\]
                const regexEscapePatterns = [
                    /\.replace\([^)]*\\\\[^)]*\)/,      // .replace() with backslash
                    /\/\[[^\]]*\\\\[^\]]*\]\//,          // Regex character class with backslash
                    /new RegExp\([^)]*\\\\[^)]*\)/,     // new RegExp() with backslash
                    /\[\\?\]\\\\?\]/                     // Character class with escaped brackets and backslash
                ];
                
                const hasRegexEscape = regexEscapePatterns.some(pattern => pattern.test(content));
                
                if (!hasRegexEscape) {
                    warning(`Windows-style path found in: ${filePath}`);
                }
            }
            
            // Check for incorrect case in common requires
            const incorrectPatterns = [
                /require\(['"].*[A-Z].*errorHandler/,
                /require\(['"].*[A-Z].*responseHandler/,
            ];
            
            incorrectPatterns.forEach(pattern => {
                if (pattern.test(content)) {
                    warning(`Potential case-sensitivity issue in: ${filePath}`);
                }
            });
        }
    });
};

checkCaseSensitivity('./');
success('Case-sensitivity check completed');

console.log('');

// Summary
console.log('═══════════════════════════════════════');
console.log('📊 Verification Summary');
console.log('═══════════════════════════════════════');

if (hasErrors) {
    console.log(`${colors.red}❌ FAILED: ${hasErrors ? 'Errors found' : 'No errors'}${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Warnings: ${warnings}${colors.reset}`);
    console.log('');
    console.log('🔧 Please fix the errors above before deploying.');
    process.exit(1);
} else if (warnings > 0) {
    console.log(`${colors.green}✅ PASSED: No critical errors${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Warnings: ${warnings}${colors.reset}`);
    console.log('');
    console.log('💡 Consider addressing warnings before deploying.');
    process.exit(0);
} else {
    console.log(`${colors.green}✅ PASSED: All checks successful!${colors.reset}`);
    console.log('');
    console.log('🚀 Ready for deployment!');
    process.exit(0);
}
