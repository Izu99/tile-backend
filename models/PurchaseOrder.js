const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const { generateSequentialId } = require('../utils/idGenerator');

/**
 * 🔥 OPTIMIZED PURCHASE ORDER MODEL WITH AUTOMATIC SYNC
 * 
 * This model is optimized for:
 * - Automatic ID generation through middleware
 * - Automatic dashboard counter synchronization
 * - Automatic JobCost synchronization with smart price sync
 * - File cleanup on deletion
 */

// PO Item subdocument
const POItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
    },
    unit: {
        type: String,
        required: true,
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0,
    },
});

// Virtual for total amount
POItemSchema.virtual('totalAmount').get(function () {
    return this.quantity * this.unitPrice;
});

const PurchaseOrderSchema = new mongoose.Schema(
    {
        poId: {
            type: String,
            required: false, // Will be auto-generated in pre-save hook if not provided
            // Removed unique: true - now using compound unique index { poId: 1, user: 1 }
        },
        quotationId: {
            type: String,
            default: '',
        },
        customerName: {
            type: String,
            required: [true, 'Please add a customer name'],
        },
        supplier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Supplier',
            required: [true, 'Please add a supplier'],
        },
        orderDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        expectedDelivery: {
            type: Date,
            required: [true, 'Please provide an expected delivery date'],
        },
        status: {
            type: String,
            enum: ['Draft', 'Ordered', 'Delivered', 'Paid', 'Cancelled'],
            default: 'Draft',
        },
        items: [POItemSchema],
        
        // 🔥 FILE UPLOAD FIELDS: Structured image storage
        imageId: {
            type: String, // Generated ObjectId for the file
            default: '',
        },
        imagePath: {
            type: String, // Relative path: purchase_order_images/65b8f...jpg
            default: '',
        },
        originalImageName: {
            type: String, // Original filename for reference
            default: '',
        },
        
        // Legacy field - keep for backward compatibility
        invoiceImagePath: {
            type: String,
        },
        notes: {
            type: String,
        },
        deliveryVerification: {
            type: Array,
            default: [],
        },
        deliveryVerifiedAt: {
            type: Date,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Virtual for total amount
PurchaseOrderSchema.virtual('totalAmount').get(function () {
    if (!this.items || !Array.isArray(this.items) || this.items.length === 0) {
        return 0;
    }

    return this.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
});

// 🔥 PERFORMANCE INDEXES FOR MULTI-TENANT OPTIMIZATION

/**
 * UNIQUE INTEGRITY INDEX (CRUCIAL)
 * Compound Unique Index: { poId: 1, user: 1 } with { unique: true }
 * 
 * Purpose: Ensures multi-tenant data integrity
 * - Allows different companies (users) to use the same PO number sequence (e.g., PO-001)
 * - Prevents the same user from creating duplicate PO numbers
 * - Essential for proper tenant isolation in multi-company environment
 */
PurchaseOrderSchema.index({ poId: 1, user: 1 }, { unique: true });

/**
 * DASHBOARD & LISTING OPTIMIZATION INDEXES
 * These indexes optimize the most common queries in the Flutter app
 */

/**
 * STATUS & DATE FILTER INDEX: { user: 1, status: 1, orderDate: -1 }
 * 
 * Purpose: Optimizes filtered dashboard queries
 * - Most common query: "Show me all 'Ordered' POs, newest first"
 * - Makes status-based filtering with date sorting near-instant
 * - Covers queries like: PurchaseOrder.find({ user: userId, status: 'Ordered' }).sort({ orderDate: -1 })
 */
PurchaseOrderSchema.index({ user: 1, status: 1, orderDate: -1 });

/**
 * GENERAL SORT INDEX: { user: 1, orderDate: -1 }
 * 
 * Purpose: Optimizes default list view
 * - Used for chronological listing of all POs for a user
 * - Covers queries like: PurchaseOrder.find({ user: userId }).sort({ orderDate: -1 })
 * - Essential for pagination performance
 */
PurchaseOrderSchema.index({ user: 1, orderDate: -1 });

/**
 * CROSS-MODEL SYNC OPTIMIZATION INDEXES
 * These indexes optimize middleware operations and cross-model queries
 */

/**
 * JOBCOST LOOKUP INDEX: { quotationId: 1 }
 * 
 * Purpose: Optimizes JobCost synchronization middleware
 * - The syncToJobCost middleware uses this field to find the correct JobCost record
 * - Without this index, every PO save triggers a slow collection scan on JobCost table
 * - Critical for middleware performance at scale
 */
PurchaseOrderSchema.index({ quotationId: 1 });

/**
 * SUPPLIER FILTER INDEX: { user: 1, supplier: 1 }
 * 
 * Purpose: Optimizes supplier-based queries and reports
 * - Essential for generating reports based on specific vendor/supplier
 * - Optimizes queries like: PurchaseOrder.find({ user: userId, supplier: supplierId })
 * - Used in supplier performance analysis and vendor management
 */
PurchaseOrderSchema.index({ user: 1, supplier: 1 });

/**
 * ADDITIONAL PERFORMANCE INDEXES
 * These provide comprehensive query optimization coverage
 */

/**
 * CUSTOMER SEARCH INDEX: { user: 1, customerName: 1 }
 * 
 * Purpose: Optimizes customer-based searches
 * - Used in search functionality and customer-specific PO listings
 * - Supports text-based customer filtering
 */
PurchaseOrderSchema.index({ user: 1, customerName: 1 });

/**
 * COMPOUND SEARCH INDEX: { user: 1, status: 1, supplier: 1, orderDate: -1 }
 * 
 * Purpose: Optimizes complex filtered queries
 * - Supports multi-criteria filtering (status + supplier + date)
 * - Used in advanced reporting and dashboard analytics
 * - Covers the most complex query patterns in the application
 */
PurchaseOrderSchema.index({ user: 1, status: 1, supplier: 1, orderDate: -1 });

/**
 * INDEX DESIGN PRINCIPLES FOLLOWED:
 * 
 * 1. USER-FIRST STRATEGY: All compound indexes start with 'user' field
 *    - Leverages MongoDB's prefix compression
 *    - Enables efficient query partitioning by tenant
 *    - Supports multi-tenant architecture at scale
 * 
 * 2. QUERY PATTERN OPTIMIZATION: Indexes match actual application queries
 *    - Dashboard listing: user + status + orderDate
 *    - Default sorting: user + orderDate
 *    - Cross-model sync: quotationId
 *    - Reporting: user + supplier
 * 
 * 3. CARDINALITY CONSIDERATION: High-to-low cardinality ordering
 *    - user (high cardinality - many users)
 *    - status (medium cardinality - 5 possible values)
 *    - orderDate (high cardinality - unique timestamps)
 * 
 * 4. WRITE PERFORMANCE BALANCE: Sufficient indexes without over-indexing
 *    - Each index serves multiple query patterns
 *    - Minimal impact on write operations
 *    - Maximum impact on read performance
 */

// 🔥 AUTOMATIC ID GENERATION MIDDLEWARE

/**
 * PRE-SAVE HOOK: Generate PO ID if missing
 */
PurchaseOrderSchema.pre('save', async function (next) {
    try {
        // Generate PO ID if not provided
        if (!this.poId && this.isNew) {
            this.poId = await generateSequentialId(this.constructor, 'PO', 'poId');
            console.log(`✅ Generated PO ID: ${this.poId}`.green);
        }
        next();
    } catch (error) {
        console.error('❌ Pre-save hook error:', error);
        next(error);
    }
});

// 🔥 AUTOMATIC DASHBOARD SYNCHRONIZATION MIDDLEWARE

/**
 * POST-SAVE HOOK: Handle dashboard counters and JobCost synchronization
 */
PurchaseOrderSchema.post('save', async function(doc) {
    try {
        // Only increment counter for new documents (not updates)
        if (this.isNew) {
            const User = require('./User');
            
            // 🔥 ATOMIC COUNTER INCREMENT: Race-condition safe
            await User.incrementCounter(doc.user, 'totalPurchaseOrdersCount', 1);
            console.log(`✅ Dashboard sync: Incremented totalPurchaseOrdersCount for user ${doc.user}`.green);
        }

        // 🔥 POPULATE SUPPLIER: Ensure supplier data is available for JobCost sync
        await doc.populate('supplier');

        // 🔥 JOBCOST SYNCHRONIZATION: Always sync on save/update
        await syncToJobCost(doc, doc.user, false);

    } catch (error) {
        console.error('❌ Post-save hook error:', error);
        // Don't throw error to avoid breaking document save
    }
});

/**
 * POST-DELETE HOOK: Automatically decrement dashboard counters and clean up files
 */
PurchaseOrderSchema.post('findOneAndDelete', async function(doc) {
    if (doc) {
        try {
            const User = require('./User');
            
            // 🔥 ATOMIC COUNTER DECREMENT: Safe decrement with validation
            const updatedUser = await User.decrementCounter(doc.user, 'totalPurchaseOrdersCount', 1);
            
            if (updatedUser) {
                console.log(`✅ Dashboard sync: Decremented totalPurchaseOrdersCount for user ${doc.user}`.green);
            } else {
                console.warn(`⚠️ Could not decrement totalPurchaseOrdersCount for user ${doc.user} - counter may already be at 0`.yellow);
            }

            // 🔥 FILE CLEANUP: Delete associated image files
            const { deleteFile } = require('../middleware/upload');
            
            if (doc.imagePath) {
                deleteFile(doc.imagePath);
                console.log(`🗑️ Deleted image file: ${doc.imagePath}`.yellow);
            }
            
            if (doc.invoiceImagePath) {
                deleteFile(doc.invoiceImagePath);
                console.log(`🗑️ Deleted invoice image: ${doc.invoiceImagePath}`.yellow);
            }

            // 🔥 JOBCOST CLEANUP: Remove PO items from JobCost
            await syncToJobCost(doc, doc.user, true);

        } catch (error) {
            console.error('❌ Error in post-delete hook:', error);
        }
    }
});

/**
 * POST-DELETEONE HOOK: Handle document.deleteOne() operations
 */
PurchaseOrderSchema.post('deleteOne', { document: true }, async function(doc) {
    try {
        const User = require('./User');
        
        // 🔥 ATOMIC COUNTER DECREMENT: Safe decrement with validation
        const updatedUser = await User.decrementCounter(doc.user, 'totalPurchaseOrdersCount', 1);
        
        if (updatedUser) {
            console.log(`✅ Dashboard sync: Decremented totalPurchaseOrdersCount for user ${doc.user} (deleteOne)`.green);
        } else {
            console.warn(`⚠️ Could not decrement totalPurchaseOrdersCount for user ${doc.user} - counter may already be at 0`.yellow);
        }

        // 🔥 FILE CLEANUP: Delete associated image files
        const { deleteFile } = require('../middleware/upload');
        
        if (doc.imagePath) {
            deleteFile(doc.imagePath);
            console.log(`🗑️ Deleted image file: ${doc.imagePath}`.yellow);
        }
        
        if (doc.invoiceImagePath) {
            deleteFile(doc.invoiceImagePath);
            console.log(`🗑️ Deleted invoice image: ${doc.invoiceImagePath}`.yellow);
        }

        // 🔥 JOBCOST CLEANUP: Remove PO items from JobCost
        await syncToJobCost(doc, doc.user, true);

    } catch (error) {
        console.error('❌ Error syncing PO count on deleteOne:', error);
    }
});

// 🔥 JOBCOST SYNCHRONIZATION FUNCTION

/**
 * Smart sync PO data to JobCost with price synchronization
 * @param {Object} purchaseOrder - PO document
 * @param {String} userId - User ID
 * @param {Boolean} isDeleted - Whether PO is being deleted
 */
async function syncToJobCost(purchaseOrder, userId, isDeleted = false) {
    if (!purchaseOrder.quotationId) {
        console.log(`ℹ️ No quotationId for PO ${purchaseOrder.poId}. Skipping JobCost sync.`);
        return;
    }

    try {
        const JobCost = require('./JobCost');

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
            console.log(`✅ Removed PO ${purchaseOrder.poId} items from JobCost ${jobCost._id}`.green);
        } else {
            // Update/Add items
            // 1. Remove old items for this PO
            jobCost.purchaseOrderItems = jobCost.purchaseOrderItems.filter(
                item => item.poId !== purchaseOrder.poId
            );

            // 2. Add current items to PO items list
            const poItemCosts = purchaseOrder.items.map(item => ({
                poId: purchaseOrder.poId,
                supplierName: purchaseOrder.supplier?.name || 'Unknown',
                itemName: item.name,
                quantity: item.quantity,
                unit: item.unit || '',
                unitPrice: item.unitPrice,
                orderDate: purchaseOrder.orderDate,
                status: purchaseOrder.status,
                purchaseOrderId: purchaseOrder._id,
                invoiceImagePath: purchaseOrder.invoiceImagePath || purchaseOrder.imagePath || '',
            }));

            if (!jobCost.purchaseOrderItems) jobCost.purchaseOrderItems = [];
            jobCost.purchaseOrderItems.push(...poItemCosts);

            // 3. Smart Price Sync: Update cost prices in invoiceItems
            // ONLY if the PO is NOT in 'Draft' status
            if (purchaseOrder.status !== 'Draft') {
                purchaseOrder.items.forEach(poItem => {
                    const jobCostItem = jobCost.invoiceItems.find(
                        invItem => invItem.name && invItem.name.trim().toLowerCase() === poItem.name.trim().toLowerCase()
                    );

                    if (jobCostItem) {
                        console.log(`🔄 Syncing PO price for ${poItem.name}: ${poItem.unitPrice} (Status: ${purchaseOrder.status})`.cyan);
                        jobCostItem.costPrice = poItem.unitPrice;
                    }
                });
            } else {
                console.log(`ℹ️ PO ${purchaseOrder.poId} is in Draft status. Skipping price sync to item list.`);
            }

            console.log(`✅ Synced PO ${purchaseOrder.poId} to JobCost ${jobCost._id}`.green);
        }

        await jobCost.save();
    } catch (syncError) {
        console.error('❌ Error syncing PO to JobCost:', syncError);
        // Don't throw to avoid failing the main PO operation
    }
}

// 🔥 STATIC METHODS FOR COMPLEX OPERATIONS

/**
 * Update purchase order status with automatic JobCost sync
 * @param {String} poId - Purchase Order document ID
 * @param {String} userId - User ID
 * @param {String} status - New status
 * @returns {Promise} Updated document
 */
PurchaseOrderSchema.statics.updateStatus = async function(poId, userId, status) {
    try {
        // Validate status
        const validStatuses = ['Draft', 'Ordered', 'Delivered', 'Paid', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
        }

        // 🔥 OPTIMIZATION: Use atomic $set operation
        const updatedPurchaseOrder = await this.findOneAndUpdate(
            { _id: poId, user: userId },
            { $set: { status: status } },
            { new: true }
        ).populate('supplier');

        if (!updatedPurchaseOrder) {
            throw new Error('Purchase order not found');
        }

        console.log(`✅ Updated PO ${updatedPurchaseOrder.poId} status to ${status}`.green);
        
        // 🔥 CRITICAL FIX: findOneAndUpdate does NOT trigger post-save middleware
        // Manually trigger JobCost sync after status update
        await syncToJobCost(updatedPurchaseOrder, userId, false);
        console.log(`✅ Manually triggered JobCost sync for PO ${updatedPurchaseOrder.poId}`.green);
        
        return updatedPurchaseOrder;
    } catch (error) {
        console.error('❌ Update status error:', error);
        throw error;
    }
};

/**
 * Update delivery verification with automatic save
 * @param {String} poId - Purchase Order document ID
 * @param {String} userId - User ID
 * @param {Array} deliveryItems - Delivery verification items
 * @returns {Promise} Updated document
 */
PurchaseOrderSchema.statics.updateDeliveryVerification = async function(poId, userId, deliveryItems) {
    try {
        if (!deliveryItems || !Array.isArray(deliveryItems)) {
            throw new Error('Please provide delivery items array');
        }

        const purchaseOrder = await this.findOne({
            _id: poId,
            user: userId,
        });

        if (!purchaseOrder) {
            throw new Error('Purchase order not found');
        }

        // Update delivery verification status
        purchaseOrder.deliveryVerification = deliveryItems;
        purchaseOrder.deliveryVerifiedAt = new Date();
        
        // Save will trigger middleware for JobCost sync
        await purchaseOrder.save();
        await purchaseOrder.populate('supplier');

        console.log(`✅ Updated delivery verification for PO ${purchaseOrder.poId}`.green);
        
        return purchaseOrder;
    } catch (error) {
        console.error('❌ Update delivery verification error:', error);
        throw error;
    }
};

/**
 * Update purchase order image with file cleanup
 * @param {String} poId - Purchase Order document ID
 * @param {String} userId - User ID
 * @param {Object} imageData - New image data from upload
 * @returns {Promise} Updated document
 */
PurchaseOrderSchema.statics.updateImage = async function(poId, userId, imageData) {
    try {
        const purchaseOrder = await this.findOne({
            _id: poId,
            user: userId
        });
        
        if (!purchaseOrder) {
            throw new Error('Purchase order not found');
        }
        
        // Delete old image if it exists
        if (purchaseOrder.imagePath) {
            const { deleteFile } = require('../middleware/upload');
            deleteFile(purchaseOrder.imagePath);
            console.log(`🗑️ Deleted old image: ${purchaseOrder.imagePath}`.yellow);
        }
        
        // Add new image data
        purchaseOrder.imageId = imageData.generatedId;
        purchaseOrder.imagePath = imageData.relativeFilePath;
        purchaseOrder.originalImageName = imageData.originalName;
        purchaseOrder.updatedAt = new Date();
        
        await purchaseOrder.save();
        
        console.log(`✅ Updated image for PO ${purchaseOrder.poId}`.green);
        
        return purchaseOrder;
    } catch (error) {
        console.error('❌ Update image error:', error);
        throw error;
    }
};

/**
 * Update purchase order invoice image with file cleanup (unified logic)
 * @param {String} poId - Purchase Order document ID
 * @param {String} userId - User ID
 * @param {Object} imageData - New image data from upload
 * @returns {Promise} Updated document
 */
PurchaseOrderSchema.statics.updateInvoiceImage = async function(poId, userId, imageData) {
    try {
        const purchaseOrder = await this.findOne({
            _id: poId,
            user: userId
        });
        
        if (!purchaseOrder) {
            throw new Error('Purchase order not found');
        }
        
        // Delete old invoice image if it exists
        if (purchaseOrder.invoiceImagePath) {
            const { deleteFile } = require('../middleware/upload');
            deleteFile(purchaseOrder.invoiceImagePath);
            console.log(`🗑️ Deleted old invoice image: ${purchaseOrder.invoiceImagePath}`.yellow);
        }
        
        // Add new invoice image data
        purchaseOrder.invoiceImagePath = imageData.relativeFilePath;
        purchaseOrder.updatedAt = new Date();
        
        await purchaseOrder.save();
        
        console.log(`✅ Updated invoice image for PO ${purchaseOrder.poId}`.green);
        
        return purchaseOrder;
    } catch (error) {
        console.error('❌ Update invoice image error:', error);
        throw error;
    }
};

// --- DASHBOARD STATIC METHODS ---

/**
 * Get dashboard statistics for purchase orders
 * @param {ObjectId} userId - User ID as ObjectId
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Promise} Dashboard statistics
 */
PurchaseOrderSchema.statics.getDashboardStats = async function(userId, start, end) {
    try {
        const result = await this.aggregate([
            // 🚀 CRITICAL: $match with indexes as the very first stage
            { $match: { user: userId, orderDate: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: null,
                    expenses: { $sum: '$totalAmount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        return result[0] || { expenses: 0, count: 0 };
    } catch (error) {
        console.error('❌ PurchaseOrder.getDashboardStats error:', error);
        throw error;
    }
};

// 🔥 GLOBAL SYSTEM STATISTICS: Static method for Super Admin global purchase order stats
PurchaseOrderSchema.statics.getGlobalSystemStats = async function() {
    try {
        const startTime = Date.now();
        
        // Multi-tenant security: Explicit aggregation with security checks
        const globalStats = await this.aggregate([
            {
                // Multi-tenant security: Only process POs from company users
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            {
                $match: {
                    'userInfo.role': 'company',
                    // Explicit security check - ensure only company POs
                    $expr: { $eq: [{ $arrayElemAt: ['$userInfo.role', 0] }, 'company'] }
                }
            },
            {
                $group: {
                    _id: null,
                    // Global purchase order metrics
                    totalPurchaseOrderValue: { $sum: '$totalAmount' },
                    totalPurchaseOrderCount: { $sum: 1 },
                    // Status breakdown
                    draftPOs: {
                        $sum: { $cond: [{ $eq: ['$status', 'Draft'] }, 1, 0] }
                    },
                    orderedPOs: {
                        $sum: { $cond: [{ $eq: ['$status', 'Ordered'] }, 1, 0] }
                    },
                    deliveredPOs: {
                        $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] }
                    },
                    paidPOs: {
                        $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] }
                    },
                    cancelledPOs: {
                        $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
                    },
                    // Average metrics
                    avgPurchaseOrderValue: { $avg: '$totalAmount' },
                    // Supplier diversity
                    uniqueSuppliers: { $addToSet: '$supplier' }
                }
            },
            {
                $addFields: {
                    supplierCount: { $size: '$uniqueSuppliers' }
                }
            },
            {
                $project: {
                    uniqueSuppliers: 0 // Remove the array, keep only the count
                }
            }
        ]);

        const dbTime = Date.now() - startTime;
        
        const stats = globalStats[0] || {
            totalPurchaseOrderValue: 0,
            totalPurchaseOrderCount: 0,
            draftPOs: 0,
            orderedPOs: 0,
            deliveredPOs: 0,
            paidPOs: 0,
            cancelledPOs: 0,
            avgPurchaseOrderValue: 0,
            supplierCount: 0
        };

        return {
            stats,
            _performance: {
                dbTimeMs: dbTime,
                optimizationNote: 'Global purchase order stats with multi-tenant security'
            }
        };
    } catch (error) {
        console.error('❌ PurchaseOrder.getGlobalSystemStats error:', error);
        throw error;
    }
};

// 🔥 LEAN VIRTUALS PLUGIN: Enable virtuals with .lean() queries
PurchaseOrderSchema.plugin(mongooseLeanVirtuals);

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
