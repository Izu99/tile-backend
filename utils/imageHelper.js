const fs = require('fs');
const path = require('path');

/**
 * 🔥 IMAGE HELPER UTILITIES
 * 
 * Provides utilities for image processing, especially for PDF generation
 * - Convert file paths to Base64 for embedding in PDFs
 * - Supports multi-tenant file structure
 */

// Base storage path - matches upload middleware configuration
const BASE_STORAGE_PATH = path.resolve(__dirname, '..', '..', '..', 'tile_uploads_storage');

/**
 * Convert image file to Base64 data URL for PDF embedding
 * @param {string} relativeFilePath - Relative file path (e.g., "companyId/profiles/filename.jpg")
 * @returns {string|null} - Base64 data URL or null if file not found
 */
function imageToBase64(relativeFilePath) {
    try {
        if (!relativeFilePath) {
            console.log('⚠️ No file path provided for Base64 conversion'.yellow);
            return null;
        }

        // Construct full file path
        const fullPath = path.join(BASE_STORAGE_PATH, relativeFilePath);

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            console.log(`⚠️ File not found for Base64 conversion: ${relativeFilePath}`.yellow);
            return null;
        }

        // Read file as buffer
        const fileBuffer = fs.readFileSync(fullPath);

        // Get file extension to determine MIME type
        const ext = path.extname(relativeFilePath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf'
        };

        const mimeType = mimeTypes[ext] || 'image/jpeg';

        // Convert to Base64 data URL
        const base64String = fileBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64String}`;

        console.log(`✅ Converted to Base64: ${relativeFilePath} (${(base64String.length / 1024).toFixed(2)} KB)`.green);

        return dataUrl;
    } catch (error) {
        console.error(`❌ Error converting image to Base64: ${relativeFilePath}`, error);
        return null;
    }
}

/**
 * Get image as Base64 from user object (supports both old and new field structures)
 * @param {object} user - User object from database
 * @param {string} fieldType - 'avatar' or 'signature'
 * @returns {string|null} - Base64 data URL or null
 */
function getUserImageBase64(user, fieldType = 'avatar') {
    try {
        if (!user) {
            console.log('⚠️ No user object provided'.yellow);
            return null;
        }

        // Check for new file path structure first (preferred)
        const pathField = fieldType === 'avatar' ? 'avatarPath' : 'signaturePath';
        const legacyField = fieldType; // 'avatar' or 'signature'

        if (user[pathField]) {
            // New structure: Convert file path to Base64
            console.log(`📁 Using file path for ${fieldType}: ${user[pathField]}`.cyan);
            return imageToBase64(user[pathField]);
        } else if (user[legacyField]) {
            // Legacy structure: Already Base64 string
            console.log(`📦 Using legacy Base64 for ${fieldType}`.cyan);
            
            // Check if it's already a data URL
            if (user[legacyField].startsWith('data:')) {
                return user[legacyField];
            } else {
                // Assume it's raw Base64, add data URL prefix
                return `data:image/jpeg;base64,${user[legacyField]}`;
            }
        }

        console.log(`⚠️ No ${fieldType} found for user`.yellow);
        return null;
    } catch (error) {
        console.error(`❌ Error getting user ${fieldType} Base64:`, error);
        return null;
    }
}

/**
 * Get avatar as Base64 from user object
 * @param {object} user - User object from database
 * @returns {string|null} - Base64 data URL or null
 */
function getUserAvatar(user) {
    return getUserImageBase64(user, 'avatar');
}

/**
 * Get signature as Base64 from user object
 * @param {object} user - User object from database
 * @returns {string|null} - Base64 data URL or null
 */
function getUserSignature(user) {
    return getUserImageBase64(user, 'signature');
}

/**
 * Batch convert multiple images to Base64 (for performance)
 * @param {Array<string>} filePaths - Array of relative file paths
 * @returns {Object} - Map of filePath to Base64 data URL
 */
function batchImageToBase64(filePaths) {
    const results = {};
    
    if (!Array.isArray(filePaths)) {
        console.log('⚠️ Invalid input: filePaths must be an array'.yellow);
        return results;
    }

    filePaths.forEach(filePath => {
        if (filePath) {
            results[filePath] = imageToBase64(filePath);
        }
    });

    return results;
}

module.exports = {
    imageToBase64,
    getUserImageBase64,
    getUserAvatar,
    getUserSignature,
    batchImageToBase64,
    BASE_STORAGE_PATH
};
