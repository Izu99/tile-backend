const QuotationDocument = require('../models/QuotationDocument');
require('colors');
const JobCost = require('../models/JobCost');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseHandler');
const { generateNumericId } = require('../utils/idGenerator');

// @desc    Get all quotations/invoices (Paginated)
// @route   GET /api/quotations
// @access  Private
exports.getQuotations = async (req, res, next) => {
    try {
        if (!req.user || !req.user.id) {
            return errorResponse(res, 401, 'User not authenticated');
        }

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20; // Increased default limit to 20
        const skip = (page - 1) * limit;

        // User based filter
        const query = { user: req.user.id };

        if (req.query.type) query.type = req.query.type;
        if (req.query.status) query.status = req.query.status;
        if (req.query.search) {
            query.$or = [
                { customerName: { $regex: req.query.search, $options: 'i' } },
                { projectTitle: { $regex: req.query.search, $options: 'i' } },
                { documentNumber: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const startTime = Date.now();
        // Parallel execution for count and find
        const [total, documents] = await Promise.all([
            QuotationDocument.countDocuments(query),
            QuotationDocument.find(query)
                .select('-__v') // Exclude version key
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean() // Already using lean, making sure it stays
        ]);

        const dbTime = Date.now() - startTime;
        const totalPages = Math.ceil(total / limit);
        const hasMore = page < totalPages;

        console.log(`⏱️ QUOTATIONS: DB Query: ${dbTime}ms | Total: ${Date.now() - startTime}ms`.cyan);

        return paginatedResponse(res, 200, 'Documents retrieved successfully', documents, {
            total,
            page,
            pages: totalPages,
            limit,
            hasMore,
            _performance: {
                dbTimeMs: dbTime,
                totalTimeMs: Date.now() - startTime
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create quotation
// @route   POST /api/quotations
// @access  Private
exports.createQuotation = async (req, res, next) => {
    try {
        req.body.user = req.user.id;
        req.body.type = 'quotation';
        req.body.status = 'pending'; // හැමවිටම මුලින් pending

        if (!req.body.documentNumber) {
            // අදාළ Company එකට (user) අයිති ඊළඟ අංකය ගන්නවා
            const numericId = await generateNumericId(
                QuotationDocument,
                'documentNumber',
                { user: req.user.id, type: 'quotation' }
            );
            // Database එකේ සේව් වෙන්නේ අංකය විතරයි. (Virtual එකෙන් QUO- එක එකතු කරයි)
            req.body.documentNumber = String(numericId).padStart(3, '0');
        }

        // Date handling: Preserve user-selected dates, only calculate if not provided
        if (!req.body.invoiceDate) {
            req.body.invoiceDate = new Date();
        }

        // Only calculate dueDate if not provided by user
        if (!req.body.dueDate && req.body.invoiceDate) {
            const invoiceDate = new Date(req.body.invoiceDate);
            const paymentTerms = req.body.paymentTerms || 30;
            const dueDate = new Date(invoiceDate);
            dueDate.setDate(invoiceDate.getDate() + paymentTerms);
            req.body.dueDate = dueDate;
        }

        const quotation = await QuotationDocument.create(req.body);
        return successResponse(res, 201, 'Quotation created successfully', quotation);
    } catch (error) {
        next(error);
    }
};

// @desc    Convert quotation to invoice
// @route   PATCH /api/quotations/:id/convert-to-invoice
// @access  Private
exports.convertToInvoice = async (req, res, next) => {
    try {
        const quotation = await QuotationDocument.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!quotation) return errorResponse(res, 404, 'Quotation not found');
        if (quotation.type === 'invoice') return errorResponse(res, 400, 'Already an invoice');
        if (quotation.status === 'rejected') return errorResponse(res, 400, 'Rejected quotations cannot be converted to invoices');
        if (quotation.status !== 'approved') return errorResponse(res, 400, 'Must be approved before conversion');

        // 📅 DATE UPDATES FOR CONVERSION
        // Invoice Date: Set to current date (date of conversion)
        const currentDate = new Date();
        quotation.invoiceDate = currentDate;

        // Due Date: Recalculate based on new invoice date + payment terms
        // Only override if user didn't provide a custom due date
        if (!req.body.customDueDate) {
            const paymentTerms = quotation.paymentTerms || 30;
            const dueDate = new Date(currentDate);
            dueDate.setDate(currentDate.getDate() + paymentTerms);
            quotation.dueDate = dueDate;
        } else {
            // User provided custom due date
            quotation.dueDate = new Date(req.body.customDueDate);
        }

        // Type මාරු කරනවා
        quotation.type = 'invoice';

        // 💰 Payment Logic එක මෙතනින් පටන් ගන්නවා
        const payments = req.body.payments || [];

        if (payments.length > 0) {
            // පේමන්ට්ස් හිස්ට්‍රියට ඇඩ් කරනවා
            quotation.paymentHistory.push(...payments);

            // මුළු බිල් එක සහ ගෙවපු මුළු ගණන බලනවා
            const totalPaid = quotation.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
            const subtotal = quotation.lineItems.reduce((sum, item) => sum + (item.quantity * item.item.sellingPrice), 0);

            // පේමන්ට් එකක් තියෙන නිසා partial හෝ paid වෙනවා (කවදාවත් converted වෙන්නේ නැහැ)
            quotation.status = totalPaid >= subtotal ? 'paid' : 'partial';
        } else {
            // කිසිම පේමන්ට් එකක් නැති නම් විතරක් converted status එක දානවා
            quotation.status = 'converted';
        }

        await quotation.save();

        // Update JobCost document with invoiceId if it exists
        const JobCost = require('../models/JobCost');
        const originalQuotationId = `QUO-${quotation.documentNumber}`;
        const jobCost = await JobCost.findOne({
            quotationId: originalQuotationId,
            user: quotation.user
        });

        if (jobCost) {
            jobCost.invoiceId = `INV-${quotation.documentNumber}`; // Now it's an invoice
            jobCost.type = 'invoice';
            jobCost.customerInvoiceStatus = quotation.status; // 'paid', 'partial', or 'converted'
            await jobCost.save();
            console.log(`✅ Updated JobCost ${jobCost._id} with invoiceId: INV-${quotation.documentNumber} and status: ${quotation.status}`);
        }

        return successResponse(res, 200, 'Quotation converted to invoice successfully', quotation);
    } catch (error) {
        console.error('❌ Conversion error:', error);
        next(error);
    }
};

// @desc    Add payment to invoice
// @route   POST /api/quotations/:id/payments
// @access  Private
exports.addPayment = async (req, res, next) => {
    try {
        const doc = await QuotationDocument.findOne({
            _id: req.params.id,
            user: req.user.id,

            type: 'invoice' // පේමන්ට්ස් ඇඩ් කරන්නේ ඉන්වොයිස් වලට විතරයි
        });

        if (!doc) return errorResponse(res, 404, 'Invoice not found');

        doc.paymentHistory.push(req.body);

        // Update status based on payment total
        const totalPaid = doc.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
        const subtotal = doc.lineItems.reduce((sum, item) => sum + (item.quantity * item.item.sellingPrice), 0);

        if (totalPaid >= subtotal) {
            doc.status = 'paid';
        } else {
            doc.status = 'partial';
        }

        await doc.save();

        // Update JobCost status if linked
        const JobCost = require('../models/JobCost');
        const jobCost = await JobCost.findOne({
            $or: [
                { invoiceId: `INV-${doc.documentNumber}` },
                { quotationId: `QUO-${doc.documentNumber}` }
            ],
            user: doc.user
        });

        if (jobCost) {
            jobCost.customerInvoiceStatus = doc.status;
            await jobCost.save();
            console.log(`✅ Updated JobCost ${jobCost._id} status to: ${doc.status}`);
        }

        return successResponse(res, 200, 'Payment added successfully', doc);
    } catch (error) {
        next(error);
    }
};

// @desc    Update status (Manual)
// @route   PATCH /api/quotations/:id/status
// @access  Private
exports.updateStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const doc = await QuotationDocument.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            { status },
            { new: true, runValidators: true }
        );

        if (!doc) return errorResponse(res, 404, 'Document not found');

        // Auto-create/Sync JobCost in background (Detached execution)
        if (status === 'approved' && doc.type === 'quotation') {
            (async () => {
                try {
                    const existingJobCost = await JobCost.findOne({
                        quotationId: `QUO-${doc.documentNumber}`,
                        user: doc.user
                    });

                    if (!existingJobCost) {
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
                    } else {
                        // Smart Sync - Preserving logic without logs
                        const existingItemsMap = new Map();
                        if (existingJobCost.invoiceItems?.length > 0) {
                            existingJobCost.invoiceItems.forEach(item => {
                                if (item.name) existingItemsMap.set(item.name, item.costPrice || 0);
                            });
                        }

                        const newInvoiceItems = doc.lineItems.map(item => {
                            const itemName = (item.item && item.item.name) || item.displayName || 'Unknown Item';
                            let costPriceToUse = (item.item && item.item.costPrice) || 0;
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
                    }
                } catch (bgError) {
                    console.error('JobCost background sync error:', bgError.message);
                }
            })();
        }

        return successResponse(res, 200, 'Status updated', doc);
    } catch (error) {
        next(error);
    }
};

// @desc    Get single document
// @route   GET /api/quotations/:id
// @access  Private
exports.getQuotation = async (req, res, next) => {
    try {
        const doc = await QuotationDocument.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!doc) return errorResponse(res, 404, 'Document not found');
        return successResponse(res, 200, 'Document retrieved', doc);
    } catch (error) {
        next(error);
    }
};

// @desc    Update document
// @route   PUT /api/quotations/:id
// @access  Private
exports.updateQuotation = async (req, res, next) => {
    try {
        const doc = await QuotationDocument.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            req.body,
            { new: true, runValidators: true }
        );

        if (!doc) {
            return errorResponse(res, 404, 'Document not found');
        }

        // Auto-create/Sync JobCost in background if approved (Detached execution)
        if (doc.status === 'approved' && doc.type === 'quotation') {
            (async () => {
                if (!doc.user || !doc.customerName || !doc.lineItems?.length) return;

                try {
                    const existingJobCost = await JobCost.findOne({
                        quotationId: `QUO-${doc.documentNumber}`,
                        user: doc.user
                    });

                    if (!existingJobCost) {
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
                    } else {
                        // Smart Sync Logic
                        const existingItemsMap = new Map();
                        if (existingJobCost.invoiceItems?.length > 0) {
                            existingJobCost.invoiceItems.forEach(item => {
                                if (item.name) existingItemsMap.set(item.name, item.costPrice || 0);
                            });
                        }

                        const newInvoiceItems = doc.lineItems.map(item => {
                            const itemName = (item.item && item.item.name) || item.displayName || 'Unknown Item';
                            let costPriceToUse = (item.item && item.item.costPrice) || 0;
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
                    }
                } catch (bgError) {
                    console.error('JobCost background sync error:', bgError.message);
                }
            })();
        }

        return successResponse(res, 200, 'Document updated', doc);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete document
// @route   DELETE /api/quotations/:id
// @access  Private
exports.deleteQuotation = async (req, res, next) => {
    try {
        const doc = await QuotationDocument.findOneAndDelete({
            _id: req.params.id,
            user: req.user.id
        });

        if (!doc) return errorResponse(res, 404, 'Document not found');
        return successResponse(res, 200, 'Deleted successfully');
    } catch (error) {
        next(error);
    }
};
