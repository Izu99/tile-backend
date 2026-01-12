const PurchaseOrder = require('../models/PurchaseOrder');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseHandler');
const { generateSequentialId } = require('../utils/idGenerator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private
exports.getPurchaseOrders = async (req, res, next) => {
    console.log('API called: getPurchaseOrders for user:', req.user.id);
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20; // Increased default limit to 20
        const skip = (page - 1) * limit;

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
        if (req.query.startDate || req.query.endDate) {
            query.orderDate = {};
            if (req.query.startDate) {
                query.orderDate.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                query.orderDate.$lte = new Date(req.query.endDate);
            }
        }

        // Customer name search
        if (req.query.search) {
            query.customerName = { $regex: req.query.search, $options: 'i' };
        }

        // Parallel execution for count and find
        const [total, purchaseOrders] = await Promise.all([
            PurchaseOrder.countDocuments(query),
            PurchaseOrder.find(query)
                .populate('supplier', 'name phone email')
                .sort({ orderDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean() // Faster result as plain JS objects
        ]);

        return paginatedResponse(
            res,
            200,
            'Purchase orders retrieved successfully',
            purchaseOrders,
            {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit,
            }
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Get single purchase order
// @route   GET /api/purchase-orders/:id
// @access  Private
exports.getPurchaseOrder = async (req, res, next) => {
    console.log('API called: getPurchaseOrder for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        const purchaseOrder = await PurchaseOrder.findOne({
            _id: req.params.id,
            user: req.user.id,
        }).populate('supplier');

        if (!purchaseOrder) {
            return errorResponse(res, 404, 'Purchase order not found');
        }

        // Only allow deletion when status is Draft
        if (purchaseOrder.status && purchaseOrder.status !== 'Draft') {
            return errorResponse(res, 403, 'Only purchase orders in Draft status can be deleted');
        }

        return successResponse(res, 200, 'Purchase order retrieved successfully', purchaseOrder);
    } catch (error) {
        next(error);
    }
};

// @desc    Create purchase order
// @route   POST /api/purchase-orders
// @access  Private
exports.createPurchaseOrder = async (req, res, next) => {
    console.log('API called: createPurchaseOrder for user:', req.user.id);
    try {
        // Add user to req.body
        req.body.user = req.user.id;

        // Generate PO ID if not provided
        if (!req.body.poId) {
            req.body.poId = await generateSequentialId(PurchaseOrder, 'PO', 'poId');
        }

        const purchaseOrder = await PurchaseOrder.create(req.body);

        // Populate supplier
        await purchaseOrder.populate('supplier');

        // Sync to JobCost Logic
        await _syncToJobCost(purchaseOrder, req.user.id);
        return successResponse(res, 201, 'Purchase order created successfully', purchaseOrder);
    } catch (error) {
        next(error);
    }
};

// Helper function to sync PO data to JobCost
const _syncToJobCost = async (purchaseOrder, userId, isDeleted = false) => {
    if (!purchaseOrder.quotationId) return;

    try {
        const JobCost = require('../models/JobCost');

        // Normalize quotationId to match JobCost (QUO- prefix)
        let qId = purchaseOrder.quotationId;
        if (qId && !qId.startsWith('QUO-')) {
            qId = `QUO-${qId}`;
        }

        const jobCost = await JobCost.findOne({
            quotationId: qId,
            user: userId
        });

        if (!jobCost) {
            console.log(`ℹ️ No JobCost found for quotation ${qId}. Skipping sync.`);
            return;
        }

        if (isDeleted) {
            // Remove items for this PO from the PO list
            jobCost.purchaseOrderItems = jobCost.purchaseOrderItems.filter(
                item => item.poId !== purchaseOrder.poId
            );
        } else {
            // Update/Add items
            // 1. Remove old items for this PO
            jobCost.purchaseOrderItems = jobCost.purchaseOrderItems.filter(
                item => item.poId !== purchaseOrder.poId
            );

            // 2. Add current items to PO items list
            const poItemCosts = purchaseOrder.items.map(item => ({
                poId: purchaseOrder.poId,
                supplierName: purchaseOrder.supplier.name,
                itemName: item.name,
                quantity: item.quantity,
                unit: item.unit || '',
                unitPrice: item.unitPrice,
                orderDate: purchaseOrder.orderDate,
                unitPrice: item.unitPrice,
                orderDate: purchaseOrder.orderDate,
                status: purchaseOrder.status,
                purchaseOrderId: purchaseOrder._id,
                invoiceImagePath: purchaseOrder.invoiceImagePath || '',
            }));

            if (!jobCost.purchaseOrderItems) jobCost.purchaseOrderItems = [];
            jobCost.purchaseOrderItems.push(...poItemCosts);

            // 3. Sync PO prices back to the main quotation table (invoiceItems)
            // ONLY if the PO is NOT in 'Draft' status
            if (purchaseOrder.status !== 'Draft') {
                purchaseOrder.items.forEach(poItem => {
                    const jobCostItem = jobCost.invoiceItems.find(
                        invItem => invItem.name && invItem.name.trim().toLowerCase() === poItem.name.trim().toLowerCase()
                    );

                    if (jobCostItem) {
                        console.log(`🔄 Syncing PO price for ${poItem.name}: ${poItem.unitPrice} (Status: ${purchaseOrder.status})`);
                        jobCostItem.costPrice = poItem.unitPrice;
                    }
                });
            } else {
                console.log(`ℹ️ PO ${purchaseOrder.poId} is in Draft status. Skipping price sync to item list.`);
            }
        }

        await jobCost.save();
        console.log(`✅ JobCost ${jobCost._id} synchronized with PO ${purchaseOrder.poId}`);
    } catch (syncError) {
        console.error('❌ Error syncing PO to JobCost:', syncError);
        // We don't throw here to avoid failing the main PO operation
    }
};

// @desc    Update purchase order
// @route   PUT /api/purchase-orders/:id
// @access  Private
exports.updatePurchaseOrder = async (req, res, next) => {
    console.log('API called: updatePurchaseOrder for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        let purchaseOrder = await PurchaseOrder.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!purchaseOrder) {
            return errorResponse(res, 404, 'Purchase order not found');
        }

        // Prevent updates when PO is not in Draft
        if (purchaseOrder.status && purchaseOrder.status !== 'Draft') {
            return errorResponse(res, 403, 'Only Draft purchase orders can be edited');
        }

        purchaseOrder = await PurchaseOrder.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        ).populate('supplier');

        // Sync to JobCost Logic
        await _syncToJobCost(purchaseOrder, req.user.id);
        return successResponse(res, 200, 'Purchase order updated successfully', purchaseOrder);
    } catch (error) {
        next(error);
    }
};

// @desc    Update purchase order status
// @route   PATCH /api/purchase-orders/:id/status
// @access  Private
exports.updatePurchaseOrderStatus = async (req, res, next) => {
    console.log('API called: updatePurchaseOrderStatus for user:', req.user.id, 'PO ID:', req.params.id);
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    try {
        // Support both direct status and nested payloads
        let status = req.body && req.body.status;
        if (!status && req.body && typeof req.body === 'object') {
            // Check for nested keys or different shapes
            status = Object.values(req.body).find((v) => typeof v === 'string' && ['Draft', 'Ordered', 'Delivered', 'Paid', 'Cancelled', 'Cancelled'].includes(v)) || status;
        }
        if (!status) {
            return errorResponse(res, 400, 'Please provide a status');
        }

        let purchaseOrder = await PurchaseOrder.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!purchaseOrder) {
            return errorResponse(res, 404, 'Purchase order not found');
        }

        purchaseOrder.status = status;
        await purchaseOrder.save();

        await purchaseOrder.populate('supplier');

        // Sync to JobCost Logic
        await _syncToJobCost(purchaseOrder, req.user.id);
        return successResponse(res, 200, 'Status updated successfully', purchaseOrder);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete purchase order
// @route   DELETE /api/purchase-orders/:id
// @access  Private
exports.deletePurchaseOrder = async (req, res, next) => {
    console.log('API called: deletePurchaseOrder for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        const purchaseOrder = await PurchaseOrder.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!purchaseOrder) {
            return errorResponse(res, 404, 'Purchase order not found');
        }

        // Delete invoice image if exists
        if (purchaseOrder.invoiceImagePath) {
            const imagePath = path.join(__dirname, '..', purchaseOrder.invoiceImagePath);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await purchaseOrder.deleteOne();

        // Sync to JobCost Logic
        await _syncToJobCost(purchaseOrder, req.user.id, true);
        return successResponse(res, 200, 'Purchase order deleted successfully', null);
    } catch (error) {
        next(error);
    }
};

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/invoices';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'invoice-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const fileFilter = (req, file, cb) => {
    // Log incoming file info for debugging
    console.log('Incoming file for upload:', file.originalname, 'mimetype:', file.mimetype);

    const allowedExts = ['.jpeg', '.jpg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();

    const mimeOk = !!(file.mimetype && (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf'));
    const extOk = allowedExts.includes(ext);

    console.log('fileFilter check -> ext:', ext, 'extOk:', extOk, 'mimetype:', file.mimetype, 'mimeOk:', mimeOk);

    // Accept if either the extension or the mimetype is acceptable
    if (extOk || mimeOk) {
        return cb(null, true);
    }

    // Don't throw here - signal the controller that upload was rejected
    req.uploadError = 'Only images (JPEG, JPG, PNG) and PDF files are allowed';
    return cb(null, false);
};

exports.upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter,
});

// @desc    Upload invoice image
// @route   POST /api/purchase-orders/:id/invoice-image
// @access  Private
exports.uploadInvoiceImage = async (req, res, next) => {
    console.log('API called: uploadInvoiceImage for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        const purchaseOrder = await PurchaseOrder.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!purchaseOrder) {
            console.log('Purchase order not found for ID:', req.params.id);
            return errorResponse(res, 404, 'Purchase order not found');
        }

        if (!req.file) {
            console.log('No file uploaded in request');
            if (req.uploadError) {
                return errorResponse(res, 400, req.uploadError);
            }
            return errorResponse(res, 400, 'Please upload a file');
        }

        console.log('File uploaded successfully:', req.file.filename, 'Size:', req.file.size);

        // Delete old image if exists
        if (purchaseOrder.invoiceImagePath) {
            const oldImagePath = path.join(__dirname, '..', purchaseOrder.invoiceImagePath);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
                console.log('Deleted old invoice image:', oldImagePath);
            }
        }

        // Update invoice image path
        purchaseOrder.invoiceImagePath = `uploads/invoices/${req.file.filename}`;
        await purchaseOrder.save();
        purchaseOrder.invoiceImagePath = `uploads/invoices/${req.file.filename}`;
        await purchaseOrder.save();
        console.log('Updated purchase order with new invoice path:', purchaseOrder.invoiceImagePath);

        // Sync to JobCost to update the invoice image path there as well
        await _syncToJobCost(purchaseOrder, req.user.id);

        return successResponse(res, 200, 'Invoice image uploaded successfully', {
            invoiceImagePath: purchaseOrder.invoiceImagePath,
        });
    } catch (error) {
        console.error('Error in uploadInvoiceImage:', error);
        next(error);
    }
};

// @desc    Update delivery verification
// @route   PUT /api/purchase-orders/:id/delivery-verification
// @access  Private
exports.updateDeliveryVerification = async (req, res, next) => {
    console.log('API called: updateDeliveryVerification for user:', req.user.id, 'PO ID:', req.params.id);
    try {
        const { deliveryItems } = req.body;

        if (!deliveryItems || !Array.isArray(deliveryItems)) {
            return errorResponse(res, 400, 'Please provide delivery items array');
        }

        const purchaseOrder = await PurchaseOrder.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!purchaseOrder) {
            return errorResponse(res, 404, 'Purchase order not found');
        }

        // Update delivery verification status
        purchaseOrder.deliveryVerification = deliveryItems;
        purchaseOrder.deliveryVerifiedAt = new Date();
        await purchaseOrder.save();

        await purchaseOrder.populate('supplier');

        return successResponse(res, 200, 'Delivery verification updated successfully', purchaseOrder);
    } catch (error) {
        next(error);
    }
};
