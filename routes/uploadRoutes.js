const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Import controllers
const {
    updatePurchaseOrderImage,
    getPurchaseOrder,
    deletePurchaseOrder,
    getPurchaseOrders
} = require('../controllers/purchaseOrderController');

/**
 * 🔥 UPLOAD ROUTES EXAMPLES
 * 
 * These routes demonstrate how to use the upload middleware
 * with different file upload scenarios.
 */

// Apply authentication to all routes
router.use(protect);

// ===== PURCHASE ORDER ROUTES WITH IMAGE UPLOAD =====

// Create purchase order with image (now uses main controller)
router.post('/purchase-orders/with-image', 
    ...upload.single('po_image'),  // Upload single file with fieldname 'po_image'
    upload.logUploadData,          // Log upload data (optional, for debugging)
    require('../controllers/purchaseOrderController').createPurchaseOrder
);

// Update purchase order image
router.put('/purchase-orders/:id/image',
    ...upload.single('po_image'),
    upload.logUploadData,
    updatePurchaseOrderImage
);

// Get purchase order with image URL (now uses main controller)
router.get('/purchase-orders/:id/with-image', getPurchaseOrder);

// Get all purchase orders with image URLs (now uses main controller)
router.get('/purchase-orders/with-images', getPurchaseOrders);

// Delete purchase order with image (now uses main controller)
router.delete('/purchase-orders/:id/with-image', deletePurchaseOrder);

// ===== USER PROFILE ROUTES (Avatar & Signature) =====

// Upload user avatar
router.post('/user/avatar',
    ...upload.single('avatar'),    // Will be stored in 'profiles' folder
    upload.logUploadData,
    async (req, res, next) => {
        try {
            if (!req.uploadData || !req.uploadData.avatar) {
                return res.status(400).json({
                    success: false,
                    message: 'No avatar file uploaded'
                });
            }

            const avatarData = req.uploadData.avatar;
            
            // Update user's avatar in database
            const User = require('../models/User');
            const user = await User.findById(req.user._id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Delete old avatar if exists
            if (user.avatarPath) {
                const { deleteFile } = require('../middleware/upload');
                deleteFile(user.avatarPath);
            }

            // Update user with new avatar data
            user.avatarId = avatarData.generatedId;
            user.avatarPath = avatarData.relativeFilePath;
            user.originalAvatarName = avatarData.originalName;
            
            await user.save();

            // Generate avatar URL for response
            const { getFileUrl } = require('../middleware/upload');
            const avatarUrl = getFileUrl(user.avatarPath, req);

            res.status(200).json({
                success: true,
                message: 'Avatar uploaded successfully',
                data: {
                    avatarId: user.avatarId,
                    avatarPath: user.avatarPath,
                    avatarUrl: avatarUrl
                }
            });

        } catch (error) {
            console.error('❌ Error uploading avatar:', error);
            next(error);
        }
    }
);

// Upload user signature
router.post('/user/signature',
    ...upload.single('signature'),  // Will be stored in 'signatures' folder
    upload.logUploadData,
    async (req, res, next) => {
        try {
            if (!req.uploadData || !req.uploadData.signature) {
                return res.status(400).json({
                    success: false,
                    message: 'No signature file uploaded'
                });
            }

            const signatureData = req.uploadData.signature;
            
            // Update user's signature in database
            const User = require('../models/User');
            const user = await User.findById(req.user._id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Delete old signature if exists
            if (user.signaturePath) {
                const { deleteFile } = require('../middleware/upload');
                deleteFile(user.signaturePath);
            }

            // Update user with new signature data
            user.signatureId = signatureData.generatedId;
            user.signaturePath = signatureData.relativeFilePath;
            user.originalSignatureName = signatureData.originalName;
            
            await user.save();

            // Generate signature URL for response
            const { getFileUrl } = require('../middleware/upload');
            const signatureUrl = getFileUrl(user.signaturePath, req);

            res.status(200).json({
                success: true,
                message: 'Signature uploaded successfully',
                data: {
                    signatureId: user.signatureId,
                    signaturePath: user.signaturePath,
                    signatureUrl: signatureUrl
                }
            });

        } catch (error) {
            console.error('❌ Error uploading signature:', error);
            next(error);
        }
    }
);

// ===== MULTIPLE FILES UPLOAD EXAMPLE =====

// Upload multiple invoice files
router.post('/invoices/multiple',
    ...upload.array('invoice', 5),  // Upload up to 5 files with fieldname 'invoice'
    upload.logUploadData,
    async (req, res, next) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No invoice files uploaded'
                });
            }

            // Process each uploaded file
            const uploadedFiles = req.files.map((file, index) => {
                const uploadData = req.uploadData[`invoice_${index}`] || req.uploadData.invoice;
                return {
                    generatedId: uploadData.generatedId,
                    relativeFilePath: uploadData.relativeFilePath,
                    originalName: uploadData.originalName,
                    fileUrl: upload.getFileUrl(uploadData.relativeFilePath, req)
                };
            });

            res.status(200).json({
                success: true,
                message: `${uploadedFiles.length} invoice files uploaded successfully`,
                data: {
                    files: uploadedFiles,
                    count: uploadedFiles.length
                }
            });

        } catch (error) {
            console.error('❌ Error uploading multiple invoices:', error);
            next(error);
        }
    }
);

// ===== MIXED FIELDS UPLOAD EXAMPLE =====

// Upload avatar and signature together
router.post('/user/profile-files',
    ...upload.fields([
        { name: 'avatar', maxCount: 1 },
        { name: 'signature', maxCount: 1 }
    ]),
    upload.logUploadData,
    async (req, res, next) => {
        try {
            const uploadData = req.uploadData || {};
            const User = require('../models/User');
            const { getFileUrl, deleteFile } = require('../middleware/upload');
            
            const user = await User.findById(req.user._id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            const updateData = {};
            const responseData = {};

            // Handle avatar upload
            if (uploadData.avatar) {
                // Delete old avatar
                if (user.avatarPath) deleteFile(user.avatarPath);
                
                updateData.avatarId = uploadData.avatar.generatedId;
                updateData.avatarPath = uploadData.avatar.relativeFilePath;
                updateData.originalAvatarName = uploadData.avatar.originalName;
                
                responseData.avatar = {
                    id: updateData.avatarId,
                    path: updateData.avatarPath,
                    url: getFileUrl(updateData.avatarPath, req)
                };
            }

            // Handle signature upload
            if (uploadData.signature) {
                // Delete old signature
                if (user.signaturePath) deleteFile(user.signaturePath);
                
                updateData.signatureId = uploadData.signature.generatedId;
                updateData.signaturePath = uploadData.signature.relativeFilePath;
                updateData.originalSignatureName = uploadData.signature.originalName;
                
                responseData.signature = {
                    id: updateData.signatureId,
                    path: updateData.signaturePath,
                    url: getFileUrl(updateData.signaturePath, req)
                };
            }

            // Update user in database
            await User.findByIdAndUpdate(req.user._id, updateData);

            res.status(200).json({
                success: true,
                message: 'Profile files uploaded successfully',
                data: responseData
            });

        } catch (error) {
            console.error('❌ Error uploading profile files:', error);
            next(error);
        }
    }
);

module.exports = router;