
const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const { generateNumericId } = require('../utils/idGenerator');

/**
 * 🔥 OPTIMIZED QUOTATION DOCUMENT MODEL WITH AUTOMATIC SYNC
 * 
 * This model is optimized for:
 * - Automatic dashboard counter synchronization
 * - Automatic JobCost synchronization for approved quotations
 * - Automatic ID generation through middleware
 * - Smart sync logic preserving existing cost prices
 */

// --- SUBDOCUMENTS ---

// Payment Record subdocument
const PaymentRecordSchema = new mongoose.Schema({
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    description: { type: String, default: '' },
});

// Direct Cost subdocument
const DirectCostSchema = new mongoose.Schema({
    category: {
        type: String,
        required: true,
        enum: ['materials', 'labor', 'equipment', 'subcontractors', 'transportation', 'other'],
    },
    description: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true, default: Date.now },
    vendor: { type: String, default: '' },
});

// Item Description subdocument
const ItemDescriptionSchema = new mongoose.Schema({
    category: { type: String, required: false, default: '' },
    name: { type: String, required: true },
    costPrice: { type: Number, required: false, min: 0 },
    sellingPrice: {
        type: Number,
        required: true,
        validate: {
            validator: function (value) {
                // Allow negative values for site visit related items
                if (this.productName && this.productName.toLowerCase().includes('site visit')) {
                    return true; // Allow any value for site visit items
                }
                // For all other items, ensure non-negative
                return value >= 0;
            },
            message: function (props) {
                if (this.productName && this.productName.toLowerCase().includes('site visit')) {
                    return 'Site visit deduction price is invalid';
                }
                return 'Selling price must be non-negative for regular items';
            }
        }
    },
    unit: { type: String, required: false, default: 'units' },
    categoryId: { type: String, required: false },
    productName: { type: String, required: false },
});

// Invoice Line Item subdocument
const InvoiceLineItemSchema = new mongoose.Schema({
    item: { type: ItemDescriptionSchema, required: true },
    quantity: { type: Number, required: true, min: 0 },
    customDescription: { type: String },
    isOriginalQuotationItem: { type: Boolean, default: true },
});

// --- MAIN SCHEMA ---

const QuotationDocumentSchema = new mongoose.Schema(
    {
        // documentNumber එකේ "QUO-" කෑල්ල නැතුව අංකය විතරක් සේව් කරන්න (උදා: "001")
        // එතකොට අංක පනින්නේ නැතිව පිළිවෙලට තියාගන්න ලේසියි.
        documentNumber: {
            type: String,
            required: false, // Allow empty during creation, pre-save hook will generate
            validate: {
                validator: function(value) {
                    // Allow empty/null during creation (pre-save hook will generate)
                    if (this.isNew && (!value || value.trim() === '')) {
                        return true;
                    }
                    // For existing documents, require non-empty value
                    return value && value.trim().length > 0;
                },
                message: 'Document number is required for existing documents'
            }
        },
        type: {
            type: String,
            enum: ['quotation', 'invoice'],
            default: 'quotation',
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'partial', 'paid', 'converted', 'rejected'],
            default: 'pending',
        },
        customerName: { type: String, required: [true, 'Please add a customer name'] },
        customerPhone: { type: String, default: '' },
        customerAddress: { type: String, default: '' },
        projectTitle: { type: String, default: '' },
        paymentTerms: { type: Number, required: true, default: 30, min: 1 },
        invoiceDate: { type: Date, required: true, default: Date.now },
        dueDate: { type: Date, required: true },

        lineItems: [InvoiceLineItemSchema],
        paymentHistory: [PaymentRecordSchema],
        directCosts: [DirectCostSchema],

        actualCompletionDate: { type: Date },
        projectStatus: {
            type: String,
            enum: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
            default: 'planning',
        },
        // Super admin විසින් ඇඩ් කරන Company එක හෝ User එක
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        linkedSiteVisitId: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// --- VIRTUALS (UI එකට පෙන්වන කොටස්) ---

// 1. Prefix එකත් එක්ක ලස්සනට ID එක පෙන්වන්න (QUO-001 හෝ INV-001)
QuotationDocumentSchema.virtual('displayDocumentNumber').get(function () {
    const prefix = this.type === 'invoice' ? 'INV' : 'QUO';
    return `${prefix}-${this.documentNumber}`;
});

QuotationDocumentSchema.virtual('subtotal').get(function () {
    if (!this.lineItems?.length) return 0;
    return this.lineItems.reduce((sum, item) => sum + (item.quantity * item.item.sellingPrice), 0);
});

QuotationDocumentSchema.virtual('totalPayments').get(function () {
    if (!this.paymentHistory?.length) return 0;
    return this.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
});

QuotationDocumentSchema.virtual('amountDue').get(function () {
    return this.subtotal - this.totalPayments;
});

QuotationDocumentSchema.virtual('netProfit').get(function () {
    const totalCosts = this.directCosts?.reduce((sum, cost) => sum + cost.amount, 0) || 0;
    return this.subtotal - totalCosts;
});

// 🔥 PERFORMANCE INDEXES FOR MULTI-TENANT OPTIMIZATION

/**
 * UNIQUE BUSINESS IDENTITY INDEX (CRITICAL)
 * Compound Unique Index: { documentNumber: 1, type: 1, user: 1 } with { unique: true }
 * 
 * Purpose: Ensures multi-tenant business logic integrity
 * - Allows different companies (users) to have the same document number (e.g., "QUO-001")
 * - Prevents a single company from having duplicate document numbers for the same type
 * - Enforces business logic at the database level for data consistency
 * - Essential for proper tenant isolation in multi-company ERP environment
 * 
 * Examples:
 * ✅ Company A: QUO-001 (quotation) + Company B: QUO-001 (quotation) = ALLOWED
 * ✅ Company A: QUO-001 (quotation) + Company A: INV-001 (invoice) = ALLOWED  
 * ❌ Company A: QUO-001 (quotation) + Company A: QUO-001 (quotation) = BLOCKED
 */
QuotationDocumentSchema.index({ documentNumber: 1, type: 1, user: 1 }, { unique: true });

/**
 * DASHBOARD & FILTERING PERFORMANCE INDEX
 * Compound Index: { user: 1, type: 1, status: 1, invoiceDate: -1 }
 * 
 * Purpose: Optimizes the most frequent dashboard queries
 * - Most common query: "Show me all Pending Quotations for this user, newest first"
 * - Another common query: "Show me all Unpaid Invoices for this user, newest first"
 * - Prevents collection scans and ensures instantaneous results
 * - Critical for dashboard performance as data grows
 * 
 * Query Patterns Optimized:
 * - QuotationDocument.find({ user: userId, type: 'quotation', status: 'pending' }).sort({ invoiceDate: -1 })
 * - QuotationDocument.find({ user: userId, type: 'invoice', status: 'partial' }).sort({ invoiceDate: -1 })
 * - QuotationDocument.find({ user: userId, type: 'quotation' }).sort({ invoiceDate: -1 })
 */
QuotationDocumentSchema.index({ user: 1, type: 1, status: 1, invoiceDate: -1 });

/**
 * SEARCH & UX OPTIMIZATION INDEXES
 * These indexes support fast "search-as-you-type" functionality
 */

/**
 * CUSTOMER SEARCH INDEX: { user: 1, customerName: 1 }
 * 
 * Purpose: Optimizes customer-based searches and filtering
 * - Supports fast customer name searches without database lag
 * - Essential for "search-as-you-type" functionality in Flutter UI
 * - Enables efficient customer-specific document listings
 * 
 * Query Patterns:
 * - QuotationDocument.find({ user: userId, customerName: /pattern/i })
 * - QuotationDocument.find({ user: userId, customerName: 'Exact Customer Name' })
 */
QuotationDocumentSchema.index({ user: 1, customerName: 1 });

/**
 * PROJECT SEARCH INDEX: { user: 1, projectTitle: 1 }
 * 
 * Purpose: Optimizes project-based searches and filtering
 * - Supports fast project title searches for better UX
 * - Enables project-specific document grouping and analysis
 * - Critical for project management and tracking features
 * 
 * Query Patterns:
 * - QuotationDocument.find({ user: userId, projectTitle: /pattern/i })
 * - QuotationDocument.find({ user: userId, projectTitle: 'Specific Project' })
 */
QuotationDocumentSchema.index({ user: 1, projectTitle: 1 });

/**
 * BACKGROUND SYNC OPTIMIZATION INDEX
 * Index: { user: 1, documentNumber: 1 }
 * 
 * Purpose: Critical for JobCost synchronization middleware performance
 * - When a quotation/invoice is updated, system needs to quickly locate the record
 * - Used by middleware to sync prices and data with JobCost documents
 * - Prevents slow lookups during background synchronization processes
 * - Essential for maintaining data consistency across models
 * 
 * Query Patterns:
 * - QuotationDocument.findOne({ user: userId, documentNumber: '001' })
 * - Used internally by JobCost sync middleware for fast document lookups
 */
QuotationDocumentSchema.index({ user: 1, documentNumber: 1 });

/**
 * ADDITIONAL PERFORMANCE INDEXES
 * These provide comprehensive query optimization coverage
 */

/**
 * GENERAL LISTING INDEX: { user: 1, type: 1, invoiceDate: -1 }
 * 
 * Purpose: Optimizes general document listings by type
 * - Default view for quotations or invoices without status filtering
 * - Efficient pagination and sorting for large datasets
 * - Supports type-specific reporting and analytics
 */
QuotationDocumentSchema.index({ user: 1, type: 1, invoiceDate: -1 });

/**
 * PROJECT STATUS TRACKING INDEX: { user: 1, projectStatus: 1, invoiceDate: -1 }
 * 
 * Purpose: Optimizes project management queries
 * - Track projects by status (planning, active, completed, etc.)
 * - Essential for project timeline and progress reporting
 * - Supports project-based dashboard analytics
 */
QuotationDocumentSchema.index({ user: 1, projectStatus: 1, invoiceDate: -1 });

/**
 * CHRONOLOGICAL LISTING INDEX: { user: 1, invoiceDate: -1 }
 * 
 * Purpose: Optimizes default chronological listings
 * - General document listing without specific filters
 * - Efficient pagination for large document sets
 * - Supports timeline-based views and reporting
 */
QuotationDocumentSchema.index({ user: 1, invoiceDate: -1 });

/**
 * CREATION DATE INDEX: { user: 1, createdAt: -1 }
 * 
 * Purpose: Optimizes recently created document queries
 * - "Recently added" document listings
 * - Audit trail and activity tracking
 * - Administrative reporting and monitoring
 */
QuotationDocumentSchema.index({ user: 1, createdAt: -1 });

/**
 * COMPOUND ANALYTICS INDEX: { user: 1, type: 1, status: 1, projectStatus: 1, invoiceDate: -1 }
 * 
 * Purpose: Optimizes complex analytical queries
 * - Advanced reporting with multiple filter criteria
 * - Business intelligence and dashboard analytics
 * - Supports the most complex query patterns in the application
 * 
 * Query Patterns:
 * - Complex filters combining type, status, project status, and date ranges
 * - Advanced reporting queries for business insights
 * - Multi-dimensional data analysis
 */
QuotationDocumentSchema.index({ user: 1, type: 1, status: 1, projectStatus: 1, invoiceDate: -1 });

/**
 * INDEX DESIGN PRINCIPLES FOLLOWED:
 * 
 * 1. USER-FIRST STRATEGY: All compound indexes start with 'user' field
 *    - Leverages MongoDB's prefix compression for memory efficiency
 *    - Enables efficient query partitioning by tenant
 *    - Supports horizontal scaling in multi-tenant architecture
 * 
 * 2. QUERY PATTERN OPTIMIZATION: Indexes match actual application queries
 *    - Dashboard filtering: user + type + status + date
 *    - Search functionality: user + customerName/projectTitle
 *    - Background sync: user + documentNumber
 *    - General listing: user + type + date
 * 
 * 3. CARDINALITY CONSIDERATION: Optimal field ordering
 *    - user (high cardinality - many users)
 *    - type (low cardinality - 2 values: quotation/invoice)
 *    - status (medium cardinality - 6 possible values)
 *    - dates (high cardinality - unique timestamps)
 * 
 * 4. WRITE PERFORMANCE BALANCE: Comprehensive coverage without over-indexing
 *    - Each index serves multiple query patterns
 *    - Strategic index selection for maximum read performance
 *    - Minimal impact on write operations
 * 
 * 5. BUSINESS LOGIC ENFORCEMENT: Database-level constraints
 *    - Unique constraints prevent data inconsistencies
 *    - Multi-tenant isolation at the database level
 *    - Automatic validation of business rules
 */

// 🔥 AUTOMATIC ID GENERATION MIDDLEWARE

/**
 * PRE-SAVE HOOK: Generate document number if missing
 */
QuotationDocumentSchema.pre('save', async function (next) {
    try {
        // Generate document number if not provided or empty
        if ((!this.documentNumber || this.documentNumber.trim() === '') && this.isNew) {
            const numericId = await generateNumericId(
                this.constructor,
                'documentNumber',
                { user: this.user, type: this.type }
            );
            this.documentNumber = String(numericId).padStart(3, '0');
            console.log(`✅ Generated document number: ${this.documentNumber} for type: ${this.type}`.green);
        }

        // Reset 'rejected' status to 'pending' when editing
        if (this.isModified() && this.status === 'rejected' && !this.isNew) {
            this.status = 'pending';
        }

        // Handle date calculations for new documents
        if (this.isNew) {
            // Date handling: Preserve user-selected dates, only calculate if not provided
            if (!this.invoiceDate) {
                this.invoiceDate = new Date();
            }

            // Only calculate dueDate if not provided by user
            if (!this.dueDate && this.invoiceDate) {
                const invoiceDate = new Date(this.invoiceDate);
                const paymentTerms = this.paymentTerms || 30;
                const dueDate = new Date(invoiceDate);
                dueDate.setDate(invoiceDate.getDate() + paymentTerms);
                this.dueDate = dueDate;
            }
        }

        next();
    } catch (error) {
        console.error('❌ Pre-save hook error:', error);
        next(error);
    }
});

/**
 * PRE-FINDONEANDUPDATE HOOK: Handle status changes for atomic updates
 */
QuotationDocumentSchema.pre('findOneAndUpdate', async function(next) {
    try {
        // Get the update data
        const update = this.getUpdate();
        
        // Check if status is being updated to 'approved'
        // Handle both $set and direct update formats
        const newStatus = update.$set?.status || update.status;
        
        if (newStatus === 'approved') {
            // Store the document ID for post-hook processing
            this._statusChangedToApproved = true;
            this._docId = this.getQuery()._id;
            this._userId = this.getQuery().user;
            console.log(`🔔 Pre-hook: Status changing to approved for document ${this._docId}`.yellow);
        }
        
        next();
    } catch (error) {
        console.error('❌ Pre-findOneAndUpdate hook error:', error);
        next(error);
    }
});

/**
 * POST-FINDONEANDUPDATE HOOK: Handle JobCost sync for atomic status updates
 */
QuotationDocumentSchema.post('findOneAndUpdate', async function(doc) {
    try {
        // If status was changed to 'approved' and it's a quotation, sync JobCost
        if (this._statusChangedToApproved && doc && doc.type === 'quotation' && doc.status === 'approved') {
            console.log(`✅ Atomic status update detected: Syncing JobCost for ${doc.displayDocumentNumber}`.green);
            await syncJobCostDocument(doc);
        } else {
            // Debug logging to understand why sync didn't trigger
            if (this._statusChangedToApproved) {
                console.log(`⚠️ Status changed to approved but conditions not met:`.yellow);
                console.log(`   - Document exists: ${!!doc}`);
                console.log(`   - Document type: ${doc?.type}`);
                console.log(`   - Document status: ${doc?.status}`);
            }
        }
    } catch (error) {
        console.error('❌ Post-findOneAndUpdate hook error:', error);
        // Don't throw to avoid breaking the update operation
    }
});

/**
 * POST-SAVE HOOK: Handle dashboard counters and JobCost synchronization
 */
QuotationDocumentSchema.post('save', async function(doc) {
    try {
        // Only increment counter for new documents (not updates)
        if (this.isNew) {
            const User = require('./User');
            const counterField = doc.type === 'invoice' ? 'totalInvoicesCount' : 'totalQuotationsCount';
            
            // 🔥 ATOMIC COUNTER INCREMENT: Race-condition safe
            await User.incrementCounter(doc.user, counterField, 1);
            console.log(`✅ Dashboard sync: Incremented ${counterField} for user ${doc.user}`.green);
        }

        // 🔥 JOBCOST SYNCHRONIZATION: Auto-create/sync JobCost for approved quotations
        if (doc.status === 'approved' && doc.type === 'quotation') {
            await syncJobCostDocument(doc);
        }

        // 🔥 INVOICE CONVERSION: Update JobCost when quotation becomes invoice
        if (doc.type === 'invoice' && this.isModified('type')) {
            await updateJobCostForInvoiceConversion(doc);
        }

    } catch (error) {
        console.error('❌ Post-save hook error:', error);
        // Don't throw error to avoid breaking document save
    }
});

/**
 * POST-DELETE HOOK: Automatically decrement dashboard counters
 */
QuotationDocumentSchema.post('findOneAndDelete', async function(doc) {
    if (doc) {
        try {
            const User = require('./User');
            const counterField = doc.type === 'invoice' ? 'totalInvoicesCount' : 'totalQuotationsCount';
            
            // 🔥 ATOMIC COUNTER DECREMENT: Safe decrement with validation
            const updatedUser = await User.decrementCounter(doc.user, counterField, 1);
            
            if (updatedUser) {
                console.log(`✅ Dashboard sync: Decremented ${counterField} for user ${doc.user}`.green);
            } else {
                console.warn(`⚠️ Could not decrement ${counterField} for user ${doc.user} - counter may already be at 0`.yellow);
            }
        } catch (error) {
            console.error('❌ Error syncing counters on delete:', error);
        }
    }
});

// 🔥 JOBCOST SYNCHRONIZATION FUNCTIONS

/**
 * Smart sync JobCost document for approved quotations
 * Preserves existing cost prices while updating other fields
 */
async function syncJobCostDocument(doc) {
    try {
        const JobCost = require('./JobCost');
        
        const existingJobCost = await JobCost.findOne({
            quotationId: `QUO-${doc.documentNumber}`,
            user: doc.user
        });

        if (!existingJobCost) {
            // Create new JobCost document
            const numericId = doc.documentNumber.replace('QUO-', '');
            const jobCostData = {
                documentId: numericId,
                type: 'quotation',
                quotationId: `QUO-${doc.documentNumber}`,
                invoiceId: null,
                customerName: doc.customerName,
                customerPhone: doc.customerPhone || '',
                projectTitle: doc.projectTitle,
                invoiceDate: doc.invoiceDate,
                invoiceItems: doc.lineItems.map(item => ({
                    category: (item.item && item.item.category) || item.category || 'General',
                    name: (item.item && item.item.name) || item.displayName || 'Unknown Item',
                    quantity: item.quantity || 0,
                    unit: (item.item && item.item.unit) || item.unit || '',
                    costPrice: (item.item && item.item.costPrice) || 0,
                    sellingPrice: (item.item && item.item.sellingPrice) || item.price || 0,
                })),
                purchaseOrderItems: [],
                otherExpenses: [],
                completed: false,
                user: doc.user,
            };

            await JobCost.findOneAndUpdate(
                { documentId: numericId, user: doc.user },
                jobCostData,
                { upsert: true, new: true, runValidators: true }
            );
            
            console.log(`✅ Created new JobCost for quotation QUO-${doc.documentNumber}`.green);
        } else {
            // Smart Sync - Preserve existing cost prices
            const existingItemsMap = new Map();
            if (existingJobCost.invoiceItems?.length > 0) {
                existingJobCost.invoiceItems.forEach(item => {
                    if (item.name) existingItemsMap.set(item.name, item.costPrice || 0);
                });
            }

            const newInvoiceItems = doc.lineItems.map(item => {
                const itemName = (item.item && item.item.name) || item.displayName || 'Unknown Item';
                let costPriceToUse = (item.item && item.item.costPrice) || 0;
                
                // Preserve existing cost price if available
                if (existingItemsMap.has(itemName)) {
                    costPriceToUse = existingItemsMap.get(itemName);
                }
                
                return {
                    category: (item.item && item.item.category) || item.category || 'General',
                    name: itemName,
                    quantity: item.quantity || 0,
                    unit: (item.item && item.item.unit) || item.unit || '',
                    costPrice: costPriceToUse,
                    sellingPrice: (item.item && item.item.sellingPrice) || item.price || 0,
                };
            });

            existingJobCost.invoiceItems = newInvoiceItems;
            existingJobCost.customerName = doc.customerName;
            existingJobCost.projectTitle = doc.projectTitle;
            existingJobCost.customerInvoiceStatus = doc.status;
            await existingJobCost.save();
            
            console.log(`✅ Updated existing JobCost for quotation QUO-${doc.documentNumber}`.green);
        }
    } catch (error) {
        console.error('❌ JobCost sync error:', error);
        // Don't throw to avoid breaking the main operation
    }
}

/**
 * Update JobCost when quotation is converted to invoice
 */
async function updateJobCostForInvoiceConversion(doc) {
    try {
        const JobCost = require('./JobCost');
        
        const originalQuotationId = `QUO-${doc.documentNumber}`;
        const jobCost = await JobCost.findOne({
            quotationId: originalQuotationId,
            user: doc.user
        });

        if (jobCost) {
            jobCost.invoiceId = `INV-${doc.documentNumber}`;
            jobCost.type = 'invoice';
            jobCost.customerInvoiceStatus = doc.status;
            await jobCost.save();
            
            console.log(`✅ Updated JobCost ${jobCost._id} with invoiceId: INV-${doc.documentNumber} and status: ${doc.status}`.green);
        }
    } catch (error) {
        console.error('❌ JobCost invoice conversion error:', error);
        // Don't throw to avoid breaking the main operation
    }
}

// 🔥 STATIC METHODS FOR COMPLEX OPERATIONS

/**
 * Convert quotation to invoice with transaction for data integrity
 * @param {String} quotationId - Quotation document ID
 * @param {String} userId - User ID
 * @param {Object} options - Conversion options (customDueDate, payments)
 * @returns {Promise} Updated document
 */
QuotationDocumentSchema.statics.convertToInvoice = async function(quotationId, userId, options = {}) {
    // 🔥 DATA INTEGRITY: Use MongoDB session/transaction for atomic operations
    const session = await mongoose.startSession();
    
    try {
        let result;
        
        await session.withTransaction(async () => {
            const { customDueDate, payments = [] } = options;
            
            const quotation = await this.findOne({
                _id: quotationId,
                user: userId
            }).session(session);

            if (!quotation) throw new Error('Quotation not found');
            if (quotation.type === 'invoice') throw new Error('Already an invoice');
            if (quotation.status === 'rejected') throw new Error('Rejected quotations cannot be converted to invoices');
            if (quotation.status !== 'approved') throw new Error('Must be approved before conversion');

            // 📅 DATE UPDATES FOR CONVERSION
            const currentDate = new Date();
            quotation.invoiceDate = currentDate;

            // Due Date: Recalculate based on new invoice date + payment terms
            if (!customDueDate) {
                const paymentTerms = quotation.paymentTerms || 30;
                const dueDate = new Date(currentDate);
                dueDate.setDate(currentDate.getDate() + paymentTerms);
                quotation.dueDate = dueDate;
            } else {
                quotation.dueDate = new Date(customDueDate);
            }

            // Type conversion
            quotation.type = 'invoice';

            // 💰 Payment Logic
            if (payments.length > 0) {
                quotation.paymentHistory.push(...payments);

                const totalPaid = quotation.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
                const subtotal = quotation.lineItems.reduce((sum, item) => sum + (item.quantity * item.item.sellingPrice), 0);

                quotation.status = totalPaid >= subtotal ? 'paid' : 'partial';
            } else {
                quotation.status = 'converted';
            }

            // Save within transaction
            await quotation.save({ session });
            
            // 🔥 TRANSACTION SAFETY: Update dashboard counters atomically
            const User = require('./User');
            
            // Decrement quotation count and increment invoice count atomically
            await User.findByIdAndUpdate(
                userId,
                {
                    $inc: {
                        totalQuotationsCount: -1,
                        totalInvoicesCount: 1
                    }
                },
                { session }
            );
            
            console.log(`✅ Transaction: Converted quotation to invoice ${quotation.displayDocumentNumber}`.green);
            result = quotation;
        }, {
            // 🔥 TRANSACTION OPTIONS: Ensure primary read preference for transactions
            readPreference: 'primary',
            readConcern: { level: 'majority' },
            writeConcern: { w: 'majority' }
        });
        
        return result;
    } catch (error) {
        console.error('❌ Convert to invoice transaction error:', error);
        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * Add payment to invoice with automatic status calculation
 * @param {String} invoiceId - Invoice document ID
 * @param {String} userId - User ID
 * @param {Object} paymentData - Payment information
 * @returns {Promise} Updated document
 */
QuotationDocumentSchema.statics.addPayment = async function(invoiceId, userId, paymentData) {
    try {
        const doc = await this.findOne({
            _id: invoiceId,
            user: userId,
            type: 'invoice'
        });

        if (!doc) throw new Error('Invoice not found');

        // Add new payment
        const newPayment = {
            ...paymentData,
            date: paymentData.date || new Date(),
            _id: new mongoose.Types.ObjectId()
        };

        doc.paymentHistory.push(newPayment);

        // Calculate new status
        const totalPaid = doc.paymentHistory.reduce((sum, p) => sum + (p.amount || 0), 0);
        const subtotal = doc.lineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.item?.sellingPrice || 0)), 0);

        doc.status = totalPaid >= subtotal ? 'paid' : 'partial';

        await doc.save();

        // Update linked JobCost status
        const JobCost = require('./JobCost');
        await JobCost.findOneAndUpdate(
            {
                $or: [
                    { invoiceId: `INV-${doc.documentNumber}` },
                    { quotationId: `QUO-${doc.documentNumber}` }
                ],
                user: doc.user
            },
            { $set: { customerInvoiceStatus: doc.status } }
        );

        return doc;
    } catch (error) {
        console.error('❌ Add payment error:', error);
        throw error;
    }
};

// --- REPORT STATIC METHODS ---

/**
 * Get project report data with optimized aggregation
 * @param {string} userId - User ID
 * @param {object} options - Query options (page, limit, filters)
 * @returns {Promise} Project report data with pagination
 */
QuotationDocumentSchema.statics.getProjectReportOptimized = async function(userId, options = {}) {
    const startTime = Date.now();
    const { page = 1, limit = 15, status, type, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    try {
        // Build query
        const query = { user: new mongoose.Types.ObjectId(userId) };
        
        if (status) query.projectStatus = status;
        if (type) query.type = type;
        if (startDate || endDate) {
            query.invoiceDate = {};
            if (startDate) query.invoiceDate.$gte = new Date(startDate);
            if (endDate) query.invoiceDate.$lte = new Date(endDate);
        }

        // Parallel execution for data and count
        const [projects, total] = await Promise.all([
            this.find(query)
                .sort({ invoiceDate: -1 })
                .skip(skip)
                .limit(limit)
                .select('documentNumber type status customerName projectTitle invoiceDate dueDate actualCompletionDate projectStatus lineItems directCosts paymentHistory subtotal netProfit profitMargin completionDate')
                .lean(),
            this.countDocuments(query)
        ]);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Project Report Query: ${dbTime}ms (${projects.length}/${total} projects, page ${page})`.cyan);

        // 🔥 CRITICAL FIX: Fetch JobCost data for direct cost calculation
        const JobCost = require('./JobCost');
        const quotationIds = projects.map(p => `QUO-${p.documentNumber}`);
        
        // Fetch all JobCost documents for these quotations
        const jobCosts = await JobCost.find({
            quotationId: { $in: quotationIds },
            user: userId
        })
        .select('quotationId materialCost purchaseOrderCost otherExpensesCost')
        .lean({ virtuals: true }); // Enable virtuals for purchaseOrderCost
        
        // Create a map for quick lookup
        const jobCostMap = new Map();
        jobCosts.forEach(jc => {
            jobCostMap.set(jc.quotationId, jc);
        });
        
        console.log(`📊 Fetched ${jobCosts.length} JobCost records for cost calculation`.cyan);

        // Format data for frontend reports
        const formattedProjects = projects.map(project => {
            // Calculate income from subtotal or lineItems
            // subtotal is a virtual field that calculates: quantity * item.sellingPrice
            const income = project.subtotal || 
                (project.lineItems || []).reduce((sum, item) => {
                    const quantity = item.quantity || 0;
                    const sellingPrice = item.item?.sellingPrice || 0;
                    return sum + (quantity * sellingPrice);
                }, 0);
            
            // 🔥 CRITICAL FIX: Get direct cost from JobCost collection
            const quotationId = `QUO-${project.documentNumber}`;
            const jobCost = jobCostMap.get(quotationId);
            
            let directCost = 0;
            if (jobCost) {
                // Calculate total direct cost from JobCost
                directCost = (jobCost.materialCost || 0) + 
                            (jobCost.purchaseOrderCost || 0) + 
                            (jobCost.otherExpensesCost || 0);
                console.log(`   ${quotationId}: Material=${jobCost.materialCost}, PO=${jobCost.purchaseOrderCost}, Other=${jobCost.otherExpensesCost}, Total=${directCost}`.gray);
            } else {
                // Fallback: Try to get from QuotationDocument.directCosts (legacy)
                directCost = (project.directCosts || []).reduce((sum, cost) => sum + (cost.amount || 0), 0);
                if (directCost === 0) {
                    console.log(`   ${quotationId}: No JobCost found, directCost = 0`.yellow);
                }
            }
            
            // Calculate net profit
            const netProfit = income - directCost;
            
            // Calculate margin with division by zero protection
            const margin = income > 0 ? (netProfit / income) * 100 : 0;
            
            // Determine project status based on type and document status
            let projectStatus = 'Pending';
            if (project.type === 'quotation') {
                // Quotation statuses
                if (project.status === 'approved') {
                    projectStatus = 'Approved';
                } else {
                    projectStatus = 'Pending';
                }
            } else if (project.type === 'invoice') {
                // Invoice statuses
                const totalPaid = (project.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
                if (project.status === 'paid' || totalPaid >= income) {
                    projectStatus = 'Paid';
                } else if (project.status === 'partial' || (totalPaid > 0 && totalPaid < income)) {
                    projectStatus = 'Partial';
                } else if (project.status === 'converted') {
                    projectStatus = 'Converted';
                } else {
                    projectStatus = 'Pending';
                }
            }
            
            return {
                projectId: project.documentNumber,
                projectName: project.projectTitle || `${project.customerName} - ${project.documentNumber}`,
                clientName: project.customerName,
                status: projectStatus,
                income: income,
                directCost: directCost,
                netProfit: netProfit,
                margin: margin,
                completionDate: project.completionDate,
                invoiceDate: project.invoiceDate,
                type: project.type,
                documentStatus: project.status,
            };
        });
        
        // Debug: Log first project data
        if (formattedProjects.length > 0) {
            console.log('📊 First Project Data:'.yellow);
            console.log(`   ID: ${formattedProjects[0].projectId}`);
            console.log(`   Name: ${formattedProjects[0].projectName}`);
            console.log(`   Income: ${formattedProjects[0].income}`);
            console.log(`   Direct Cost: ${formattedProjects[0].directCost}`);
            console.log(`   Net Profit: ${formattedProjects[0].netProfit}`);
            console.log(`   Margin: ${formattedProjects[0].margin}%`);
        }

        return {
            projects: formattedProjects,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasMore: page < Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error('❌ getProjectReportOptimized error:', error);
        throw error;
    }
};

/**
 * Get invoice report data with optimized aggregation
 * @param {string} userId - User ID
 * @param {object} options - Query options (page, limit, filters)
 * @returns {Promise} Invoice report data with pagination
 */
QuotationDocumentSchema.statics.getInvoiceReportOptimized = async function(userId, options = {}) {
    const startTime = Date.now();
    const { page = 1, limit = 15, status, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    try {
        // Build query for invoices only
        const query = {
            user: new mongoose.Types.ObjectId(userId),
            type: 'invoice'
        };
        
        if (status) query.status = status;
        if (startDate || endDate) {
            query.invoiceDate = {};
            if (startDate) query.invoiceDate.$gte = new Date(startDate);
            if (endDate) query.invoiceDate.$lte = new Date(endDate);
        }

        // Parallel execution for data and count
        const [invoices, total] = await Promise.all([
            this.find(query)
                .sort({ invoiceDate: -1 })
                .skip(skip)
                .limit(limit)
                .select('documentNumber invoiceDate customerName customerPhone subtotal totalPayments amountDue status')
                .lean(),
            this.countDocuments(query)
        ]);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Invoice Report Query: ${dbTime}ms (${invoices.length}/${total} invoices, page ${page})`.cyan);

        // Format data for frontend reports
        const formattedInvoices = invoices.map(invoice => ({
            invoiceNo: invoice.documentNumber,
            date: invoice.invoiceDate,
            customerName: invoice.customerName,
            customerPhone: invoice.customerPhone,
            totalAmount: invoice.subtotal,
            paidAmount: invoice.totalPayments,
            dueAmount: invoice.amountDue,
            status: invoice.status,
        }));

        return {
            invoices: formattedInvoices,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasMore: page < Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error('❌ getInvoiceReportOptimized error:', error);
        throw error;
    }
};

/**
 * Get dashboard summary with single aggregation pipeline
 * @param {string} userId - User ID
 * @returns {Promise} Dashboard summary data
 */
QuotationDocumentSchema.statics.getDashboardSummaryOptimized = async function(userId) {
    const startTime = Date.now();
    
    try {
        const userObjectId = new mongoose.Types.ObjectId(userId);
        
        // Calculate current month date range
        const now = new Date();
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Single aggregation pipeline
        const result = await this.aggregate([
            { $match: { user: userObjectId } },
            {
                $facet: {
                    counts: [
                        {
                            $group: {
                                _id: null,
                                totalQuotations: { $sum: { $cond: [{ $eq: ['$type', 'quotation'] }, 1, 0] } },
                                totalInvoices: { $sum: { $cond: [{ $eq: ['$type', 'invoice'] }, 1, 0] } },
                                pendingQuotations: { 
                                    $sum: { 
                                        $cond: [
                                            { $and: [{ $eq: ['$type', 'quotation'] }, { $eq: ['$status', 'pending'] }] }, 
                                            1, 0
                                        ] 
                                    } 
                                },
                                approvedQuotations: { 
                                    $sum: { 
                                        $cond: [
                                            { $and: [{ $eq: ['$type', 'quotation'] }, { $eq: ['$status', 'approved'] }] }, 
                                            1, 0
                                        ] 
                                    } 
                                },
                                paidInvoices: { 
                                    $sum: { 
                                        $cond: [
                                            { $and: [{ $eq: ['$type', 'invoice'] }, { $eq: ['$status', 'paid'] }] }, 
                                            1, 0
                                        ] 
                                    } 
                                },
                                pendingInvoices: { 
                                    $sum: { 
                                        $cond: [
                                            { 
                                                $and: [
                                                    { $eq: ['$type', 'invoice'] }, 
                                                    { $in: ['$status', ['pending', 'partial']] }
                                                ] 
                                            }, 
                                            1, 0
                                        ] 
                                    } 
                                }
                            }
                        }
                    ],
                    financials: [
                        {
                            $group: {
                                _id: null,
                                totalRevenue: { 
                                    $sum: { 
                                        $cond: [{ $eq: ['$type', 'invoice'] }, '$subtotal', 0] 
                                    } 
                                },
                                totalCosts: {
                                    $sum: {
                                        $reduce: {
                                            input: { $ifNull: ['$directCosts', []] },
                                            initialValue: 0,
                                            in: { $add: ['$value', { $ifNull: ['$this.amount', 0] }] }
                                        }
                                    }
                                },
                                monthlyRevenue: {
                                    $sum: {
                                        $cond: [
                                            {
                                                $and: [
                                                    { $eq: ['$type', 'invoice'] },
                                                    { $gte: ['$invoiceDate', currentMonthStart] },
                                                    { $lt: ['$invoiceDate', currentMonthEnd] }
                                                ]
                                            },
                                            '$subtotal', 0
                                        ]
                                    }
                                }
                            }
                        }
                    ]
                }
            }
        ]);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Dashboard Summary: ${dbTime}ms (single $facet aggregation)`.cyan);

        // Extract results
        const counts = result[0]?.counts?.[0] || {};
        const financials = result[0]?.financials?.[0] || {};

        const totalRevenue = financials.totalRevenue || 0;
        const totalCosts = financials.totalCosts || 0;
        const netProfit = totalRevenue - totalCosts;

        return {
            quotations: {
                total: counts.totalQuotations || 0,
                pending: counts.pendingQuotations || 0,
                approved: counts.approvedQuotations || 0,
            },
            invoices: {
                total: counts.totalInvoices || 0,
                paid: counts.paidInvoices || 0,
                pending: counts.pendingInvoices || 0,
            },
            financial: {
                totalRevenue,
                totalCosts,
                monthlyRevenue: financials.monthlyRevenue || 0,
                netProfit,
            },
            _performance: {
                dbTimeMs: dbTime,
                totalTimeMs: Date.now() - startTime,
                optimizationNote: 'Single $facet aggregation replaced 9 separate database calls'
            }
        };
    } catch (error) {
        console.error('❌ getDashboardSummaryOptimized error:', error);
        throw error;
    }
};

/**
 * Add direct cost to a project atomically
 * @param {string} documentId - Document ID
 * @param {string} userId - User ID
 * @param {object} costData - Cost data
 * @returns {Promise} Updated document
 */
QuotationDocumentSchema.statics.addDirectCostAtomic = async function(documentId, userId, costData) {
    const startTime = Date.now();
    
    try {
        const newCost = {
            ...costData,
            _id: new mongoose.Types.ObjectId()
        };

        const updatedDocument = await this.findOneAndUpdate(
            { _id: documentId, user: userId },
            { $push: { directCosts: newCost } },
            { new: true, lean: true }
        );

        if (!updatedDocument) {
            throw new Error('Document not found');
        }

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Add Direct Cost: ${dbTime}ms (Document: ${documentId})`.cyan);

        return updatedDocument;
    } catch (error) {
        console.error('❌ addDirectCostAtomic error:', error);
        throw error;
    }
};

/**
 * Get material sales report data (placeholder implementation)
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {Promise} Material sales report data
 */
QuotationDocumentSchema.statics.getMaterialSalesReportOptimized = async function(userId, options = {}) {
    const startTime = Date.now();
    const { page = 1, limit = 15, status, startDate, endDate } = options;
    const skip = (page - 1) * limit;

    try {
        // For now, using quotations as material sales placeholder
        const query = {
            user: new mongoose.Types.ObjectId(userId),
            type: 'quotation'
        };
        
        if (status) query.status = status;
        if (startDate || endDate) {
            query.invoiceDate = {};
            if (startDate) query.invoiceDate.$gte = new Date(startDate);
            if (endDate) query.invoiceDate.$lte = new Date(endDate);
        }

        const [materialSales, total] = await Promise.all([
            this.find(query)
                .sort({ invoiceDate: -1 })
                .skip(skip)
                .limit(limit)
                .select('documentNumber invoiceDate customerName customerPhone lineItems paymentHistory subtotal totalPayments amountDue status')
                .lean(),
            this.countDocuments(query)
        ]);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Material Sales Report Query: ${dbTime}ms (${materialSales.length}/${total} sales, page ${page})`.cyan);

        // Format data for frontend material sales reports
        const formattedSales = materialSales.map(sale => ({
            invoiceNo: sale.documentNumber,
            date: sale.invoiceDate,
            customerName: sale.customerName,
            customerPhone: sale.customerPhone,
            totalAmount: sale.subtotal,
            paidAmount: sale.totalPayments,
            dueAmount: sale.amountDue,
            status: sale.status,
            totalSqft: 0, // Calculate based on items if needed
            totalPlanks: 0, // Calculate based on items if needed
            profitPercentage: 0, // Calculate based on cost vs selling price
        }));

        return {
            materialSales: formattedSales,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasMore: page < Math.ceil(total / limit)
            }
        };
    } catch (error) {
        console.error('❌ getMaterialSalesReportOptimized error:', error);
        throw error;
    }
};

/**
 * Update project status atomically
 * @param {string} documentId - Document ID
 * @param {string} userId - User ID
 * @param {object} updateData - Update data
 * @returns {Promise} Updated document
 */
QuotationDocumentSchema.statics.updateProjectStatusAtomic = async function(documentId, userId, updateData) {
    const startTime = Date.now();
    
    try {
        const updatedDocument = await this.findOneAndUpdate(
            { _id: documentId, user: userId },
            { $set: updateData },
            { new: true, runValidators: true, lean: true }
        );

        if (!updatedDocument) {
            throw new Error('Document not found');
        }

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Update Project Status: ${dbTime}ms (Document: ${documentId})`.cyan);

        return updatedDocument;
    } catch (error) {
        console.error('❌ updateProjectStatusAtomic error:', error);
        throw error;
    }
};

// --- DASHBOARD STATIC METHODS ---

/**
 * Get dashboard statistics for quotations and invoices
 * @param {ObjectId} userId - User ID as ObjectId
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Promise} Dashboard statistics
 */
QuotationDocumentSchema.statics.getDashboardStats = async function(userId, start, end) {
    try {
        const result = await this.aggregate([
            // 🚀 CRITICAL: $match with indexes as the very first stage
            { $match: { user: userId, invoiceDate: { $gte: start, $lte: end } } },
            {
                $facet: {
                    // Invoice revenue and outstanding calculations
                    invoiceStats: [
                        { $match: { type: 'invoice' } },
                        {
                            $group: {
                                _id: null,
                                invoiceRevenue: { $sum: '$subtotal' },
                                invoiceCount: { $sum: 1 },
                                totalPayments: { $sum: '$totalPayments' },
                                outstandingInvoices: { $sum: '$amountDue' }
                            }
                        }
                    ],
                    // Active projects count
                    projectStats: [
                        { $match: { status: { $in: ['pending', 'approved'] } } },
                        { $count: 'activeProjects' }
                    ],
                    // Total quotation count
                    quotationStats: [
                        { $match: { type: 'quotation' } },
                        { $count: 'quotationCount' }
                    ]
                }
            }
        ]);

        const stats = result[0] || {};
        const invoice = stats.invoiceStats?.[0] || {};
        const project = stats.projectStats?.[0] || {};
        const quotation = stats.quotationStats?.[0] || {};

        return {
            invoiceRevenue: invoice.invoiceRevenue || 0,
            outstandingInvoices: invoice.outstandingInvoices || 0,
            activeProjects: project.activeProjects || 0,
            quotationCount: quotation.quotationCount || 0,
            invoiceCount: invoice.invoiceCount || 0
        };
    } catch (error) {
        console.error('❌ QuotationDocument.getDashboardStats error:', error);
        throw error;
    }
};

// 🔥 GLOBAL SYSTEM STATISTICS: Static method for Super Admin global revenue/project stats
QuotationDocumentSchema.statics.getGlobalSystemStats = async function() {
    try {
        const startTime = Date.now();
        
        // Multi-tenant security: Explicit aggregation with security checks
        const globalStats = await this.aggregate([
            {
                // Multi-tenant security: Only process documents from company users
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
                    // Explicit security check - ensure only company documents
                    $expr: { $eq: [{ $arrayElemAt: ['$userInfo.role', 0] }, 'company'] }
                }
            },
            {
                $group: {
                    _id: null,
                    // Global revenue metrics
                    totalRevenue: {
                        $sum: {
                            $cond: [
                                { $eq: ['$type', 'invoice'] },
                                { $sum: { $map: { input: '$lineItems', as: 'item', in: { $multiply: ['$$item.quantity', '$$item.item.sellingPrice'] } } } },
                                0
                            ]
                        }
                    },
                    totalOutstanding: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$type', 'invoice'] }, { $in: ['$status', ['pending', 'partial']] }] },
                                {
                                    $subtract: [
                                        { $sum: { $map: { input: '$lineItems', as: 'item', in: { $multiply: ['$$item.quantity', '$$item.item.sellingPrice'] } } } },
                                        { $sum: '$paymentHistory.amount' }
                                    ]
                                },
                                0
                            ]
                        }
                    },
                    // Global project metrics
                    activeProjects: {
                        $sum: {
                            $cond: [
                                { $in: ['$projectStatus', ['planning', 'active']] },
                                1,
                                0
                            ]
                        }
                    },
                    totalProjects: { $sum: 1 },
                    // Document type counts
                    totalQuotations: {
                        $sum: { $cond: [{ $eq: ['$type', 'quotation'] }, 1, 0] }
                    },
                    totalInvoices: {
                        $sum: { $cond: [{ $eq: ['$type', 'invoice'] }, 1, 0] }
                    },
                    // Status breakdown
                    pendingQuotations: {
                        $sum: { 
                            $cond: [
                                { $and: [{ $eq: ['$type', 'quotation'] }, { $eq: ['$status', 'pending'] }] },
                                1,
                                0
                            ]
                        }
                    },
                    approvedQuotations: {
                        $sum: { 
                            $cond: [
                                { $and: [{ $eq: ['$type', 'quotation'] }, { $eq: ['$status', 'approved'] }] },
                                1,
                                0
                            ]
                        }
                    },
                    paidInvoices: {
                        $sum: { 
                            $cond: [
                                { $and: [{ $eq: ['$type', 'invoice'] }, { $eq: ['$status', 'paid'] }] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const dbTime = Date.now() - startTime;
        
        const stats = globalStats[0] || {
            totalRevenue: 0,
            totalOutstanding: 0,
            activeProjects: 0,
            totalProjects: 0,
            totalQuotations: 0,
            totalInvoices: 0,
            pendingQuotations: 0,
            approvedQuotations: 0,
            paidInvoices: 0
        };

        return {
            stats,
            _performance: {
                dbTimeMs: dbTime,
                optimizationNote: 'Global quotation/invoice stats with multi-tenant security'
            }
        };
    } catch (error) {
        console.error('❌ QuotationDocument.getGlobalSystemStats error:', error);
        throw error;
    }
};

// 🔥 GLOBAL REVENUE TRENDS: Static method for platform-wide revenue analytics
QuotationDocumentSchema.statics.getGlobalRevenueTrends = async function(startDate, endDate) {
    try {
        const startTime = Date.now();
        
        // Multi-tenant security: Explicit aggregation with security checks
        const revenueTrends = await this.aggregate([
            {
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
                    type: 'invoice',
                    invoiceDate: { $gte: startDate, $lte: endDate },
                    // Explicit security check
                    $expr: { $eq: [{ $arrayElemAt: ['$userInfo.role', 0] }, 'company'] }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$invoiceDate' },
                        month: { $month: '$invoiceDate' },
                        day: { $dayOfMonth: '$invoiceDate' }
                    },
                    dailyRevenue: {
                        $sum: { $sum: { $map: { input: '$lineItems', as: 'item', in: { $multiply: ['$$item.quantity', '$$item.item.sellingPrice'] } } } }
                    },
                    invoiceCount: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        const dbTime = Date.now() - startTime;
        
        return {
            revenueTrends,
            _performance: {
                dbTimeMs: dbTime,
                optimizationNote: 'Global revenue trends with multi-tenant security'
            }
        };
    } catch (error) {
        console.error('❌ QuotationDocument.getGlobalRevenueTrends error:', error);
        throw error;
    }
};

// 🔥 LEAN VIRTUALS PLUGIN: Enable virtuals with .lean() queries
QuotationDocumentSchema.plugin(mongooseLeanVirtuals);

module.exports = mongoose.model('QuotationDocument', QuotationDocumentSchema);
