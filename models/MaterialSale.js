const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');

/**
 * 🔥 OPTIMIZED MATERIAL SALE MODEL WITH AUTOMATIC DASHBOARD SYNC
 * 
 * This model is optimized for:
 * - Fast queries with compound indexing
 * - Automatic User dashboard counter synchronization
 * - Complex business logic via static methods
 * - Lean queries with virtual field support
 */

// Payment Record subdocument (reuse from QuotationDocument)
const PaymentRecordSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    date: {
        type: Date,
        required: true,
        default: Date.now,
    },
    description: {
        type: String,
        default: '',
    },
});

// Material Sale Item subdocument
const MaterialSaleItemSchema = new mongoose.Schema({
    categoryId: {
        type: String,
        default: '',
    },
    categoryName: {
        type: String,
        default: '',
    },
    itemId: {
        type: String,
        default: '',
    },
    category: {
        type: String,
        enum: ['Floor Tile', 'Wall Tile', 'Other'],
        default: 'Floor Tile',
    },
    colorCode: {
        type: String,
        default: '',
    },
    productName: {
        type: String,
        required: true,
    },
    plank: {
        type: Number,
        default: 0,
        min: 0,
    },
    sqftPerPlank: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalSqft: {
        type: Number,
        required: true,
        min: 0,
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    costPerSqft: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalCost: {
        type: Number,
        default: 0,
        min: 0,
    },
});

// Virtual for profit
MaterialSaleItemSchema.virtual('profit').get(function () {
    return this.amount - this.totalCost;
});

// Virtual for profit percentage
MaterialSaleItemSchema.virtual('profitPercentage').get(function () {
    if (this.totalCost > 0) {
        return ((this.amount - this.totalCost) / this.totalCost) * 100;
    }
    return 0;
});

const MaterialSaleSchema = new mongoose.Schema(
    {
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
        },
        saleDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        customerName: {
            type: String,
            required: [true, 'Please add a customer name'],
        },
        customerPhone: {
            type: String,
            default: '',
        },
        customerAddress: {
            type: String,
        },
        paymentTerms: {
            type: Number,
            required: true,
            default: 30,
            min: 1,
        },
        dueDate: {
            type: Date,
            required: true,
        },
        items: [MaterialSaleItemSchema],
        paymentHistory: [PaymentRecordSchema],
        status: {
            type: String,
            enum: ['pending', 'partial', 'paid', 'cancelled'],
            default: 'pending',
        },
        notes: {
            type: String,
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
MaterialSaleSchema.virtual('totalAmount').get(function () {
    return (this.items || []).reduce((sum, item) => sum + item.amount, 0);
});

// Virtual for total cost
MaterialSaleSchema.virtual('totalCost').get(function () {
    return (this.items || []).reduce((sum, item) => sum + item.totalCost, 0);
});

// Virtual for total profit
MaterialSaleSchema.virtual('totalProfit').get(function () {
    return this.totalAmount - this.totalCost;
});

// Virtual for profit percentage
MaterialSaleSchema.virtual('profitPercentage').get(function () {
    if (this.totalCost > 0) {
        return ((this.totalAmount - this.totalCost) / this.totalCost) * 100;
    }
    return 0;
});

// Virtual for total paid
MaterialSaleSchema.virtual('totalPaid').get(function () {
    return (this.paymentHistory || []).reduce((sum, payment) => sum + payment.amount, 0);
});

// Virtual for amount due
MaterialSaleSchema.virtual('amountDue').get(function () {
    return this.totalAmount - this.totalPaid;
});

// 🔥 PERFORMANCE INDEXES FOR MULTI-TENANT OPTIMIZATION

/**
 * MULTI-TENANT INTEGRITY INDEX (ESSENTIAL)
 * Compound Unique Index: { user: 1, invoiceNumber: 1 } with { unique: true }
 * 
 * Purpose: Ensures multi-tenant data integrity for invoice numbers
 * - Allows different companies to use the same invoice number sequence
 * - Prevents the same company from creating duplicate invoice numbers
 * - Essential for proper tenant isolation in multi-company environment
 */
MaterialSaleSchema.index({ user: 1, invoiceNumber: 1 }, { unique: true });

/**
 * COMPREHENSIVE SEARCH & FILTER INDEX
 * Compound Index: { user: 1, customerName: 1, invoiceNumber: 1, saleDate: -1 }
 * 
 * Purpose: Optimizes the most common search and filter patterns
 * - Customer-based searches and filtering
 * - Invoice number lookups
 * - Chronological sorting (newest first)
 * - Supports complex query combinations efficiently
 */
MaterialSaleSchema.index({ user: 1, customerName: 1, invoiceNumber: 1, saleDate: -1 });

/**
 * DASHBOARD FILTERING PERFORMANCE INDEX
 * Compound Index: { user: 1, status: 1, saleDate: -1 }
 * 
 * Purpose: Optimizes dashboard queries and status-based filtering
 * - Status-based filtering (pending, paid, partial, cancelled)
 * - Chronological sorting within status groups
 * - Dashboard performance optimization
 */
MaterialSaleSchema.index({ user: 1, status: 1, saleDate: -1 });

/**
 * GENERAL LISTING INDEX
 * Compound Index: { user: 1, saleDate: -1 }
 * 
 * Purpose: Optimizes default chronological listings
 * - Default view for all material sales
 * - Efficient pagination and sorting
 * - Timeline-based views and reporting
 */
MaterialSaleSchema.index({ user: 1, saleDate: -1 });

/**
 * CREATION DATE INDEX
 * Compound Index: { user: 1, createdAt: -1 }
 * 
 * Purpose: Optimizes recently created material sale queries
 * - "Recently added" material sale listings
 * - Audit trail and activity tracking
 * - Administrative reporting and monitoring
 */
MaterialSaleSchema.index({ user: 1, createdAt: -1 });

/**
 * TEXT SEARCH INDEX
 * 
 * Purpose: Enables comprehensive text-based searches
 * - Search across customer names, invoice numbers, and notes
 * - Supports advanced search functionality in the UI
 * - Efficient full-text search without external search engines
 */
MaterialSaleSchema.index({ 
  customerName: 'text', 
  invoiceNumber: 'text',
  notes: 'text'
});

// 🔥 AUTOMATIC DASHBOARD SYNCHRONIZATION MIDDLEWARE

/**
 * POST-SAVE HOOK: Automatically increment User dashboard counter
 */
MaterialSaleSchema.post('save', async function(doc) {
  // Only increment counter for new documents (not updates)
  if (this.isNew) {
    try {
      const User = require('./User');
      
      // 🔥 ATOMIC COUNTER INCREMENT: Race-condition safe
      await User.incrementCounter(doc.user, 'totalMaterialSalesCount', 1);
      
      console.log(`✅ Dashboard sync: Incremented material sale count for user ${doc.user}`.green);
    } catch (error) {
      console.error('❌ Error syncing material sale count on create:', error);
      // Don't throw error to avoid breaking material sale creation
    }
  }
});

/**
 * POST-DELETE HOOK: Automatically decrement User dashboard counter
 */
MaterialSaleSchema.post('deleteOne', { document: true }, async function(doc) {
  try {
    const User = require('./User');
    
    // 🔥 ATOMIC COUNTER DECREMENT: Safe decrement with validation
    const updatedUser = await User.decrementCounter(doc.user, 'totalMaterialSalesCount', 1);
    
    if (updatedUser) {
      console.log(`✅ Dashboard sync: Decremented material sale count for user ${doc.user}`.green);
    } else {
      console.warn(`⚠️ Could not decrement material sale count for user ${doc.user} - counter may already be at 0`.yellow);
    }
  } catch (error) {
    console.error('❌ Error syncing material sale count on delete:', error);
  }
});

/**
 * POST-FINDONEANDDELETE HOOK: Handle Model.findOneAndDelete() operations
 */
MaterialSaleSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      const User = require('./User');
      
      // 🔥 ATOMIC COUNTER DECREMENT: Safe decrement with validation
      const updatedUser = await User.decrementCounter(doc.user, 'totalMaterialSalesCount', 1);
      
      if (updatedUser) {
        console.log(`✅ Dashboard sync: Decremented material sale count for user ${doc.user} (findOneAndDelete)`.green);
      } else {
        console.warn(`⚠️ Could not decrement material sale count for user ${doc.user} - counter may already be at 0`.yellow);
      }
    } catch (error) {
      console.error('❌ Error syncing material sale count on findOneAndDelete:', error);
    }
  }
});

// 🔥 PRE-SAVE HOOK: Business logic for due date calculation and status determination
MaterialSaleSchema.pre('save', function(next) {
  // Calculate due date if not provided
  if (this.saleDate && this.paymentTerms && !this.dueDate) {
    const saleDate = new Date(this.saleDate);
    const paymentTerms = this.paymentTerms || 30;
    const dueDate = new Date(saleDate.getTime());
    dueDate.setDate(saleDate.getDate() + paymentTerms);
    this.dueDate = dueDate;
  }
  
  // Determine status based on payment history and total amount
  if (this.items && this.items.length > 0) {
    const totalAmount = this.items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalPaid = (this.paymentHistory || []).reduce((sum, payment) => sum + (payment.amount || 0), 0);
    
    if (totalPaid >= totalAmount && totalAmount > 0) {
      this.status = 'paid';
    } else if (totalPaid > 0) {
      this.status = 'partial';
    } else if (this.status !== 'cancelled') {
      this.status = 'pending';
    }
  }
  
  next();
});

// 🔥 STATIC METHODS FOR COMPLEX OPERATIONS

/**
 * 🔥 ATOMIC ID GENERATION: Create new material sale with atomic invoice number generation
 * @param {String} userId - User ID
 * @param {Object} materialSaleData - Material sale data
 * @returns {Promise} Created material sale
 */
MaterialSaleSchema.statics.createNewWithAtomicId = async function(userId, materialSaleData) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Generate atomic invoice number using User model counter
      const User = require('./User');
      
      // Get current user to access/create material sale counter
      let user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Initialize material sale counter if it doesn't exist
      if (typeof user.materialSaleCounter === 'undefined') {
        user.materialSaleCounter = 0;
      }
      
      // Atomic increment using findByIdAndUpdate
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { materialSaleCounter: 1 } },
        { new: true, upsert: false }
      );
      
      if (!updatedUser) {
        throw new Error('Failed to increment material sale counter');
      }
      
      const nextId = updatedUser.materialSaleCounter;
      const invoiceNumber = `MS-${nextId.toString().padStart(4, '0')}`;
      
      // Prepare data with generated invoice number
      const completeData = {
        ...materialSaleData,
        invoiceNumber,
        user: userId
      };
      
      // Create material sale - middleware handles dashboard sync
      const materialSale = await this.create(completeData);
      
      console.log(`✅ Created material sale with atomic invoice number: ${invoiceNumber}`.green);
      return materialSale;
      
    } catch (error) {
      attempt++;
      
      if (error.code === 11000) {
        // Duplicate key error - retry with new invoice number
        console.warn(`⚠️ Duplicate invoice number detected, retrying... (attempt ${attempt}/${maxRetries})`.yellow);
        
        if (attempt >= maxRetries) {
          throw new Error(`Failed to create material sale after ${maxRetries} attempts due to invoice number collisions`);
        }
        
        // Wait a small random amount before retry to reduce collision probability
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        continue;
      } else {
        // Other error - don't retry
        console.error('❌ Material sale creation failed:', error);
        throw error;
      }
    }
  }
};

/**
 * Get optimized material sales list with pagination and lean queries
 * @param {String} userId - User ID
 * @param {Object} options - Query options (page, limit, search, status, startDate, endDate)
 * @returns {Promise} Paginated material sales
 */
MaterialSaleSchema.statics.getOptimizedList = async function(userId, options = {}) {
  const { 
    page = 1, 
    limit = 10, 
    search, 
    status, 
    startDate, 
    endDate 
  } = options;

  let query = { user: new mongoose.Types.ObjectId(userId) };

  // Add search if provided - uses text index for optimal performance
  if (search && typeof search === 'string') {
    query.$text = { $search: search };
  }

  // Add status filter - uses compound index { user: 1, status: 1, saleDate: -1 }
  if (status) {
    query.status = status;
  }

  // Add date range filter
  if (startDate || endDate) {
    query.saleDate = {};
    if (startDate) query.saleDate.$gte = new Date(startDate);
    if (endDate) query.saleDate.$lte = new Date(endDate);
  }

  // Execute optimized queries in parallel with lean() for memory efficiency
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [total, materialSales] = await Promise.all([
    this.countDocuments(query),
    this.find(query)
      .select('invoiceNumber customerName saleDate status paymentTerms dueDate createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean({ virtuals: true }) // 🔥 LEAN VIRTUALS: Memory optimization + virtual fields
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));
  const hasMore = parseInt(page) < totalPages;

  return {
    materialSales: materialSales || [],
    pagination: {
      page: parseInt(page),
      pages: totalPages,
      total: total,
      limit: parseInt(limit),
      hasMore
    }
  };
};

/**
 * Add payment to material sale with atomic operations
 * @param {String} materialSaleId - Material sale ID
 * @param {String} userId - User ID
 * @param {Object} paymentData - Payment data
 * @returns {Promise} Updated material sale
 */
MaterialSaleSchema.statics.addPaymentAtomic = async function(materialSaleId, userId, paymentData) {
  try {
    // Prepare payment record
    const newPayment = {
      ...paymentData,
      date: paymentData.date || new Date(),
      _id: new mongoose.Types.ObjectId()
    };

    // Use atomic $push operation to add payment
    const updatedMaterialSale = await this.findOneAndUpdate(
      { _id: materialSaleId, user: userId },
      { $push: { paymentHistory: newPayment } },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });

    if (!updatedMaterialSale) {
      throw new Error('Material sale not found');
    }

    // Trigger pre-save hook logic for status update by saving the document
    const doc = await this.findById(materialSaleId);
    if (doc) {
      await doc.save(); // This will trigger pre-save hook for status calculation
    }

    // Return the updated document with virtuals
    return await this.findById(materialSaleId).lean({ virtuals: true });
  } catch (error) {
    console.error('❌ Error adding payment atomically:', error);
    throw error;
  }
};

/**
 * Update material sale status with atomic operations
 * @param {String} materialSaleId - Material sale ID
 * @param {String} userId - User ID
 * @param {String} status - New status
 * @returns {Promise} Updated material sale
 */
MaterialSaleSchema.statics.updateStatusAtomic = async function(materialSaleId, userId, status) {
  try {
    // Use atomic $set operation
    const updatedMaterialSale = await this.findOneAndUpdate(
      { _id: materialSaleId, user: userId },
      { $set: { status: status } },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });

    if (!updatedMaterialSale) {
      throw new Error('Material sale not found');
    }

    return updatedMaterialSale;
  } catch (error) {
    console.error('❌ Error updating status atomically:', error);
    throw error;
  }
};

// --- DASHBOARD STATIC METHODS ---

/**
 * Get dashboard statistics for material sales
 * @param {ObjectId} userId - User ID as ObjectId
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Promise} Dashboard statistics
 */
MaterialSaleSchema.statics.getDashboardStats = async function(userId, start, end) {
    try {
        const result = await this.aggregate([
            // 🚀 CRITICAL: $match with indexes as the very first stage
            { $match: { user: userId, saleDate: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: null,
                    revenue: { $sum: '$totalAmount' },
                    profit: { $sum: { $subtract: ['$totalAmount', '$totalCost'] } },
                    outstanding: { $sum: '$amountDue' },
                    count: { $sum: 1 }
                }
            }
        ]);

        return result[0] || { revenue: 0, profit: 0, outstanding: 0, count: 0 };
    } catch (error) {
        console.error('❌ MaterialSale.getDashboardStats error:', error);
        throw error;
    }
};

// 🔥 GLOBAL SYSTEM STATISTICS: Static method for Super Admin global material sales stats
MaterialSaleSchema.statics.getGlobalSystemStats = async function() {
    try {
        const startTime = Date.now();
        
        // Multi-tenant security: Explicit aggregation with security checks
        const globalStats = await this.aggregate([
            {
                // Multi-tenant security: Only process sales from company users
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
                    // Explicit security check - ensure only company sales
                    $expr: { $eq: [{ $arrayElemAt: ['$userInfo.role', 0] }, 'company'] }
                }
            },
            {
                $group: {
                    _id: null,
                    // Global material sales metrics
                    totalMaterialSalesRevenue: { $sum: '$totalAmount' },
                    totalMaterialSalesProfit: { 
                        $sum: { $subtract: ['$totalAmount', '$totalCost'] }
                    },
                    totalMaterialSalesOutstanding: { $sum: '$amountDue' },
                    totalMaterialSalesCount: { $sum: 1 },
                    // Status breakdown
                    paidMaterialSales: {
                        $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
                    },
                    partialMaterialSales: {
                        $sum: { $cond: [{ $eq: ['$status', 'partial'] }, 1, 0] }
                    },
                    pendingMaterialSales: {
                        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                    },
                    // Average metrics
                    avgSaleAmount: { $avg: '$totalAmount' },
                    avgProfitMargin: {
                        $avg: {
                            $cond: [
                                { $gt: ['$totalAmount', 0] },
                                { 
                                    $multiply: [
                                        { $divide: [{ $subtract: ['$totalAmount', '$totalCost'] }, '$totalAmount'] },
                                        100
                                    ]
                                },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const dbTime = Date.now() - startTime;
        
        const stats = globalStats[0] || {
            totalMaterialSalesRevenue: 0,
            totalMaterialSalesProfit: 0,
            totalMaterialSalesOutstanding: 0,
            totalMaterialSalesCount: 0,
            paidMaterialSales: 0,
            partialMaterialSales: 0,
            pendingMaterialSales: 0,
            avgSaleAmount: 0,
            avgProfitMargin: 0
        };

        return {
            stats,
            _performance: {
                dbTimeMs: dbTime,
                optimizationNote: 'Global material sales stats with multi-tenant security'
            }
        };
    } catch (error) {
        console.error('❌ MaterialSale.getGlobalSystemStats error:', error);
        throw error;
    }
};

// Add lean virtuals plugin
MaterialSaleSchema.plugin(mongooseLeanVirtuals);

module.exports = mongoose.model('MaterialSale', MaterialSaleSchema);
