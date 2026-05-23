const QuotationDocument = require('../models/QuotationDocument');
const mongoose = require('mongoose');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { 
    createSearchRegex, 
    createPaginationParams, 
    logPerformance,
    createApiResponse
} = require('../utils/commonHelpers');
const { getEffectiveCompanyId } = require('../utils/companyHelper');

/**
 * 🔥 LEAN QUOTATION CONTROLLER
 * 
 * This controller follows the "Skinny Controller" pattern:
 * - Business logic moved to QuotationDocument model middleware and static methods
 * - Dashboard counter sync handled by Mongoose middleware
 * - JobCost synchronization handled by Mongoose middleware
 * - Controllers focus only on HTTP concerns and request validation
 */

// @desc    Get all quotations/invoices (Paginated) - OPTIMIZED with lean virtuals and performance monitoring
// @route   GET /api/quotations
// @access  Private
exports.getQuotations = async (req, res, next) => {
    try {
        if (!req.user || (!req.user.id && !req.user._id)) {
            return errorResponse(res, 401, 'User not authenticated');
        }

        const startTime = Date.now();
        const { page, limit, skip } = createPaginationParams(req.query);

        // 🔥 MULTI-USER FIX: Use effectiveCompanyId for data filtering
        const query = { user: getEffectiveCompanyId(req.user) };

        if (req.query.type) query.type = req.query.type;
        if (req.query.status) {
            // Support multiple statuses: ?status=approved,invoiced,partial
            const statuses = req.query.status.split(',').map(s => s.trim()).filter(Boolean);
            if (statuses.length === 1) {
                query.status = statuses[0];
            } else {
                query.status = { $in: statuses };
            }
        }

        // 🔥 DATE FILTER: Filter by invoiceDate range
        if (req.query.startDate || req.query.endDate) {
            query.invoiceDate = {};
            if (req.query.startDate) {
                query.invoiceDate.$gte = new Date(req.query.startDate + 'T00:00:00.000Z');
            }
            if (req.query.endDate) {
                query.invoiceDate.$lte = new Date(req.query.endDate + 'T23:59:59.999Z');
            }
        }
        
        // 🔥 OPTIMIZATION: Pre-compiled regex for search
        if (req.query.search) {
            const searchRegex = createSearchRegex(req.query.search);
            if (searchRegex) {
                query.$or = [
                    { customerName: searchRegex },
                    { projectTitle: searchRegex },
                    { documentNumber: searchRegex }
                ];
            }
        }

        // 🔥 SORT: Dynamic sort based on query param
        let sortObj = { createdAt: -1 }; // default: newest first
        if (req.query.sort) {
            switch (req.query.sort) {
                case 'oldest':
                    sortObj = { createdAt: 1 };
                    break;
                case 'invoice_asc':
                    // Numeric sort on documentNumber string (cast to int)
                    sortObj = { documentNumber: 1 };
                    break;
                case 'invoice_desc':
                    sortObj = { documentNumber: -1 };
                    break;
                case 'newest':
                default:
                    sortObj = { createdAt: -1 };
                    break;
            }
        }

        // 🔥 Type Filter Fix: If explicitly filtering by one type, the other type's count should be 0
        const qCountPromise = req.query.type === 'invoice' 
            ? Promise.resolve(0) 
            : QuotationDocument.countDocuments({ ...query, type: 'quotation' }).catch(() => 0);
            
        const iCountPromise = req.query.type === 'quotation' 
            ? Promise.resolve(0) 
            : QuotationDocument.countDocuments({ ...query, type: 'invoice' }).catch(() => 0);

        // 🔥 OPTIMIZATION: Parallel execution with lean() + virtuals + select() + pagination
        const [total, documents, distinctCustomers, quotationCount, invoiceCount] = await Promise.all([
            QuotationDocument.countDocuments(query).maxTimeMS(5000),
            QuotationDocument.find(query)
                .select('documentNumber type status customerName customerPhone customerAddress projectTitle totalAmount dueDate invoiceDate createdAt lineItems paymentHistory')
                .sort(sortObj)
                .skip(skip)
                .limit(limit)
                .maxTimeMS(5000)
                .lean({ virtuals: true }),
            QuotationDocument.distinct('customerName', query).then(res => res.length).catch(() => 0),
            qCountPromise,
            iCountPromise
        ]);

        const customerCount = distinctCustomers;

        // 🔥 VIRTUALS SUPPORT: Add necessary virtuals manually for enhanced lean response
        const documentsWithVirtuals = documents.map(doc => ({
            ...doc,
            // Ensure displayDocumentNumber is available (plugin should handle this, but fallback)
            displayDocumentNumber: doc.displayDocumentNumber || (doc.type === 'quotation' ? `QUO-${doc.documentNumber}` : `INV-${doc.documentNumber}`),
            // Add isOverdue virtual for better UX
            isOverdue: doc.dueDate && new Date(doc.dueDate) < new Date() && doc.status !== 'paid',
            // Ensure subtotal is calculated if not available from virtuals
            subtotal: doc.subtotal || (doc.lineItems?.reduce((sum, item) => sum + (item.quantity * item.item.sellingPrice), 0) || 0),
            // Ensure totalPayments is calculated if not available from virtuals
            totalPayments: doc.totalPayments || (doc.paymentHistory?.reduce((sum, p) => sum + p.amount, 0) || 0)
        }));

        // 🔥 CONSISTENT PERFORMANCE LOGGING: Use createApiResponse helper
        logPerformance('Quotations Query', startTime, documents.length, `${documents.length}/${total} docs, page ${page}`);

        return createApiResponse(res, 200, 'Documents retrieved successfully', documentsWithVirtuals, {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
            hasMore: page < Math.ceil(total / limit),
            customerCount,
            quotationCount,
            invoiceCount
        }, startTime);
    } catch (error) {
        console.error('❌ getQuotations error:', error);
        next(error);
    }
};

// @desc    Create quotation - LEAN with middleware handling ID generation and sync
// @route   POST /api/quotations
// @access  Private
exports.createQuotation = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 MULTI-USER FIX: Use effectiveCompanyId for data creation
        req.body.user = getEffectiveCompanyId(req.user);
        req.body.type = 'quotation';
        req.body.status = 'pending';

        // Remove empty documentNumber to allow middleware to generate it
        if (req.body.documentNumber === '' || req.body.documentNumber == null) {
            delete req.body.documentNumber;
        }

        // 🔥 MIDDLEWARE HANDLES: ID generation, dashboard sync, date calculations
        const quotation = await QuotationDocument.create(req.body);
        
        // 🔥 CONSISTENT PERFORMANCE LOGGING: Use logPerformance helper
        logPerformance('Create Quotation', startTime, 1, quotation.displayDocumentNumber);
        
        return createApiResponse(res, 201, 'Quotation created successfully', quotation, null, startTime);
    } catch (error) {
        console.error('❌ createQuotation error:', error);
        next(error);
    }
};

// @desc    Convert quotation to invoice - TRANSACTION-BASED for data integrity
// @route   PATCH /api/quotations/:id/convert-to-invoice
// @access  Private
exports.convertToInvoice = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 MULTI-USER FIX: Use effectiveCompanyId for data access
        // 🔥 DATA INTEGRITY: Use transaction-based static method
        const invoice = await QuotationDocument.convertToInvoice(
            req.params.id, 
            getEffectiveCompanyId(req.user), 
            {
                customDueDate: req.body.customDueDate,
                payments: req.body.payments || []
            }
        );

        // 🔥 CONSISTENT PERFORMANCE LOGGING: Use logPerformance helper
        logPerformance('Convert to Invoice', startTime, 1, invoice.displayDocumentNumber);

        return createApiResponse(res, 200, 'Quotation converted to invoice successfully', invoice, null, startTime);
    } catch (error) {
        console.error('❌ convertToInvoice error:', error);
        if (error.message.includes('not found')) {
            return errorResponse(res, 404, error.message);
        }
        if (error.message.includes('Already an invoice') || 
            error.message.includes('Rejected quotations') || 
            error.message.includes('Must be approved')) {
            return errorResponse(res, 400, error.message);
        }
        next(error);
    }
};

// @desc    Add payment to invoice - LEAN using model static method
// @route   POST /api/quotations/:id/payments
// @access  Private
exports.addPayment = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 MULTI-USER FIX: Use effectiveCompanyId for data access
        // 🔥 LEAN APPROACH: Use model static method with automatic status calculation
        const updatedDoc = await QuotationDocument.addPayment(
            req.params.id,
            getEffectiveCompanyId(req.user),
            req.body
        );

        // 🔥 CONSISTENT PERFORMANCE LOGGING: Use logPerformance helper
        logPerformance('Add Payment', startTime, 1, `Invoice: ${req.params.id}`);

        return createApiResponse(res, 200, 'Payment added successfully', updatedDoc, null, startTime);
    } catch (error) {
        console.error('❌ addPayment error:', error);
        if (error.message.includes('not found')) {
            return errorResponse(res, 404, error.message);
        }
        next(error);
    }
};

// @desc    Update a specific payment record
// @route   PUT /api/quotations/:id/payments/:paymentId
// @access  Private
exports.updatePayment = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { amount, date, description } = req.body;

        const doc = await QuotationDocument.findOne({
            _id: req.params.id,
            user: getEffectiveCompanyId(req.user)
        });
        if (!doc) return errorResponse(res, 404, 'Document not found');

        const payment = doc.paymentHistory.id(req.params.paymentId);
        if (!payment) return errorResponse(res, 404, 'Payment record not found');

        if (amount !== undefined) payment.amount = amount;
        if (date !== undefined) payment.date = new Date(date);
        if (description !== undefined) payment.description = description;

        // Recalculate status
        const totalPaid = doc.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
        const subtotal = doc.lineItems.reduce((sum, item) => sum + (item.quantity * item.item.sellingPrice), 0);
        if (totalPaid >= subtotal) doc.status = 'paid';
        else if (totalPaid > 0) doc.status = 'partial';
        else doc.status = doc.type === 'invoice' ? 'converted' : doc.status;

        await doc.save();
        logPerformance('Update Payment', startTime, 1, `Doc: ${req.params.id}`);
        return createApiResponse(res, 200, 'Payment updated successfully', doc, null, startTime);
    } catch (error) {
        console.error('❌ updatePayment error:', error);
        next(error);
    }
};

// @desc    Delete a specific payment record
// @route   DELETE /api/quotations/:id/payments/:paymentId
// @access  Private
exports.deletePayment = async (req, res, next) => {
    try {
        const startTime = Date.now();

        const doc = await QuotationDocument.findOne({
            _id: req.params.id,
            user: getEffectiveCompanyId(req.user)
        });
        if (!doc) return errorResponse(res, 404, 'Document not found');

        const paymentIndex = doc.paymentHistory.findIndex(
            p => p._id.toString() === req.params.paymentId
        );
        if (paymentIndex === -1) return errorResponse(res, 404, 'Payment record not found');

        doc.paymentHistory.splice(paymentIndex, 1);

        // Recalculate status
        const totalPaid = doc.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
        const subtotal = doc.lineItems.reduce((sum, item) => sum + (item.quantity * item.item.sellingPrice), 0);
        if (totalPaid >= subtotal && subtotal > 0) doc.status = 'paid';
        else if (totalPaid > 0) doc.status = 'partial';
        else doc.status = doc.type === 'invoice' ? 'converted' : 'pending';

        await doc.save();
        logPerformance('Delete Payment', startTime, 1, `Doc: ${req.params.id}`);
        return createApiResponse(res, 200, 'Payment deleted successfully', doc, null, startTime);
    } catch (error) {
        console.error('❌ deletePayment error:', error);
        next(error);
    }
};

// @desc    Update status (Manual) - SAFE APPROACH with proper JobCost sync
// @route   PATCH /api/quotations/:id/status
// @access  Private
exports.updateStatus = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { status } = req.body;
        
        // 🔥 SAFE OPTION: Use find + save pattern for reliable middleware execution
        const doc = await QuotationDocument.findOne({
            _id: req.params.id,
            user: getEffectiveCompanyId(req.user)
        });

        if (!doc) {
            return errorResponse(res, 404, 'Document not found');
        }

        // Update status and save - this ensures post-save hooks run properly
        doc.status = status;
        await doc.save();

        // 🔥 CONSISTENT PERFORMANCE LOGGING: Use logPerformance helper
        logPerformance('Update Status', startTime, 1, `Document: ${req.params.id}`);

        return createApiResponse(res, 200, 'Status updated successfully', doc, null, startTime);
    } catch (error) {
        console.error('❌ updateStatus error:', error);
        next(error);
    }
};

// @desc    Get single document
// @route   GET /api/quotations/:id
// @access  Private
exports.getQuotation = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        const doc = await QuotationDocument.findOne({
            _id: req.params.id,
            user: getEffectiveCompanyId(req.user)
        });

        if (!doc) return errorResponse(res, 404, 'Document not found');
        
        // 🔥 CONSISTENT PERFORMANCE LOGGING: Use logPerformance helper
        logPerformance('Get Quotation', startTime, 1, `ID: ${req.params.id}`);
        
        return createApiResponse(res, 200, 'Document retrieved successfully', doc, null, startTime);
    } catch (error) {
        console.error('❌ getQuotation error:', error);
        next(error);
    }
};

// @desc    Update document - LEAN with middleware handling JobCost sync
// @route   PUT /api/quotations/:id
// @access  Private
exports.updateQuotation = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 FIX: Handle temporary IDs that are not valid ObjectIds
        const quotationId = req.params.id;
        
        // Check if this is a temporary ID (starts with "temp_")
        if (quotationId.startsWith('temp_')) {
            return errorResponse(res, 400, 'Cannot update temporary quotation. Please save as new quotation first.');
        }
        
        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(quotationId)) {
            return errorResponse(res, 400, 'Invalid quotation ID format');
        }
        
        // 🔥 MIDDLEWARE HANDLES: JobCost sync automatically if status is 'approved'
        const doc = await QuotationDocument.findOneAndUpdate(
            { _id: quotationId, user: getEffectiveCompanyId(req.user) },
            req.body,
            { new: true, runValidators: true }
        );

        if (!doc) {
            return errorResponse(res, 404, 'Document not found');
        }

        // 🔥 CONSISTENT PERFORMANCE LOGGING: Use logPerformance helper
        logPerformance('Update Quotation', startTime, 1, doc.displayDocumentNumber);

        return createApiResponse(res, 200, 'Document updated successfully', doc, null, startTime);
    } catch (error) {
        console.error('❌ updateQuotation error:', error);
        next(error);
    }
};

// @desc    Delete document - LEAN with middleware handling dashboard sync
// @route   DELETE /api/quotations/:id
// @access  Private
exports.deleteQuotation = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 MULTI-USER FIX: Use effectiveCompanyId for data deletion
        // 🔥 MIDDLEWARE HANDLES: Dashboard counter decrement automatically
        const doc = await QuotationDocument.findOneAndDelete({
            _id: req.params.id,
            user: getEffectiveCompanyId(req.user)
        });

        if (!doc) return errorResponse(res, 404, 'Document not found');
        
        // 🔥 CONSISTENT PERFORMANCE LOGGING: Use logPerformance helper
        logPerformance('Delete Quotation', startTime, 1, doc.displayDocumentNumber);
        
        return createApiResponse(res, 200, 'Document deleted successfully', null, null, startTime);
    } catch (error) {
        console.error('❌ deleteQuotation error:', error);
        next(error);
    }
};

module.exports = {
    getQuotations: exports.getQuotations,
    createQuotation: exports.createQuotation,
    convertToInvoice: exports.convertToInvoice,
    addPayment: exports.addPayment,
    updatePayment: exports.updatePayment,
    deletePayment: exports.deletePayment,
    updateStatus: exports.updateStatus,
    getQuotation: exports.getQuotation,
    updateQuotation: exports.updateQuotation,
    deleteQuotation: exports.deleteQuotation
};