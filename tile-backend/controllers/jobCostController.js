const mongoose = require('mongoose');
const JobCost = require('../models/JobCost');
const PurchaseOrder = require('../models/PurchaseOrder');
const QuotationDocument = require('../models/QuotationDocument');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseHandler');
const { generateNumericId } = require('../utils/idGenerator');

// @desc    Get all job costs
// @route   GET /api/job-costs
// @access  Private
exports.getJobCosts = async (req, res, next) => {
    try {
        // Fetching real data from DB based on logged-in user
        const jobs = await JobCost.find({ user: req.user.id })
            .sort({ createdAt: -1 });

        console.log('📊 Total JobCost documents matching query:', jobs.length);

        return res.status(200).json({
            success: true,
            count: jobs.length,
            data: jobs
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single job cost
// @route   GET /api/job-costs/:id
// @access  Private
exports.getJobCost = async (req, res, next) => {
    try {
        let query = { _id: req.params.id };
        if (req.user.role !== 'super-admin') {
            query.user = req.user.id;
        }

        const jobCost = await JobCost.findOne(query);

        if (!jobCost) return errorResponse(res, 404, 'Job cost not found');
        return successResponse(res, 200, 'Job cost retrieved successfully', jobCost);
    } catch (error) {
        next(error);
    }
};

// @desc    Create job cost
// @route   POST /api/job-costs
// @access  Private
exports.createJobCost = async (req, res, next) => {
    try {
        req.body.user = req.user.id;

        // Set unified documentId if not provided (use quotationId or generate new)
        if (!req.body.documentId) {
            if (req.body.quotationId) {
                req.body.documentId = req.body.quotationId;
            } else {
                req.body.documentId = await generateNumericId(JobCost, 'documentId');
            }
        }

        // Set type based on whether invoiceId exists
        if (req.body.invoiceId && req.body.invoiceId.trim() !== '') {
            req.body.type = 'invoice';
        } else {
            req.body.type = 'quotation';
        }

        const jobCost = await JobCost.create(req.body);
        return successResponse(res, 201, 'Job cost created successfully', jobCost);
    } catch (error) {
        next(error);
    }
};

// @desc    Update job cost (Upsert - Create if not exists)
// @route   PUT /api/job-costs/:id
// @access  Private
exports.updateJobCost = async (req, res, next) => {
    try {
        let jobCost = await JobCost.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!jobCost) {
            // Try to find by documentId if _id doesn't match
            const documentId = req.body.documentId;
            if (documentId) {
                jobCost = await JobCost.findOne({
                    documentId: documentId,
                    user: req.user.id,
                });
            }
        }

        if (jobCost) {
            // Update existing - also update type if invoiceId is provided
            if (req.body.invoiceId && req.body.invoiceId.trim() !== '') {
                req.body.type = 'invoice';
            } else if (req.body.quotationId && (!req.body.invoiceId || req.body.invoiceId.trim() === '')) {
                req.body.type = 'quotation';
            }

            // Note: materialCost and netProfit will be recalculated automatically by pre-save middleware

            jobCost = await JobCost.findByIdAndUpdate(jobCost._id, req.body, {
                new: true,
                runValidators: true,
            });
            return successResponse(res, 200, 'Job cost updated successfully', jobCost);
        } else {
            // Create new (upsert)
            req.body.user = req.user.id;
            if (!req.body.documentId) {
                return errorResponse(res, 400, 'documentId is required for new job cost');
            }

            // Set type based on whether invoiceId exists
            if (req.body.invoiceId && req.body.invoiceId.trim() !== '') {
                req.body.type = 'invoice';
            } else {
                req.body.type = 'quotation';
            }

            const newJobCost = await JobCost.create(req.body);
            return successResponse(res, 201, 'Job cost created successfully', newJobCost);
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Complete project
// @route   PATCH /api/job-costs/:id/complete
// @access  Private
exports.completeProject = async (req, res, next) => {
    try {
        const jobCost = await JobCost.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!jobCost) return errorResponse(res, 404, 'Job cost not found');
        if (jobCost.completed) return errorResponse(res, 400, 'Project is already completed');

        // 1. Data Integrity: Check if all items have a costPrice > 0
        const hasMissingCosts = (jobCost.invoiceItems || []).some(item =>
            item.sellingPrice > 0 && (item.costPrice == null || item.costPrice === 0)
        );
        if (hasMissingCosts) {
            return errorResponse(res, 400, 'All items must have a cost price before completing project');
        }

        // 2. Customer Invoice Status: Check if the final Customer Invoice is marked as 'paid'
        // If it's an invoice, check its status in QuotationDocument
        if (jobCost.type === 'invoice' && jobCost.invoiceId) {
            const invoice = await QuotationDocument.findOne({
                documentNumber: jobCost.invoiceId,
                type: 'invoice',
                user: req.user.id,
            });

            if (!invoice || invoice.status !== 'paid') {
                return errorResponse(res, 400, 'Customer Invoice must be fully paid before completing project');
            }
        } else if (jobCost.type === 'quotation') {
            return errorResponse(res, 400, 'Job must be converted to Invoice and Paid before completion');
        }

        // 3. PO Status: All Purchase Orders linked to this job must be in 'Invoiced' or 'Paid' status
        // Find all POs linked to this documentId
        const linkedPOs = await PurchaseOrder.find({
            'items.jobId': jobCost.documentId,
            user: req.user.id
        });

        const hasUnconfirmedPOs = linkedPOs.some(po =>
            !['Invoiced', 'Paid'].includes(po.status)
        );

        if (hasUnconfirmedPOs) {
            return errorResponse(res, 400, 'All linked Purchase Orders must be Invoiced or Paid before completion');
        }

        jobCost.completed = true;
        await jobCost.save();

        return successResponse(res, 200, 'Project completed successfully', jobCost);
    } catch (error) {
        next(error);
    }
};

// @desc    Re-open project (Admin only)
// @route   PATCH /api/job-costs/:id/reopen
// @access  Private (Admin)
exports.reopenProject = async (req, res, next) => {
    try {
        // Basic role check (this should also be in route middleware)
        if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
            return errorResponse(res, 403, 'Only admins can re-open projects');
        }

        const jobCost = await JobCost.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!jobCost) return errorResponse(res, 404, 'Job cost not found');
        if (!jobCost.completed) return errorResponse(res, 400, 'Project is not completed');

        jobCost.completed = false;
        await jobCost.save();

        return successResponse(res, 200, 'Project re-opened successfully', jobCost);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete job cost
// @route   DELETE /api/job-costs/:id
// @access  Private
exports.deleteJobCost = async (req, res, next) => {
    try {
        const jobCost = await JobCost.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!jobCost) return errorResponse(res, 404, 'Job cost not found');
        await jobCost.deleteOne();

        return successResponse(res, 200, 'Job cost deleted successfully', null);
    } catch (error) {
        next(error);
    }
};

// OTHER EXPENSES CONTROLLERS

// @desc    Get other expenses for a job cost
// @route   GET /api/job-costs/:jobCostId/other-expenses
// @access  Private
exports.getOtherExpenses = async (req, res, next) => {
    try {
        let query = {};
        if (req.user.role === 'super-admin') {
            query = { _id: req.params.jobCostId };
        } else {
            query = {
                $or: [
                    { _id: req.params.jobCostId, user: req.user.id },
                    { documentId: req.params.jobCostId, user: req.user.id }
                ]
            };
        }

        const jobCost = await JobCost.findOne(query);

        if (!jobCost) return errorResponse(res, 404, 'Job cost not found');

        return successResponse(res, 200, 'Other expenses retrieved successfully', jobCost.otherExpenses || []);
    } catch (error) {
        next(error);
    }
};

// @desc    Add other expense to job cost
// @route   POST /api/job-costs/:jobCostId/other-expenses
// @access  Private
exports.addOtherExpense = async (req, res, next) => {
    try {
        // Validate required fields
        if (!req.body.amount || isNaN(req.body.amount) || req.body.amount <= 0) {
            return errorResponse(res, 400, 'Valid amount is required for expense');
        }

        let query = {};
        if (req.user.role === 'super-admin') {
            query = { _id: req.params.jobCostId };
        } else {
            query = {
                $or: [
                    { _id: req.params.jobCostId, user: req.user.id },
                    { documentId: req.params.jobCostId, user: req.user.id }
                ]
            };
        }

        const jobCost = await JobCost.findOne(query);

        if (!jobCost) return errorResponse(res, 404, 'Job cost not found');

        const newExpense = {
            description: req.body.description || '', // Ensure description has a fallback
            amount: parseFloat(req.body.amount), // Ensure amount is a number
            category: req.body.category || 'General',
            _id: new mongoose.Types.ObjectId(), // Generate unique ID for the expense
            date: req.body.date ? new Date(req.body.date) : new Date(),
        };

        if (!jobCost.otherExpenses) {
            jobCost.otherExpenses = [];
        }

        jobCost.otherExpenses.push(newExpense);
        await jobCost.save();

        console.log('✅ Expense added successfully:', newExpense);
        return successResponse(res, 201, 'Other expense added successfully', newExpense);
    } catch (error) {
        console.error('❌ Error adding expense:', error);
        next(error);
    }
};

// @desc    Update other expense
// @route   PUT /api/job-costs/:jobCostId/other-expenses/:expenseId
// @access  Private
exports.updateOtherExpense = async (req, res, next) => {
    try {
        let query = {};
        if (req.user.role === 'super-admin') {
            query = { _id: req.params.jobCostId };
        } else {
            query = {
                $or: [
                    { _id: req.params.jobCostId, user: req.user.id },
                    { documentId: req.params.jobCostId, user: req.user.id }
                ]
            };
        }

        const jobCost = await JobCost.findOne(query);

        if (!jobCost) return errorResponse(res, 404, 'Job cost not found');

        const expenseIndex = jobCost.otherExpenses.findIndex(
            expense => expense._id.toString() === req.params.expenseId
        );

        if (expenseIndex === -1) return errorResponse(res, 404, 'Other expense not found');

        // Update the expense
        jobCost.otherExpenses[expenseIndex] = {
            ...jobCost.otherExpenses[expenseIndex],
            ...req.body,
            date: req.body.date ? new Date(req.body.date) : jobCost.otherExpenses[expenseIndex].date,
        };

        await jobCost.save();

        return successResponse(res, 200, 'Other expense updated successfully', jobCost.otherExpenses[expenseIndex]);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete other expense
// @route   DELETE /api/job-costs/:jobCostId/other-expenses/:expenseId
// @access  Private
exports.deleteOtherExpense = async (req, res, next) => {
    try {
        let query = {};
        if (req.user.role === 'super-admin') {
            query = { _id: req.params.jobCostId };
        } else {
            query = {
                $or: [
                    { _id: req.params.jobCostId, user: req.user.id },
                    { documentId: req.params.jobCostId, user: req.user.id }
                ]
            };
        }

        const jobCost = await JobCost.findOne(query);

        if (!jobCost) return errorResponse(res, 404, 'Job cost not found');

        const expenseIndex = jobCost.otherExpenses.findIndex(
            expense => expense._id.toString() === req.params.expenseId
        );

        if (expenseIndex === -1) return errorResponse(res, 404, 'Other expense not found');

        jobCost.otherExpenses.splice(expenseIndex, 1);
        await jobCost.save();

        return successResponse(res, 200, 'Other expense deleted successfully', null);
    } catch (error) {
        next(error);
    }
};
