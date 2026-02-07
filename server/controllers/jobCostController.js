const mongoose = require('mongoose');
const JobCost = require('../models/JobCost');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { createApiResponse } = require('../utils/commonHelpers');

/**
 * 🔥 LEAN JOB COST CONTROLLER
 * 
 * This controller follows the "Skinny Controller" pattern:
 * - Business logic moved to JobCost model static methods
 * - Multi-document validation handled by model layer
 * - Dashboard counter sync handled by Mongoose middleware
 * - Controllers focus only on HTTP concerns
 * - Consistent API responses with performance monitoring
 */

// @desc    Get all job costs - OPTIMIZED with model static method
// @route   GET /api/job-costs
// @access  Private
exports.getJobCosts = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const userId = req.user.id;
        
        // 🔥 LEAN APPROACH: Use model static method for complex query logic
        const result = await JobCost.getOptimizedList(userId, req.query);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Job Costs Query: ${dbTime}ms (${result.jobCosts.length}/${result.pagination.total} jobs, page ${result.pagination.page})`.cyan);

        if (dbTime > 200) {
            console.log(`⚠️ Slow job costs query detected: ${dbTime}ms`.yellow);
        }

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper for standardized responses
        return createApiResponse(
            res, 
            200, 
            'Job costs retrieved successfully', 
            result.jobCosts,
            {
                ...result.pagination,
                _performance: {
                    dbTimeMs: dbTime,
                    totalTimeMs: Date.now() - startTime
                }
            },
            startTime
        );
    } catch (error) {
        console.error('❌ getJobCosts error:', error);
        next(error);
    }
};

// @desc    Get single job cost - OPTIMIZED with lean virtuals
// @route   GET /api/job-costs/:id
// @access  Private
exports.getJobCost = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        let query = { _id: req.params.id };
        if (req.user.role !== 'super-admin') {
            query.user = req.user.id;
        }

        // 🔥 LEAN VIRTUALS: Use lean() with virtuals for memory optimization + virtual fields
        const jobCost = await JobCost.findOne(query).lean({ virtuals: true });

        if (!jobCost) return errorResponse(res, 404, 'Job cost not found');

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Get Job Cost: ${dbTime}ms (ID: ${req.params.id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Job cost retrieved successfully', jobCost, null, startTime);
    } catch (error) {
        console.error('❌ getJobCost error:', error);
        next(error);
    }
};

// @desc    Create job cost - LEAN with middleware handling sync
// @route   POST /api/job-costs
// @access  Private
exports.createJobCost = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const userId = req.user.id;
        
        // 🔥 ATOMIC ID GENERATION: Use model static method with retry logic
        const jobCost = await JobCost.createNewWithAtomicId(userId, req.body);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Create Job Cost: ${dbTime}ms (Document ID: ${jobCost.documentId})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 201, 'Job cost created successfully', jobCost, null, startTime);
    } catch (error) {
        console.error('❌ createJobCost error:', error);
        if (error.message.includes('document ID collisions')) {
            return errorResponse(res, 500, 'Failed to generate unique document ID after multiple attempts');
        } else if (error.code === 11000) {
            return errorResponse(res, 400, 'Document ID already exists');
        }
        next(error);
    }
};

// @desc    Update job cost (Upsert - Create if not exists) - LEAN with model static method
// @route   PUT /api/job-costs/:id
// @access  Private
exports.updateJobCost = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const userId = req.user.id;
        
        // 🔥 UPSERT LOGIC: Use model static method for find by _id OR documentId logic
        const result = await JobCost.upsertJobCost(userId, req.params.id, req.body);

        const dbTime = Date.now() - startTime;
        const action = result.isNew ? 'Created' : 'Updated';
        console.log(`⚡ ${action} Job Cost: ${dbTime}ms (ID: ${req.params.id})`.cyan);

        const statusCode = result.isNew ? 201 : 200;
        const message = result.isNew ? 'Job cost created successfully' : 'Job cost updated successfully';

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, statusCode, message, result.jobCost, null, startTime);
    } catch (error) {
        console.error('❌ updateJobCost error:', error);
        if (error.message === 'documentId is required for new job cost') {
            return errorResponse(res, 400, error.message);
        }
        next(error);
    }
};

// @desc    Complete project - OPTIMIZED with model static method
// @route   PATCH /api/job-costs/:id/complete
// @access  Private
exports.completeProject = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 COMPLEX VALIDATION: Use model static method for multi-document validation
        const updatedJobCost = await JobCost.completeJobAtomic(req.params.id, req.user.id);

        const totalTime = Date.now() - startTime;
        console.log(`⚡ Complete Project: ${totalTime}ms (ID: ${req.params.id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Project completed successfully', updatedJobCost, null, startTime);
    } catch (error) {
        console.error('❌ completeProject error:', error);
        
        // 🔥 CUSTOM ERROR HANDLING: Catch model error messages and return appropriate responses
        if (error.message === 'Job cost not found') {
            return errorResponse(res, 404, 'Job cost not found');
        } else if (error.message === 'Project is already completed') {
            return errorResponse(res, 400, 'Project is already completed');
        } else if (error.message.includes('cost price')) {
            return errorResponse(res, 400, 'All items must have a cost price before completing project');
        } else if (error.message.includes('Invoice must be fully paid')) {
            return errorResponse(res, 400, 'Customer Invoice must be fully paid before completing project');
        } else if (error.message.includes('converted to Invoice')) {
            return errorResponse(res, 400, 'Job must be converted to Invoice and Paid before completion');
        } else if (error.message.includes('Purchase Orders')) {
            return errorResponse(res, 400, 'All linked Purchase Orders must be Invoiced or Paid before completion');
        }
        
        next(error);
    }
};

// @desc    Re-open project (Admin only) - LEAN with atomic operations
// @route   PATCH /api/job-costs/:id/reopen
// @access  Private (Admin)
exports.reopenProject = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // Basic role check (this should also be in route middleware)
        if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
            return errorResponse(res, 403, 'Only admins can re-open projects');
        }

        // 🔥 ATOMIC OPERATION: Use findOneAndUpdate for atomic reopen
        const jobCost = await JobCost.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id, completed: true },
            { $set: { completed: false } },
            { new: true }
        ).lean({ virtuals: true });

        if (!jobCost) {
            return errorResponse(res, 404, 'Job cost not found or not completed');
        }

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Reopen Project: ${dbTime}ms (ID: ${req.params.id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Project re-opened successfully', jobCost, null, startTime);
    } catch (error) {
        console.error('❌ reopenProject error:', error);
        next(error);
    }
};

// @desc    Delete job cost - LEAN with middleware handling sync
// @route   DELETE /api/job-costs/:id
// @access  Private
exports.deleteJobCost = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        const jobCost = await JobCost.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!jobCost) return errorResponse(res, 404, 'Job cost not found');
        
        // 🔥 MIDDLEWARE HANDLES: Dashboard counter decrement automatically
        await jobCost.deleteOne();

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Delete Job Cost: ${dbTime}ms (ID: ${req.params.id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Job cost deleted successfully', null, null, startTime);
    } catch (error) {
        console.error('❌ deleteJobCost error:', error);
        next(error);
    }
};

// OTHER EXPENSES CONTROLLERS

// @desc    Get other expenses for a job cost - OPTIMIZED with lean virtuals
// @route   GET /api/job-costs/:jobCostId/other-expenses
// @access  Private
exports.getOtherExpenses = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
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

        // 🔥 LEAN VIRTUALS: Use lean() with virtuals and select only otherExpenses field
        const jobCost = await JobCost.findOne(query)
            .select('otherExpenses')
            .lean({ virtuals: true });

        if (!jobCost) return errorResponse(res, 404, 'Job cost not found');

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Get Other Expenses: ${dbTime}ms (JobCost: ${req.params.jobCostId})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Other expenses retrieved successfully', jobCost.otherExpenses || [], null, startTime);
    } catch (error) {
        console.error('❌ getOtherExpenses error:', error);
        next(error);
    }
};

// @desc    Add other expense to job cost - OPTIMIZED with model static method
// @route   POST /api/job-costs/:jobCostId/other-expenses
// @access  Private
exports.addOtherExpense = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 ATOMIC EXPENSE ADDITION: Use model static method
        const newExpense = await JobCost.addOtherExpenseAtomic(
            req.params.jobCostId, 
            req.user.id, 
            req.body
        );

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Add Expense: ${dbTime}ms (JobCost: ${req.params.jobCostId})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 201, 'Other expense added successfully', newExpense, null, startTime);
    } catch (error) {
        console.error('❌ addOtherExpense error:', error);
        
        // 🔥 CUSTOM ERROR HANDLING: Catch model error messages
        if (error.message === 'Valid amount is required for expense') {
            return errorResponse(res, 400, 'Valid amount is required for expense');
        } else if (error.message === 'Job cost not found') {
            return errorResponse(res, 404, 'Job cost not found');
        }
        
        next(error);
    }
};

// @desc    Update other expense - OPTIMIZED with model static method
// @route   PUT /api/job-costs/:jobCostId/other-expenses/:expenseId
// @access  Private
exports.updateOtherExpense = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 ATOMIC EXPENSE UPDATE: Use model static method
        const updatedExpense = await JobCost.updateOtherExpenseAtomic(
            req.params.jobCostId, 
            req.user.id, 
            req.params.expenseId,
            req.body
        );

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Update Expense: ${dbTime}ms (Expense: ${req.params.expenseId})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Other expense updated successfully', updatedExpense, null, startTime);
    } catch (error) {
        console.error('❌ updateOtherExpense error:', error);
        
        // 🔥 CUSTOM ERROR HANDLING: Catch model error messages
        if (error.message === 'Job cost or expense not found') {
            return errorResponse(res, 404, 'Job cost or expense not found');
        }
        
        next(error);
    }
};

// @desc    Delete other expense - OPTIMIZED with model static method
// @route   DELETE /api/job-costs/:jobCostId/other-expenses/:expenseId
// @access  Private
exports.deleteOtherExpense = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 ATOMIC EXPENSE DELETION: Use model static method
        await JobCost.deleteOtherExpenseAtomic(
            req.params.jobCostId, 
            req.user.id, 
            req.params.expenseId
        );

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Delete Expense: ${dbTime}ms (Expense: ${req.params.expenseId})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Other expense deleted successfully', null, null, startTime);
    } catch (error) {
        console.error('❌ deleteOtherExpense error:', error);
        
        // 🔥 CUSTOM ERROR HANDLING: Catch model error messages
        if (error.message === 'Job cost not found') {
            return errorResponse(res, 404, 'Job cost not found');
        }
        
        next(error);
    }
};
