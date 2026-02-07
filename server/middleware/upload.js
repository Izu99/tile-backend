const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

/**
 * 🔥 ROBUST FILE UPLOAD MIDDLEWARE
 * 
 * Features:
 * - Stores files outside project directory (../../uploads_storage)
 * - Dynamic sub-folders based on fieldname
 * - Generates unique ObjectId for each file
 * - Passes generatedId and relativeFilePath to controller
 * - Auto-creates directories if they don't exist
 */

// Base storage path - two levels above server directory using cross-platform path handling
const BASE_STORAGE_PATH = path.resolve(__dirname, '..', '..', '..', 'uploads_storage');

// 🔍 VERIFICATION: Log the resolved upload directory path on module load
console.log('📁 Upload Middleware Configuration:'.green);
console.log(`   Base Storage Path: ${BASE_STORAGE_PATH}`.green);
console.log(`   Directory Exists: ${fs.existsSync(BASE_STORAGE_PATH)}`.green);
console.log(`   Platform: ${process.platform}`.green);

// Dynamic sub-folder mapping based on fieldname
const FOLDER_MAPPING = {
    avatar: 'profiles',
    signature: 'signatures',
    po_image: 'purchase_order_images',
    invoice: 'invoices',
    // Add more mappings as needed
    default: 'others'
};

/**
 * Get sub-folder name based on fieldname
 * @param {string} fieldname - The multer fieldname
 * @returns {string} - Sub-folder name
 */
function getSubFolder(fieldname) {
    return FOLDER_MAPPING[fieldname] || FOLDER_MAPPING.default;
}

/**
 * Ensure directory exists, create if it doesn't
 * @param {string} dirPath - Directory path to check/create
 */
function ensureDirectoryExists(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Created directory: ${dirPath}`.green);
    }
}

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        try {
            // Ensure base storage directory exists
            ensureDirectoryExists(BASE_STORAGE_PATH);

            // Get sub-folder based on fieldname
            const subFolder = getSubFolder(file.fieldname);
            const fullPath = path.join(BASE_STORAGE_PATH, subFolder);

            // Ensure sub-folder exists
            ensureDirectoryExists(fullPath);

            console.log(`📂 Upload destination: ${fullPath} (fieldname: ${file.fieldname})`.cyan);
            cb(null, fullPath);
        } catch (error) {
            console.error('❌ Error setting upload destination:', error);
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        try {
            // Generate unique ObjectId for the file
            const generatedId = new mongoose.Types.ObjectId();

            // Get file extension
            const ext = path.extname(file.originalname).toLowerCase();

            // Create filename using generated ID
            const filename = `${generatedId}${ext}`;

            // Get sub-folder for relative path (use forward slashes for URLs)
            const subFolder = getSubFolder(file.fieldname);
            const relativeFilePath = `${subFolder}/${filename}`; // Keep forward slashes for URLs

            // Pass data to controller via req object
            if (!req.uploadData) req.uploadData = {};
            req.uploadData[file.fieldname] = {
                generatedId: generatedId.toString(),
                relativeFilePath: relativeFilePath,
                originalName: file.originalname,
                fieldname: file.fieldname,
                subFolder: subFolder
            };

            console.log(`🔄 Generated file data:`.cyan);
            console.log(`   ID: ${generatedId}`);
            console.log(`   Relative Path: ${relativeFilePath}`);
            console.log(`   Original: ${file.originalname}`);

            cb(null, filename);
        } catch (error) {
            console.error('❌ Error generating filename:', error);
            cb(error);
        }
    }
});

// File filter for security
const fileFilter = (req, file, cb) => {
    console.log(`🔍 File filter check: ${file.originalname} (${file.mimetype})`.cyan);
    console.log(`   Field name: ${file.fieldname}`.cyan);
    console.log(`   File size: ${file.size || 'unknown'}`.cyan);

    // Allowed file types
    const allowedMimes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'application/pdf',
        'image/webp'
    ];

    // Allowed extensions
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();

    console.log(`   Extension: ${ext}`.cyan);
    console.log(`   MIME type: ${file.mimetype}`.cyan);

    // Check both mimetype and extension
    const mimeOk = allowedMimes.includes(file.mimetype);
    const extOk = allowedExts.includes(ext);

    console.log(`   MIME OK: ${mimeOk}, Extension OK: ${extOk}`.cyan);

    if (mimeOk && extOk) {
        console.log(`✅ File accepted: ${file.originalname}`.green);
        cb(null, true);
    } else {
        console.log(`❌ File rejected: ${file.originalname} (mime: ${file.mimetype}, ext: ${ext})`.red);
        console.log(`   Allowed MIME types: ${allowedMimes.join(', ')}`.red);
        console.log(`   Allowed extensions: ${allowedExts.join(', ')}`.red);
        const error = new Error(`Invalid file type. Allowed: ${allowedExts.join(', ')}`);
        error.code = 'INVALID_FILE_TYPE';
        cb(error, false);
    }
};

// Create multer instance
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 5 // Maximum 5 files per request
    }
});

/**
 * Middleware to handle upload errors
 */
const handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        console.error('❌ Multer Error:', error.message);

        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    success: false,
                    message: 'File too large. Maximum size is 10MB.',
                    error: 'FILE_TOO_LARGE'
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    success: false,
                    message: 'Too many files. Maximum 5 files allowed.',
                    error: 'TOO_MANY_FILES'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    success: false,
                    message: 'Unexpected field name in file upload.',
                    error: 'UNEXPECTED_FIELD'
                });
            default:
                return res.status(400).json({
                    success: false,
                    message: 'File upload error.',
                    error: error.code
                });
        }
    } else if (error && error.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
            success: false,
            message: error.message,
            error: 'INVALID_FILE_TYPE'
        });
    }

    next(error);
};

/**
 * Helper function to get full file URL
 * @param {string} relativeFilePath - Relative file path from database
 * @param {object} req - Express request object
 * @returns {string} - Full file URL
 */
function getFileUrl(relativeFilePath, req) {
    if (!relativeFilePath) return null;

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/uploads/${relativeFilePath}`;
}

/**
 * Helper function to delete file
 * @param {string} relativeFilePath - Relative file path to delete
 * @returns {boolean} - Success status
 */
function deleteFile(relativeFilePath) {
    try {
        if (!relativeFilePath) return false;

        const fullPath = path.join(BASE_STORAGE_PATH, relativeFilePath);

        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`🗑️ Deleted file: ${relativeFilePath}`.yellow);
            return true;
        } else {
            console.log(`⚠️ File not found for deletion: ${relativeFilePath}`.yellow);
            return false;
        }
    } catch (error) {
        console.error(`❌ Error deleting file ${relativeFilePath}:`, error);
        return false;
    }
}

// Export different upload configurations
module.exports = {
    // Single file upload
    single: (fieldname) => [
        upload.single(fieldname),
        handleUploadError
    ],

    // Multiple files with same fieldname
    array: (fieldname, maxCount = 5) => [
        upload.array(fieldname, maxCount),
        handleUploadError
    ],

    // Multiple files with different fieldnames
    fields: (fields) => [
        upload.fields(fields),
        handleUploadError
    ],

    // Any files
    any: () => [
        upload.any(),
        handleUploadError
    ],

    // Helper functions
    getFileUrl,
    deleteFile,
    BASE_STORAGE_PATH,
    FOLDER_MAPPING,

    // Middleware to log upload data (for debugging)
    logUploadData: (req, res, next) => {
        if (req.uploadData) {
            console.log('📋 Upload Data Summary:'.cyan);
            Object.keys(req.uploadData).forEach(fieldname => {
                const data = req.uploadData[fieldname];
                console.log(`   ${fieldname}: ${data.relativeFilePath} (ID: ${data.generatedId})`);
            });
        }
        next();
    }
};