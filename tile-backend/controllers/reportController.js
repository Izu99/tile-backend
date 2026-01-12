const QuotationDocument = require('../models/QuotationDocument');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseHandler');

// @desc    Get project profitability report data
// @route   GET /api/reports/projects
// @access  Private
exports.getProjectReport = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;
        const skip = (page - 1) * limit;

        // Get all projects (quotations and invoices) with populated data for reports
        const query = { user: req.user.id };

        // Apply filters
        if (req.query.status) query.projectStatus = req.query.status;
        if (req.query.type) query.type = req.query.type;

        if (req.query.startDate || req.query.endDate) {
            query.invoiceDate = {};
            if (req.query.startDate) query.invoiceDate.$gte = new Date(req.query.startDate);
            if (req.query.endDate) query.invoiceDate.$lte = new Date(req.query.endDate);
        }

        const projects = await QuotationDocument.find(query)
            .sort({ invoiceDate: -1 })
            .skip(skip)
            .limit(limit)
            .select('documentNumber type status customerName projectTitle invoiceDate dueDate actualCompletionDate projectStatus lineItems directCosts paymentHistory subtotal totalDirectCosts netProfit profitMargin completionDate');

        const total = await QuotationDocument.countDocuments(query);

        // Format data for frontend reports
        const formattedProjects = projects.map(project => ({
            projectId: project.documentNumber,
            projectName: project.projectTitle || `${project.customerName} - ${project.documentNumber}`,
            clientName: project.customerName,
            status: project.projectStatus,
            income: project.subtotal,
            directCost: project.totalDirectCosts,
            netProfit: project.netProfit,
            margin: project.profitMargin,
            completionDate: project.completionDate,
            invoiceDate: project.invoiceDate,
            type: project.type,
            documentStatus: project.status,
        }));

        return paginatedResponse(res, 200, 'Project report data retrieved successfully', formattedProjects, {
            total, page, pages: Math.ceil(total / limit), limit,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get invoice summary report data
// @route   GET /api/reports/invoices
// @access  Private
exports.getInvoiceReport = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;
        const skip = (page - 1) * limit;

        // Get only invoices
        const query = {
            user: req.user.id,
            type: 'invoice'
        };

        // Apply filters
        if (req.query.status) query.status = req.query.status;

        if (req.query.startDate || req.query.endDate) {
            query.invoiceDate = {};
            if (req.query.startDate) query.invoiceDate.$gte = new Date(req.query.startDate);
            if (req.query.endDate) query.invoiceDate.$lte = new Date(req.query.endDate);
        }

        const invoices = await QuotationDocument.find(query)
            .sort({ invoiceDate: -1 })
            .skip(skip)
            .limit(limit)
            .select('documentNumber invoiceDate customerName customerPhone subtotal totalPayments amountDue status');

        const total = await QuotationDocument.countDocuments(query);

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

        return paginatedResponse(res, 200, 'Invoice report data retrieved successfully', formattedInvoices, {
            total, page, pages: Math.ceil(total / limit), limit,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get dashboard summary data
// @route   GET /api/reports/dashboard
// @access  Private
exports.getDashboardSummary = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Get counts and summaries
        const [
            totalQuotations,
            totalInvoices,
            pendingQuotations,
            approvedQuotations,
            paidInvoices,
            pendingInvoices,
            totalRevenue,
            totalCosts,
            monthlyRevenue
        ] = await Promise.all([
            // Total quotations
            QuotationDocument.countDocuments({ user: userId, type: 'quotation' }),

            // Total invoices
            QuotationDocument.countDocuments({ user: userId, type: 'invoice' }),

            // Pending quotations
            QuotationDocument.countDocuments({ user: userId, type: 'quotation', status: 'pending' }),

            // Approved quotations
            QuotationDocument.countDocuments({ user: userId, type: 'quotation', status: 'approved' }),

            // Paid invoices
            QuotationDocument.countDocuments({ user: userId, type: 'invoice', status: 'paid' }),

            // Pending invoices (unpaid)
            QuotationDocument.countDocuments({
                user: userId,
                type: 'invoice',
                status: { $in: ['pending', 'partial'] }
            }),

            // Total revenue (sum of all invoice subtotals)
            QuotationDocument.aggregate([
                { $match: { user: userId, type: 'invoice' } },
                { $group: { _id: null, total: { $sum: '$lineItems.amount' } } }
            ]),

            // Total costs (sum of all direct costs)
            QuotationDocument.aggregate([
                { $match: { user: userId } },
                { $unwind: '$directCosts' },
                { $group: { _id: null, total: { $sum: '$directCosts.amount' } } }
            ]),

            // Monthly revenue for current month
            QuotationDocument.aggregate([
                {
                    $match: {
                        user: userId,
                        type: 'invoice',
                        invoiceDate: {
                            $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
                            $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
                        }
                    }
                },
                { $group: { _id: null, total: { $sum: '$lineItems.amount' } } }
            ])
        ]);

        const summary = {
            quotations: {
                total: totalQuotations || 0,
                pending: pendingQuotations || 0,
                approved: approvedQuotations || 0,
            },
            invoices: {
                total: totalInvoices || 0,
                paid: paidInvoices || 0,
                pending: pendingInvoices || 0,
            },
            financial: {
                totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
                totalCosts: totalCosts.length > 0 ? totalCosts[0].total : 0,
                monthlyRevenue: monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0,
                netProfit: (totalRevenue.length > 0 ? totalRevenue[0].total : 0) - (totalCosts.length > 0 ? totalCosts[0].total : 0),
            }
        };

        return successResponse(res, 200, 'Dashboard summary retrieved successfully', summary);
    } catch (error) {
        next(error);
    }
};

// @desc    Add direct cost to a project
// @route   POST /api/reports/:documentId/costs
// @access  Private
exports.addDirectCost = async (req, res, next) => {
    try {
        const { category, description, amount, date, vendor } = req.body;

        const document = await QuotationDocument.findOne({
            _id: req.params.documentId,
            user: req.user.id,
        });

        if (!document) return errorResponse(res, 404, 'Document not found');

        // Add the direct cost
        document.directCosts.push({
            category,
            description,
            amount,
            date: date || new Date(),
            vendor: vendor || '',
        });

        await document.save();

        return successResponse(res, 200, 'Direct cost added successfully', document);
    } catch (error) {
        next(error);
    }
};

// @desc    Get material sales report data
// @route   GET /api/reports/material-sales
// @access  Private
exports.getMaterialSalesReport = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;
        const skip = (page - 1) * limit;

        // Get material sales data (for now using QuotationDocument with type filtering)
        // TODO: Create separate MaterialSale model when needed
        const query = {
            user: req.user.id,
            type: 'quotation', // Material sales might be stored as quotations for now
            // Add material sale specific filtering if needed
        };

        // Apply filters
        if (req.query.status) query.status = req.query.status;

        if (req.query.startDate || req.query.endDate) {
            query.invoiceDate = {};
            if (req.query.startDate) query.invoiceDate.$gte = new Date(req.query.startDate);
            if (req.query.endDate) query.invoiceDate.$lte = new Date(req.query.endDate);
        }

        const materialSales = await QuotationDocument.find(query)
            .sort({ invoiceDate: -1 })
            .skip(skip)
            .limit(limit)
            .select('documentNumber invoiceDate customerName customerPhone lineItems paymentHistory subtotal totalPayments amountDue status');

        const total = await QuotationDocument.countDocuments(query);

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
            // Material sales specific fields (placeholder for now)
            totalSqft: 0, // Calculate based on items if needed
            totalPlanks: 0, // Calculate based on items if needed
            profitPercentage: 0, // Calculate based on cost vs selling price
        }));

        return paginatedResponse(res, 200, 'Material sales report data retrieved successfully', formattedSales, {
            total, page, pages: Math.ceil(total / limit), limit,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update project status
// @route   PATCH /api/reports/:documentId/project-status
// @access  Private
exports.updateProjectStatus = async (req, res, next) => {
    try {
        const { projectStatus, actualCompletionDate } = req.body;

        const document = await QuotationDocument.findOneAndUpdate(
            { _id: req.params.documentId, user: req.user.id },
            {
                projectStatus,
                actualCompletionDate: actualCompletionDate ? new Date(actualCompletionDate) : undefined,
            },
            { new: true, runValidators: true }
        );

        if (!document) return errorResponse(res, 404, 'Document not found');

        return successResponse(res, 200, 'Project status updated successfully', document);
    } catch (error) {
        next(error);
    }
};
