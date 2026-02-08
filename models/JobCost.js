const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');

/**
 * 🔥 OPTIMIZED JOB COST MODEL WITH AUTOMATIC DASHBOARD SYNC
 * 
 * This model is optimized for:
 * - Fast queries with compound indexing
 * - Automatic User dashboard counter synchronization
 * - Complex business logic via static methods
 * - Lean queries with virtual field support
 * - Multi-document validation and atomic operations
 */

// Invoice Item subdocument
const InvoiceItemSchema = new mongoose.Schema({
    category: {
        type: String,
        required: false,
        default: 'General',
    },
    name: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 0,
    },
    costPrice: {
        type: Number,
        required: false,
        default: 0,
    },
    unit: {
        type: String,
        default: '',
    },
    sellingPrice: {
        type: Number,
        required: true,
        // min: 0 removed to allow negative values for discounts/adjustments
    },
});

// Virtuals for invoice item
InvoiceItemSchema.virtual('totalCostPrice').get(function () {
    return (this.quantity || 0) * (this.costPrice || 0);
});

InvoiceItemSchema.virtual('totalSellingPrice').get(function () {
    return (this.quantity || 0) * (this.sellingPrice || 0);
});

InvoiceItemSchema.virtual('profit').get(function () {
    const quantity = this.quantity || 0;
    const sellingPrice = this.sellingPrice || 0;
    const costPrice = this.costPrice || 0;
    
    // For deductions (negative selling price like site visits), always calculate profit
    if (sellingPrice < 0) {
        return (sellingPrice - costPrice) * quantity;
    }
    // For regular items, only calculate profit if cost price is available and > 0
    if (costPrice === 0) {
        return 0;
    }
    return (sellingPrice - costPrice) * quantity;
});

// PO Item Cost subdocument
const POItemCostSchema = new mongoose.Schema({
    poId: {
        type: String,
        required: true,
    },
    supplierName: {
        type: String,
        default: '',
    },
    itemName: {
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
        default: '',
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    orderDate: {
        type: Date,
        default: Date.now,
    },
    status: {
        type: String,
        default: 'Draft',
    },
    purchaseOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PurchaseOrder',
    },
    invoiceImagePath: {
        type: String,
        default: '',
    },
});

// Virtual for total cost
POItemCostSchema.virtual('totalCost').get(function () {
    return this.quantity * this.unitCost;
});

// Other Expense subdocument
const OtherExpenseSchema = new mongoose.Schema({
    description: {
        type: String,
        required: false,
        default: '',
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    category: {
        type: String,
        default: 'General',
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

const JobCostSchema = new mongoose.Schema(
    {
        // Unified ID: numeric part of document number (e.g., "010")
        // Unique per user (compound index below)
        documentId: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['quotation', 'invoice'],
            default: 'quotation',
        },
        invoiceId: {
            type: String,
            default: null,
            // Removed unique constraint - multiple JobCosts can have null invoiceId initially
        },
        quotationId: {
            type: String,
            default: '',
        },
        customerName: {
            type: String,
            required: [true, 'Please add a customer name'],
        },
        customerPhone: {
            type: String,
            default: '',
        },
        projectTitle: {
            type: String,
            required: [true, 'Please add a project title'],
        },
        invoiceDate: {
            type: Date,
            required: true,
            default: Date.now,
        },
        invoiceItems: [InvoiceItemSchema],
        purchaseOrderItems: [POItemCostSchema],
        otherExpenses: [OtherExpenseSchema],
        materialCost: {
            type: Number,
            default: 0,
        },
        netProfit: {
            type: Number,
            default: 0,
        },
        completed: {
            type: Boolean,
            default: false,
        },
        customerInvoiceStatus: {
            type: String,
            default: 'pending',
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
        autoIndex: false // 🚨 CRITICAL: Prevents Mongoose from recreating old indexes
    }
);

// Virtual for total revenue
JobCostSchema.virtual('totalRevenue').get(function () {
    try {
        return (this.invoiceItems || []).reduce(
            (sum, item) => sum + (item.quantity || 0) * (item.sellingPrice || 0),
            0
        );
    } catch (error) {
        console.error('❌ Error calculating totalRevenue:', error);
        return 0;
    }
});

// Removed virtual for materialCost as it's now a real field

JobCostSchema.virtual('purchaseOrderCost').get(function () {
    try {
        return (this.purchaseOrderItems || []).reduce(
            (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
            0
        );
    } catch (error) {
        console.error('❌ Error calculating purchaseOrderCost:', error);
        return 0;
    }
});

// Virtual for other expenses cost
JobCostSchema.virtual('otherExpensesCost').get(function () {
    try {
        return (this.otherExpenses || []).reduce((sum, item) => sum + (item.amount || 0), 0);
    } catch (error) {
        console.error('❌ Error calculating otherExpensesCost:', error);
        return 0;
    }
});

// Virtual for total cost (Material Cost + Other Expenses)
JobCostSchema.virtual('totalCost').get(function () {
    return (this.materialCost || 0) + this.otherExpensesCost;
});

// Virtual for profit (Sum of Item Profits - Other Expenses)
// This ensures we don't count revenue as profit for items without cost prices.
JobCostSchema.virtual('profit').get(function () {
    try {
        const totalItemProfit = (this.invoiceItems || []).reduce((sum, item) => sum + (item.profit || 0), 0);
        return totalItemProfit - this.otherExpensesCost;
    } catch (error) {
        console.error('❌ Error calculating profit:', error);
        return 0;
    }
});

// Virtual for profit margin
JobCostSchema.virtual('profitMargin').get(function () {
    return this.totalRevenue > 0 ? (this.profit / this.totalRevenue) * 100 : 0;
});

// Virtual for display document ID with prefix (QUO-010 or INV-010)
JobCostSchema.virtual('displayDocumentId').get(function () {
    const prefix = this.type === 'invoice' ? 'INV' : 'QUO';
    return `${prefix}-${this.documentId}`;
});

// Pre-save middleware to calculate materialCost and netProfit
JobCostSchema.pre('save', function (next) {
    // Calculate total revenue from invoiceItems
    const totalRev = (this.invoiceItems || []).reduce((sum, item) => {
        return sum + (item.quantity || 0) * (item.sellingPrice || 0);
    }, 0);

    // Calculate materialCost from invoiceItems
    this.materialCost = (this.invoiceItems || []).reduce((total, item) => {
        return total + ((item.costPrice || 0) * (item.quantity || 0));
    }, 0);

    const totalOtherExpenses = (this.otherExpenses || []).reduce((total, exp) => {
        return total + (exp.amount || 0);
    }, 0);

    // Calculate Net Profit based on Item Profits
    // This matches the Virtual logic: Uncosted items contribute 0 to profit
    const totalItemProfit = (this.invoiceItems || []).reduce((sum, item) => {
        // Logic duplicated from InvoiceItem.profit virtual for persistence
        if (item.sellingPrice < 0) {
            // Deductions always contribute
            return sum + ((item.sellingPrice - (item.costPrice || 0)) * (item.quantity || 0));
        }
        if ((item.costPrice || 0) <= 0) {
            return sum; // Skip items without valid cost price
        }
        return sum + ((item.sellingPrice - item.costPrice) * (item.quantity || 0));
    }, 0);

    this.netProfit = totalItemProfit - totalOtherExpenses;

    next();
});

// 🔥 PERFORMANCE INDEXES FOR MULTI-TENANT OPTIMIZATION

/**
 * MULTI-TENANT INTEGRITY INDEX (ESSENTIAL)
 * Compound Unique Index: { documentId: 1, user: 1 } with { unique: true }
 * 
 * Purpose: Ensures multi-tenant data integrity for document IDs
 * - Allows different companies to use the same document ID sequence
 * - Prevents the same company from creating duplicate document IDs
 * - Essential for proper tenant isolation in multi-company environment
 */
JobCostSchema.index({ documentId: 1, user: 1 }, { unique: true });

/**
 * DASHBOARD FILTERING PERFORMANCE INDEX
 * Compound Index: { user: 1, completed: 1, invoiceDate: -1 }
 * 
 * Purpose: Optimizes dashboard queries and completion status filtering
 * - Completion status filtering (completed vs pending projects)
 * - Chronological sorting within completion groups
 * - Dashboard performance optimization for project management
 */
JobCostSchema.index({ user: 1, completed: 1, invoiceDate: -1 });

/**
 * QUOTATION LOOKUP INDEX
 * Compound Index: { user: 1, quotationId: 1 }
 * 
 * Purpose: Optimizes quotation-based lookups and relationships
 * - Fast quotation to job cost mapping
 * - Quotation conversion tracking
 * - Integration with QuotationDocument model
 */
JobCostSchema.index({ user: 1, quotationId: 1 });

/**
 * GENERAL LISTING INDEX
 * Compound Index: { user: 1, invoiceDate: -1 }
 * 
 * Purpose: Optimizes default chronological listings
 * - Default view for all job costs
 * - Efficient pagination and sorting
 * - Timeline-based views and reporting
 */
JobCostSchema.index({ user: 1, invoiceDate: -1 });

/**
 * TEXT SEARCH INDEX
 * 
 * Purpose: Enables comprehensive text-based searches
 * - Search across customer names, project titles, document IDs
 * - Supports advanced search functionality in the UI
 * - Efficient full-text search without external search engines
 */
JobCostSchema.index({ 
  customerName: 'text', 
  projectTitle: 'text',
  documentId: 'text',
  quotationId: 'text',
  invoiceId: 'text'
});

// 🔥 AUTOMATIC DASHBOARD SYNCHRONIZATION MIDDLEWARE

/**
 * POST-SAVE HOOK: Automatically increment User dashboard counter
 */
JobCostSchema.post('save', async function(doc) {
  // Only increment counter for new documents (not updates)
  if (this.isNew) {
    try {
      const User = require('./User');
      
      // 🔥 ATOMIC COUNTER INCREMENT: Race-condition safe
      await User.incrementCounter(doc.user, 'totalJobCostsCount', 1);
      
      console.log(`✅ Dashboard sync: Incremented job cost count for user ${doc.user}`.green);
    } catch (error) {
      console.error('❌ Error syncing job cost count on create:', error);
      // Don't throw error to avoid breaking job cost creation
    }
  }
});

/**
 * POST-DELETE HOOK: Automatically decrement User dashboard counter
 */
JobCostSchema.post('deleteOne', { document: true }, async function(doc) {
  try {
    const User = require('./User');
    
    // 🔥 ATOMIC COUNTER DECREMENT: Safe decrement with validation
    const updatedUser = await User.decrementCounter(doc.user, 'totalJobCostsCount', 1);
    
    if (updatedUser) {
      console.log(`✅ Dashboard sync: Decremented job cost count for user ${doc.user}`.green);
    } else {
      console.warn(`⚠️ Could not decrement job cost count for user ${doc.user} - counter may already be at 0`.yellow);
    }
  } catch (error) {
    console.error('❌ Error syncing job cost count on delete:', error);
  }
});

/**
 * POST-FINDONEANDDELETE HOOK: Handle Model.findOneAndDelete() operations
 */
JobCostSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      const User = require('./User');
      
      // 🔥 ATOMIC COUNTER DECREMENT: Safe decrement with validation
      const updatedUser = await User.decrementCounter(doc.user, 'totalJobCostsCount', 1);
      
      if (updatedUser) {
        console.log(`✅ Dashboard sync: Decremented job cost count for user ${doc.user} (findOneAndDelete)`.green);
      } else {
        console.warn(`⚠️ Could not decrement job cost count for user ${doc.user} - counter may already be at 0`.yellow);
      }
    } catch (error) {
      console.error('❌ Error syncing job cost count on findOneAndDelete:', error);
    }
  }
});

// 🔥 STATIC METHODS FOR COMPLEX OPERATIONS

/**
 * Get optimized job costs list with pagination and lean queries
 * @param {String} userId - User ID
 * @param {Object} options - Query options (page, limit, search, completed)
 * @returns {Promise} Paginated job costs
 */
JobCostSchema.statics.getOptimizedList = async function(userId, options = {}) {
  const { 
    page = 1, 
    limit = 15, 
    search, 
    completed 
  } = options;

  let query = { user: new mongoose.Types.ObjectId(userId) };

  // Add search if provided - uses text index for optimal performance
  if (search && typeof search === 'string') {
    query.$text = { $search: search };
  }

  // Add completion status filter - uses compound index { user: 1, completed: 1, invoiceDate: -1 }
  if (completed !== undefined) {
    query.completed = completed === 'true' || completed === true;
  }

  // Execute optimized queries in parallel with lean() for memory efficiency
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [total, jobCosts] = await Promise.all([
    this.countDocuments(query),
    this.find(query)
      .select('documentId type customerName customerPhone projectTitle netProfit materialCost completed createdAt updatedAt quotationId invoiceId invoiceItems purchaseOrderItems otherExpenses customerInvoiceStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean({ virtuals: true }) // 🔥 FIX: Enable virtuals to compute totalRevenue, totalCost, profit, etc.
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));
  const hasMore = parseInt(page) < totalPages;

  return {
    jobCosts: jobCosts || [],
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
 * Complete job with atomic operations and multi-document validation
 * @param {String} jobId - Job Cost ID
 * @param {String} userId - User ID
 * @returns {Promise} Updated job cost or throws error
 */
JobCostSchema.statics.completeJobAtomic = async function(jobId, userId) {
  try {
    // 🔥 OPTIMIZATION: Use lean() for faster initial check
    const jobCost = await this.findOne({
      _id: jobId,
      user: userId,
    }).lean();

    if (!jobCost) {
      throw new Error('Job cost not found');
    }

    if (jobCost.completed) {
      throw new Error('Project is already completed');
    }

    // 1. Data Integrity: Check if all items have a costPrice > 0
    const hasMissingCosts = (jobCost.invoiceItems || []).some(item =>
      item.sellingPrice > 0 && (item.costPrice == null || item.costPrice === 0)
    );
    
    if (hasMissingCosts) {
      throw new Error('All items must have a cost price before completing project');
    }

    // 2. Customer Invoice Status: Use .exists() for faster checks
    if (jobCost.type === 'invoice' && jobCost.invoiceId) {
      const QuotationDocument = require('./QuotationDocument');
      
      // 🔥 OPTIMIZATION: Use .exists() instead of full document fetch
      const invoiceExists = await QuotationDocument.exists({
        documentNumber: jobCost.invoiceId,
        type: 'invoice',
        status: 'paid',
        user: userId,
      });

      if (!invoiceExists) {
        throw new Error('Customer Invoice must be fully paid before completing project');
      }
    } else if (jobCost.type === 'quotation') {
      throw new Error('Job must be converted to Invoice and Paid before completion');
    }

    // 3. PO Status: Use .exists() for efficient PO status checks
    const PurchaseOrder = require('./PurchaseOrder');
    
    // 🔥 OPTIMIZATION: Use .exists() to check for unconfirmed POs
    const hasUnconfirmedPOs = await PurchaseOrder.exists({
      'items.jobId': jobCost.documentId,
      user: userId,
      status: { $nin: ['Invoiced', 'Paid'] }
    });

    if (hasUnconfirmedPOs) {
      throw new Error('All linked Purchase Orders must be Invoiced or Paid before completion');
    }

    // 🔥 OPTIMIZATION: Use atomic update instead of save()
    const updatedJobCost = await this.findOneAndUpdate(
      { _id: jobId, user: userId },
      { $set: { completed: true } },
      { new: true }
    ).lean({ virtuals: true });

    if (!updatedJobCost) {
      throw new Error('Failed to update job cost');
    }

    console.log(`✅ Job completed atomically: ${jobId}`.green);
    return updatedJobCost;
  } catch (error) {
    console.error('❌ Error completing job atomically:', error);
    throw error;
  }
};

/**
 * Upsert job cost - handle find by _id OR documentId logic and creation/update switching
 * @param {String} userId - User ID
 * @param {String} id - Job Cost ID or Document ID
 * @param {Object} data - Job cost data
 * @returns {Promise} Created or updated job cost
 */
JobCostSchema.statics.upsertJobCost = async function(userId, id, data) {
  try {
    let jobCost = await this.findOne({
      _id: id,
      user: userId,
    });

    if (!jobCost) {
      // Try to find by documentId if _id doesn't match
      const documentId = data.documentId;
      if (documentId) {
        jobCost = await this.findOne({
          documentId: documentId,
          user: userId,
        });
      }
    }

    if (jobCost) {
      // Update existing - also update type if invoiceId is provided
      if (data.invoiceId && data.invoiceId.trim() !== '') {
        data.type = 'invoice';
      } else if (data.quotationId && (!data.invoiceId || data.invoiceId.trim() === '')) {
        data.type = 'quotation';
      }

      // Note: materialCost and netProfit will be recalculated automatically by pre-save middleware
      const updatedJobCost = await this.findByIdAndUpdate(jobCost._id, data, {
        new: true,
        runValidators: true,
      }).lean({ virtuals: true });

      console.log(`✅ Job cost updated: ${jobCost._id}`.green);
      return { jobCost: updatedJobCost, isNew: false };
    } else {
      // Create new (upsert)
      data.user = userId;
      if (!data.documentId) {
        throw new Error('documentId is required for new job cost');
      }

      // Set type based on whether invoiceId exists
      if (data.invoiceId && data.invoiceId.trim() !== '') {
        data.type = 'invoice';
      } else {
        data.type = 'quotation';
      }

      const newJobCost = await this.create(data);
      
      console.log(`✅ Job cost created: ${newJobCost._id}`.green);
      return { jobCost: newJobCost, isNew: true };
    }
  } catch (error) {
    console.error('❌ Error upserting job cost:', error);
    throw error;
  }
};

/**
 * Add other expense with atomic operations
 * @param {String} jobCostId - Job Cost ID or Document ID
 * @param {String} userId - User ID
 * @param {Object} expenseData - Expense data
 * @returns {Promise} Added expense
 */
JobCostSchema.statics.addOtherExpenseAtomic = async function(jobCostId, userId, expenseData) {
  try {
    // Validate required fields
    if (!expenseData.amount || isNaN(expenseData.amount) || expenseData.amount <= 0) {
      throw new Error('Valid amount is required for expense');
    }

    let query = {
      $or: [
        { _id: jobCostId, user: userId },
        { documentId: jobCostId, user: userId }
      ]
    };

    const newExpense = {
      description: expenseData.description || '',
      amount: parseFloat(expenseData.amount),
      category: expenseData.category || 'General',
      _id: new mongoose.Types.ObjectId(),
      date: expenseData.date ? new Date(expenseData.date) : new Date(),
    };

    // 🔥 OPTIMIZATION: Use atomic $push operation instead of find + save
    const updatedJobCost = await this.findOneAndUpdate(
      query,
      { $push: { otherExpenses: newExpense } },
      { new: true }
    ).lean({ virtuals: true });

    if (!updatedJobCost) {
      throw new Error('Job cost not found');
    }

    console.log(`✅ Other expense added atomically: ${newExpense._id}`.green);
    return newExpense;
  } catch (error) {
    console.error('❌ Error adding other expense atomically:', error);
    throw error;
  }
};

/**
 * Update other expense with atomic operations
 * @param {String} jobCostId - Job Cost ID or Document ID
 * @param {String} userId - User ID
 * @param {String} expenseId - Expense ID
 * @param {Object} updateData - Update data
 * @returns {Promise} Updated expense
 */
JobCostSchema.statics.updateOtherExpenseAtomic = async function(jobCostId, userId, expenseId, updateData) {
  try {
    let query = {
      $or: [
        { _id: jobCostId, user: userId },
        { documentId: jobCostId, user: userId }
      ],
      'otherExpenses._id': expenseId
    };

    const updateFields = {};
    if (updateData.description !== undefined) updateFields['otherExpenses.$.description'] = updateData.description;
    if (updateData.amount !== undefined) updateFields['otherExpenses.$.amount'] = parseFloat(updateData.amount);
    if (updateData.category !== undefined) updateFields['otherExpenses.$.category'] = updateData.category;
    if (updateData.date !== undefined) updateFields['otherExpenses.$.date'] = new Date(updateData.date);

    // 🔥 OPTIMIZATION: Use atomic $set operation with positional operator
    const updatedJobCost = await this.findOneAndUpdate(
      query,
      { $set: updateFields },
      { new: true }
    ).lean({ virtuals: true });

    if (!updatedJobCost) {
      throw new Error('Job cost or expense not found');
    }

    // Find the updated expense
    const updatedExpense = updatedJobCost.otherExpenses.find(
      expense => expense._id.toString() === expenseId
    );

    console.log(`✅ Other expense updated atomically: ${expenseId}`.green);
    return updatedExpense;
  } catch (error) {
    console.error('❌ Error updating other expense atomically:', error);
    throw error;
  }
};

/**
 * 🔥 ATOMIC ID GENERATION: Create new job cost with atomic document ID generation
 * @param {String} userId - User ID
 * @param {Object} jobCostData - Job cost data
 * @returns {Promise} Created job cost
 */
JobCostSchema.statics.createNewWithAtomicId = async function(userId, jobCostData) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Generate atomic document ID using User model counter if not provided
      let documentId = jobCostData.documentId;
      
      if (!documentId) {
        if (jobCostData.quotationId) {
          documentId = jobCostData.quotationId;
        } else {
          // Generate new document ID using User model counter
          const User = require('./User');
          
          // Get current user to access/create job cost counter
          let user = await User.findById(userId);
          if (!user) {
            throw new Error('User not found');
          }
          
          // Initialize job cost counter if it doesn't exist
          if (typeof user.jobCostCounter === 'undefined') {
            user.jobCostCounter = 0;
          }
          
          // Atomic increment using findByIdAndUpdate
          const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $inc: { jobCostCounter: 1 } },
            { new: true, upsert: false }
          );
          
          if (!updatedUser) {
            throw new Error('Failed to increment job cost counter');
          }
          
          const nextId = updatedUser.jobCostCounter;
          documentId = nextId.toString().padStart(3, '0');
        }
      }

      // Set type based on whether invoiceId exists
      if (jobCostData.invoiceId && jobCostData.invoiceId.trim() !== '') {
        jobCostData.type = 'invoice';
      } else {
        jobCostData.type = 'quotation';
      }

      // Prepare data with generated document ID
      const completeData = {
        ...jobCostData,
        documentId,
        user: userId
      };

      // Create job cost - middleware handles dashboard sync
      const jobCost = await this.create(completeData);
      
      console.log(`✅ Created job cost with atomic document ID: ${documentId}`.green);
      return jobCost;
      
    } catch (error) {
      attempt++;
      
      if (error.code === 11000) {
        // Duplicate key error - retry with new document ID
        console.warn(`⚠️ Duplicate document ID detected, retrying... (attempt ${attempt}/${maxRetries})`.yellow);
        
        if (attempt >= maxRetries) {
          throw new Error(`Failed to create job cost after ${maxRetries} attempts due to document ID collisions`);
        }
        
        // Wait a small random amount before retry to reduce collision probability
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        continue;
      } else {
        // Other error - don't retry
        console.error('❌ Job cost creation failed:', error);
        throw error;
      }
    }
  }
};

/**
 * Delete other expense with atomic operations
 * @param {String} jobCostId - Job Cost ID or Document ID
 * @param {String} userId - User ID
 * @param {String} expenseId - Expense ID
 * @returns {Promise} Success confirmation
 */
JobCostSchema.statics.deleteOtherExpenseAtomic = async function(jobCostId, userId, expenseId) {
  try {
    let query = {
      $or: [
        { _id: jobCostId, user: userId },
        { documentId: jobCostId, user: userId }
      ]
    };

    // 🔥 OPTIMIZATION: Use atomic $pull operation instead of find + splice + save
    const updatedJobCost = await this.findOneAndUpdate(
      query,
      { $pull: { otherExpenses: { _id: expenseId } } },
      { new: true }
    ).lean({ virtuals: true });

    if (!updatedJobCost) {
      throw new Error('Job cost not found');
    }

    console.log(`✅ Other expense deleted atomically: ${expenseId}`.green);
    return true;
  } catch (error) {
    console.error('❌ Error deleting other expense atomically:', error);
    throw error;
  }
};

// --- DASHBOARD STATIC METHODS ---

/**
 * Get dashboard statistics for job costs
 * @param {ObjectId} userId - User ID as ObjectId
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Promise} Dashboard statistics
 */
JobCostSchema.statics.getDashboardStats = async function(userId, start, end) {
    try {
        const result = await this.aggregate([
            // 🚀 CRITICAL: $match with indexes as the very first stage
            { $match: { user: userId, invoiceDate: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: null,
                    profit: { $sum: '$netProfit' },
                    count: { $sum: 1 }
                }
            }
        ]);

        return result[0] || { profit: 0, count: 0 };
    } catch (error) {
        console.error('❌ JobCost.getDashboardStats error:', error);
        throw error;
    }
};

// 🔥 GLOBAL SYSTEM STATISTICS: Static method for Super Admin global job cost stats
JobCostSchema.statics.getGlobalSystemStats = async function() {
    try {
        const startTime = Date.now();
        
        // Multi-tenant security: Explicit aggregation with security checks
        const globalStats = await this.aggregate([
            {
                // Multi-tenant security: Only process job costs from company users
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
                    // Explicit security check - ensure only company job costs
                    $expr: { $eq: [{ $arrayElemAt: ['$userInfo.role', 0] }, 'company'] }
                }
            },
            {
                $group: {
                    _id: null,
                    // Global job cost metrics
                    totalJobCostProfit: { $sum: '$netProfit' },
                    totalJobCostRevenue: { $sum: '$totalInvoiceAmount' },
                    totalJobCostExpenses: { $sum: '$totalPOCost' },
                    totalJobCostCount: { $sum: 1 },
                    // Status breakdown
                    activeJobCosts: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    completedJobCosts: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    onHoldJobCosts: {
                        $sum: { $cond: [{ $eq: ['$status', 'on-hold'] }, 1, 0] }
                    },
                    // Average metrics
                    avgJobCostProfit: { $avg: '$netProfit' },
                    avgJobCostRevenue: { $avg: '$totalInvoiceAmount' },
                    avgProfitMargin: {
                        $avg: {
                            $cond: [
                                { $gt: ['$totalInvoiceAmount', 0] },
                                { 
                                    $multiply: [
                                        { $divide: ['$netProfit', '$totalInvoiceAmount'] },
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
            totalJobCostProfit: 0,
            totalJobCostRevenue: 0,
            totalJobCostExpenses: 0,
            totalJobCostCount: 0,
            activeJobCosts: 0,
            completedJobCosts: 0,
            onHoldJobCosts: 0,
            avgJobCostProfit: 0,
            avgJobCostRevenue: 0,
            avgProfitMargin: 0
        };

        return {
            stats,
            _performance: {
                dbTimeMs: dbTime,
                optimizationNote: 'Global job cost stats with multi-tenant security'
            }
        };
    } catch (error) {
        console.error('❌ JobCost.getGlobalSystemStats error:', error);
        throw error;
    }
};

// Add lean virtuals plugin
JobCostSchema.plugin(mongooseLeanVirtuals);

module.exports = mongoose.model('JobCost', JobCostSchema);
