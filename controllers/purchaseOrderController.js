const PurchaseOrder = require('../models/PurchaseOrder');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { 
    createSearchRegex, 
    createPaginationParams, 
    calculatePaginationMeta, 
    logPerformance,
    createApiResponse,
    createDateRangeFilter
} = require('../utils/commonHelpers');
const { getFileUrl, deleteFile } = require('../middleware/upload');

/**
 * 🔥 LEAN PURCHASE ORDER CONTROLLER
 * 
 * This controller follows the "Skinny Controller" pattern:
 * - Business logic moved to PurchaseOrder model middleware and static methods
 * - Dashboard counter sync handled by Mongoose middleware
 * - JobCost synchronization handled by Mongoose middleware
 * - Controllers focus only on HTTP concerns and file upload handling
 */

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Helper function to clean up uploaded files on error - BULLETPROOF VERSION
const cleanupUploadedFile = (req, fieldName = 'po_image') => {
    try {
        // Handle both single field and multiple fields
        if (fieldName === 'all') {
            // Clean up all uploaded files
            if (req.uploadData) {
                Object.keys(req.uploadData).forEach(field => {
                    const fileData = req.uploadData[field];
                    if (fileData && fileData.relativeFilePath) {
                        deleteFile(fileData.relativeFilePath);
                        console.log(`🗑️ Cleaned up uploaded file: ${fileData.relativeFilePath}`.yellow);
                    }
                });
            }
        } else {
            // Clean up specific field
            if (req.uploadData && req.uploadData[fieldName]) {
                const imagePath = req.uploadData[fieldName].relativeFilePath;
                deleteFile(imagePath);
                console.log(`🗑️ Cleaned up uploaded file: ${imagePath}`.yellow);
            }
        }
        
        // Also handle legacy req.file structure
        if (req.file && req.file.filename) {
            const legacyPath = `uploads/invoices/${req.file.filename}`;
            deleteFile(legacyPath);
            console.log(`🗑️ Cleaned up legacy uploaded file: ${legacyPath}`.yellow);
        }
    } catch (cleanupError) {
        console.error('❌ Error during file cleanup:', cleanupError);
        // Don't throw error - cleanup failure shouldn't break the response
    }
};

// Helper function to add image data to purchase order
const addImageDataToPO = (poData, uploadData, fieldName = 'po_image') => {
    if (uploadData && uploadData[fieldName]) {
        const imageData = uploadData[fieldName];
        poData.imageId = imageData.generatedId;
        poData.imagePath = imageData.relativeFilePath;
        poData.originalImageName = imageData.originalName;
        
        console.log(`📷 Image processed: ${imageData.relativeFilePath}`.green);
        return true;
    }
    return false;
};

// ==========================================
// MAIN CRUD OPERATIONS
// ==========================================

// @desc    Get all purchase orders - OPTIMIZED with performance monitoring
// @route   GET /api/purchase-orders
// @access  Private
exports.getPurchaseOrders = async (req, res, next) => {
    console.log('API called: getPurchaseOrders for user:', req.user.id);
    try {
        const startTime = Date.now();
        const { page, limit, skip } = createPaginationParams(req.query, 15);

        // Build query
        const query = { user: req.user.id };

        // Status filter
        if (req.query.status) {
            query.status = req.query.status;
        }

        // Supplier filter
        if (req.query.supplier) {
            query.supplier = req.query.supplier;
        }

        // Date range filter
        const dateFilter = createDateRangeFilter(req.query.startDate, req.query.endDate);
        if (dateFilter) {
            query.orderDate = dateFilter;
        }

        // Search functionality
        if (req.query.search) {
            const searchRegex = createSearchRegex(req.query.search);
            if (searchRegex) {
                query.$or = [
                    { customerName: searchRegex },
                    { poId: searchRegex }
                ];
            }
        }

        // 🔥 OPTIMIZATION: Parallel execution with lean() + virtuals + select() + pagination
        const [total, purchaseOrders] = await Promise.all([
            PurchaseOrder.countDocuments(query),
            PurchaseOrder.find(query)
                .populate('supplier', 'name phone email')
                .select('poId customerName orderDate status totalAmount supplier createdAt imagePath invoiceImagePath items')
                .sort({ orderDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean({ virtuals: true }) // 🔥 LEAN VIRTUALS: Enables totalAmount virtual with performance boost
        ]);

        // Add image URLs to response - totalAmount virtual is now available with lean()
        const purchaseOrdersWithImages = purchaseOrders.map(po => {
            if (po.imagePath) {
                po.imageUrl = getFileUrl(po.imagePath, req);
            }
            if (po.invoiceImagePath) {
                po.invoiceImageUrl = getFileUrl(po.invoiceImagePath, req);
            }
            return po;
        });

        logPerformance('Purchase Orders Query', startTime, purchaseOrders.length, `${purchaseOrders.length}/${total} POs, page ${page}`);

        const pagination = calculatePaginationMeta(total, page, limit);

        return createApiResponse(res, 200, 'Purchase orders retrieved successfully', purchaseOrdersWithImages, pagination, startTime);
    } catch (error) {
        console.error('❌ getPurchaseOrders error:', error);
        next(error);
    }
};

// @desc    Get single purchase order
// @route   GET /api/purchase-orders/:id
// @access  Private
exports.getPurchaseOrder = async (req, res, next) => {
    console.log('API called: getPurchaseOrder for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        const startTime = Date.now();
        
        const purchaseOrder = await PurchaseOrder.findOne({
            _id: req.params.id,
            user: req.user.id,
        }).populate('supplier');

        if (!purchaseOrder) {
            return errorResponse(res, 404, 'Purchase order not found');
        }

        // Convert to object and add image URLs
        const responseData = purchaseOrder.toObject();
        
        if (responseData.imagePath) {
            responseData.imageUrl = getFileUrl(responseData.imagePath, req);
        }
        
        if (responseData.invoiceImagePath) {
            responseData.invoiceImageUrl = getFileUrl(responseData.invoiceImagePath, req);
        }

        logPerformance('Get Purchase Order', startTime, 1, `ID: ${req.params.id}`);

        return successResponse(res, 200, 'Purchase order retrieved successfully', responseData);
    } catch (error) {
        next(error);
    }
};

// @desc    Create purchase order - BULLETPROOF with comprehensive error handling
// @route   POST /api/purchase-orders
// @access  Private
exports.createPurchaseOrder = async (req, res, next) => {
    console.log('API called: createPurchaseOrder for user:', req.user.id);
    try {
        const startTime = Date.now();
        
        // Add user to req.body
        req.body.user = req.user.id;

        // Add image data if uploaded
        addImageDataToPO(req.body, req.uploadData);

        // 🔥 BULLETPROOF VALIDATION & CLEANUP: Comprehensive try-catch with cleanup
        let purchaseOrder;
        try {
            // 🔥 MIDDLEWARE HANDLES: ID generation, dashboard sync, JobCost sync
            purchaseOrder = await PurchaseOrder.create(req.body);
        } catch (createError) {
            // 🔥 BULLETPROOF CLEANUP: Any error during creation triggers immediate file cleanup
            console.error('❌ PurchaseOrder.create() failed:', createError.message);
            cleanupUploadedFile(req, 'all'); // Clean up all uploaded files
            
            // Handle specific error types
            if (createError.name === 'ValidationError') {
                const validationErrors = Object.values(createError.errors).map(err => err.message);
                return errorResponse(res, 400, 'Validation failed', { errors: validationErrors });
            }
            
            if (createError.code === 11000) {
                return errorResponse(res, 409, 'Purchase order with this ID already exists for your account');
            }
            
            // Re-throw for other types of errors (database connection, etc.)
            throw createError;
        }

        // Populate supplier
        await purchaseOrder.populate('supplier');

        // Prepare response with image URLs
        const responseData = purchaseOrder.toObject();
        if (responseData.imagePath) {
            responseData.imageUrl = getFileUrl(responseData.imagePath, req);
        }

        logPerformance('Create Purchase Order', startTime, 1, purchaseOrder._id);
        
        return successResponse(res, 201, 'Purchase order created successfully', responseData);
    } catch (error) {
        // 🔥 BULLETPROOF CLEANUP: Final safety net for any unexpected errors
        console.error('❌ Unexpected error in createPurchaseOrder:', error);
        cleanupUploadedFile(req, 'all');
        next(error);
    }
};

// @desc    Update purchase order - LEAN with middleware handling sync
// @route   PUT /api/purchase-orders/:id
// @access  Private
exports.updatePurchaseOrder = async (req, res, next) => {
    console.log('API called: updatePurchaseOrder for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        const startTime = Date.now();
        
        let purchaseOrder = await PurchaseOrder.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!purchaseOrder) {
            cleanupUploadedFile(req);
            return errorResponse(res, 404, 'Purchase order not found');
        }

        // Prevent updates when PO is not in Draft
        if (purchaseOrder.status && purchaseOrder.status !== 'Draft') {
            cleanupUploadedFile(req);
            return errorResponse(res, 403, 'Only Draft purchase orders can be edited');
        }

        // Handle image update if new image uploaded
        if (req.uploadData && req.uploadData.po_image) {
            // Delete old image if it exists
            if (purchaseOrder.imagePath) {
                deleteFile(purchaseOrder.imagePath);
                console.log(`🗑️ Deleted old image: ${purchaseOrder.imagePath}`.yellow);
            }
            
            // Add new image data
            addImageDataToPO(req.body, req.uploadData);
        }

        // 🔥 BULLETPROOF UPDATE: Comprehensive error handling with cleanup
        let updatedPurchaseOrder;
        try {
            // 🔥 MIDDLEWARE HANDLES: JobCost sync automatically
            updatedPurchaseOrder = await PurchaseOrder.findByIdAndUpdate(
                req.params.id,
                req.body,
                {
                    new: true,
                    runValidators: true,
                }
            ).populate('supplier');
        } catch (updateError) {
            // 🔥 BULLETPROOF CLEANUP: Clean up uploaded file if update fails
            console.error('❌ PurchaseOrder update failed:', updateError.message);
            cleanupUploadedFile(req, 'all');
            
            if (updateError.name === 'ValidationError') {
                const validationErrors = Object.values(updateError.errors).map(err => err.message);
                return errorResponse(res, 400, 'Validation failed', { errors: validationErrors });
            }
            
            throw updateError;
        }

        // Prepare response with image URLs
        const responseData = updatedPurchaseOrder.toObject();
        if (responseData.imagePath) {
            responseData.imageUrl = getFileUrl(responseData.imagePath, req);
        }
        if (responseData.invoiceImagePath) {
            responseData.invoiceImageUrl = getFileUrl(responseData.invoiceImagePath, req);
        }

        logPerformance('Update Purchase Order', startTime, 1, `ID: ${req.params.id}`);
        
        return successResponse(res, 200, 'Purchase order updated successfully', responseData);
    } catch (error) {
        // 🔥 BULLETPROOF CLEANUP: Final safety net
        cleanupUploadedFile(req, 'all');
        next(error);
    }
};

// @desc    Update purchase order status - LEAN using model static method
// @route   PATCH /api/purchase-orders/:id/status
// @access  Private
exports.updatePurchaseOrderStatus = async (req, res, next) => {
    console.log('API called: updatePurchaseOrderStatus for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        const startTime = Date.now();
        
        // Support both direct status and nested payloads
        let status = req.body && req.body.status;
        if (!status && req.body && typeof req.body === 'object') {
            // Check for nested keys or different shapes
            status = Object.values(req.body).find((v) => typeof v === 'string' && ['Draft', 'Ordered', 'Delivered', 'Paid', 'Cancelled'].includes(v)) || status;
        }
        if (!status) {
            return errorResponse(res, 400, 'Please provide a status');
        }

        // 🔥 LEAN APPROACH: Use model static method with built-in JobCost sync
        const updatedPurchaseOrder = await PurchaseOrder.updateStatus(
            req.params.id,
            req.user.id,
            status
        );

        logPerformance('Update PO Status', startTime, 1, `PO: ${req.params.id}`);

        return successResponse(res, 200, 'Status updated successfully', updatedPurchaseOrder);
    } catch (error) {
        console.error('❌ updatePurchaseOrderStatus error:', error);
        if (error.message.includes('not found')) {
            return errorResponse(res, 404, error.message);
        }
        if (error.message.includes('Invalid status')) {
            return errorResponse(res, 400, error.message);
        }
        next(error);
    }
};

// @desc    Delete purchase order - LEAN with middleware handling cleanup and sync
// @route   DELETE /api/purchase-orders/:id
// @access  Private
exports.deletePurchaseOrder = async (req, res, next) => {
    console.log('API called: deletePurchaseOrder for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        const startTime = Date.now();
        
        // 🔥 MIDDLEWARE HANDLES: File cleanup, dashboard sync, JobCost cleanup
        const purchaseOrder = await PurchaseOrder.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!purchaseOrder) {
            return errorResponse(res, 404, 'Purchase order not found');
        }

        logPerformance('Delete Purchase Order', startTime, 1, `ID: ${req.params.id}`);
        
        return successResponse(res, 200, 'Purchase order deleted successfully', null);
    } catch (error) {
        next(error);
    }
};

// ==========================================
// IMAGE UPLOAD OPERATIONS
// ==========================================

// @desc    Upload/Update purchase order image - BULLETPROOF with unified cleanup
// @route   POST /api/purchase-orders/:id/image
// @access  Private
exports.updatePurchaseOrderImage = async (req, res, next) => {
    console.log('API called: updatePurchaseOrderImage for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        const startTime = Date.now();
        
        if (!req.uploadData || !req.uploadData.po_image) {
            return errorResponse(res, 400, 'No image file uploaded');
        }
        
        // 🔥 BULLETPROOF OPERATION: Use model static method with comprehensive error handling
        let purchaseOrder;
        try {
            purchaseOrder = await PurchaseOrder.updateImage(
                req.params.id,
                req.user.id,
                req.uploadData.po_image
            );
        } catch (updateError) {
            // 🔥 BULLETPROOF CLEANUP: Clean up uploaded file if update fails
            console.error('❌ PO image update failed:', updateError.message);
            cleanupUploadedFile(req, 'all');
            
            if (updateError.message.includes('not found')) {
                return errorResponse(res, 404, updateError.message);
            }
            
            throw updateError;
        }
        
        // Prepare response with image URL
        const responseData = purchaseOrder.toObject();
        responseData.imageUrl = getFileUrl(responseData.imagePath, req);
        
        logPerformance('Update PO Image', startTime, 1, purchaseOrder._id);
        
        return createApiResponse(res, 200, 'Purchase order image updated successfully', responseData, null, startTime);
        
    } catch (error) {
        // 🔥 BULLETPROOF CLEANUP: Final safety net
        console.error('❌ Unexpected error in updatePurchaseOrderImage:', error);
        cleanupUploadedFile(req, 'all');
        next(error);
    }
};

// @desc    Upload invoice image - UNIFIED with bulletproof cleanup
// @route   POST /api/purchase-orders/:id/invoice-image
// @access  Private
exports.uploadInvoiceImage = async (req, res, next) => {
    console.log('API called: uploadInvoiceImage for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        const startTime = Date.now();
        
        if (!req.file) {
            console.log('No file uploaded in request');
            if (req.uploadError) {
                return errorResponse(res, 400, req.uploadError);
            }
            return errorResponse(res, 400, 'Please upload a file');
        }

        console.log('File uploaded successfully:', req.file.filename, 'Size:', req.file.size);

        // 🔥 UNIFIED LEGACY LOGIC: Use the newly created static method for consistency
        const imageData = {
            relativeFilePath: `uploads/invoices/${req.file.filename}`,
            originalName: req.file.originalname,
            generatedId: req.file.filename.split('.')[0] // Extract ID from filename
        };

        // 🔥 BULLETPROOF OPERATION: Use unified static method with built-in cleanup
        let purchaseOrder;
        try {
            purchaseOrder = await PurchaseOrder.updateInvoiceImage(
                req.params.id,
                req.user.id,
                imageData
            );
        } catch (updateError) {
            // 🔥 BULLETPROOF CLEANUP: Clean up uploaded file if update fails
            console.error('❌ Invoice image update failed:', updateError.message);
            cleanupUploadedFile(req, 'all'); // Clean up the uploaded file
            
            if (updateError.message.includes('not found')) {
                return errorResponse(res, 404, updateError.message);
            }
            
            throw updateError;
        }

        logPerformance('Upload Invoice Image', startTime, 1, req.params.id);

        return successResponse(res, 200, 'Invoice image uploaded successfully', {
            invoiceImagePath: purchaseOrder.invoiceImagePath,
            invoiceImageUrl: getFileUrl(purchaseOrder.invoiceImagePath, req)
        });
    } catch (error) {
        // 🔥 BULLETPROOF CLEANUP: Final safety net
        console.error('❌ Unexpected error in uploadInvoiceImage:', error);
        cleanupUploadedFile(req, 'all');
        next(error);
    }
};

// ==========================================
// DELIVERY OPERATIONS
// ==========================================

// @desc    Update delivery verification - LEAN using model static method
// @route   PUT /api/purchase-orders/:id/delivery-verification
// @access  Private
exports.updateDeliveryVerification = async (req, res, next) => {
    console.log('API called: updateDeliveryVerification for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        const startTime = Date.now();
        const { deliveryItems } = req.body;

        // 🔥 LEAN APPROACH: Use model static method with built-in validation
        const purchaseOrder = await PurchaseOrder.updateDeliveryVerification(
            req.params.id,
            req.user.id,
            deliveryItems
        );

        logPerformance('Update Delivery Verification', startTime, 1, req.params.id);

        return successResponse(res, 200, 'Delivery verification updated successfully', purchaseOrder);
    } catch (error) {
        if (error.message.includes('not found')) {
            return errorResponse(res, 404, error.message);
        }
        if (error.message.includes('Please provide delivery items')) {
            return errorResponse(res, 400, error.message);
        }
        next(error);
    }
};

module.exports = {
    // Main CRUD operations
    getPurchaseOrders: exports.getPurchaseOrders,
    getPurchaseOrder: exports.getPurchaseOrder,
    createPurchaseOrder: exports.createPurchaseOrder,
    updatePurchaseOrder: exports.updatePurchaseOrder,
    updatePurchaseOrderStatus: exports.updatePurchaseOrderStatus,
    deletePurchaseOrder: exports.deletePurchaseOrder,
    
    // Image operations
    updatePurchaseOrderImage: exports.updatePurchaseOrderImage,
    uploadInvoiceImage: exports.uploadInvoiceImage,
    
    // Delivery operations
    updateDeliveryVerification: exports.updateDeliveryVerification
};