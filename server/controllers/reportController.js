const mongoose = require('mongoose');
const QuotationDocument = require('../models/QuotationDocument');
const { errorResponse } = require('../utils/responseHandler');
const { 
    createPaginationParams, 
    createApiResponse
} = require('../utils/commonHelpers');

// @desc    Get project profitability report data - REFACTORED to use model static methods
// @route   GET /api/reports/projects
// @access  Private
exports.getProjectReport = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { page, limit } = createPaginationParams(req.query, 15);

        // Build filters object
        const filters = {
            status: req.query.status,
            type: req.query.type,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        // Use model's optimized method
        const result = await QuotationDocument.getProjectReportOptimized(
            req.user.id, 
            { page, limit, ...filters }
        );

        return createApiResponse(
            res,
            200,
            'Project report data retrieved successfully',
            result.projects,
            result.pagination,
            startTime
        );
    } catch (error) {
        console.error('❌ getProjectReport error:', error);
        next(error);
    }
};

// @desc    Get invoice summary report data - REFACTORED to use model static methods
// @route   GET /api/reports/invoices
// @access  Private
exports.getInvoiceReport = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { page, limit } = createPaginationParams(req.query, 15);

        // Build filters object
        const filters = {
            status: req.query.status,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        // Use model's optimized method
        const result = await QuotationDocument.getInvoiceReportOptimized(
            req.user.id,
            { page, limit, ...filters }
        );

        return createApiResponse(
            res,
            200,
            'Invoice report data retrieved successfully',
            result.invoices,
            result.pagination,
            startTime
        );
    } catch (error) {
        console.error('❌ getInvoiceReport error:', error);
        next(error);
    }
};

// @desc    Get dashboard summary data - REFACTORED to use model static methods
// @route   GET /api/reports/dashboard
// @access  Private
exports.getDashboardSummary = async (req, res, next) => {
    try {
        const startTime = Date.now();

        // Use model's optimized method
        const summary = await QuotationDocument.getDashboardSummaryOptimized(req.user.id);

        return createApiResponse(
            res,
            200,
            'Dashboard summary retrieved successfully',
            summary,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ getDashboardSummary error:', error);
        next(error);
    }
};

// @desc    Add direct cost to a project - REFACTORED to use model static methods
// @route   POST /api/reports/:documentId/costs
// @access  Private
exports.addDirectCost = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { category, description, amount, date, vendor } = req.body;

        const costData = {
            category,
            description,
            amount,
            date: date ? new Date(date) : new Date(),
            vendor: vendor || ''
        };

        // Use model's atomic method
        const updatedDocument = await QuotationDocument.addDirectCostAtomic(
            req.params.documentId,
            req.user.id,
            costData
        );

        return createApiResponse(
            res,
            200,
            'Direct cost added successfully',
            updatedDocument,
            null,
            startTime
        );
    } catch (error) {
        if (error.message === 'Document not found') {
            return errorResponse(res, 404, error.message);
        }
        console.error('❌ addDirectCost error:', error);
        next(error);
    }
};

// @desc    Get material sales report data - REFACTORED to use model static methods
// @route   GET /api/reports/material-sales
// @access  Private
exports.getMaterialSalesReport = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { page, limit } = createPaginationParams(req.query, 15);

        // Build filters object
        const filters = {
            status: req.query.status,
            startDate: req.query.startDate,
            endDate: req.query.endDate
        };

        // Use model's optimized method
        const result = await QuotationDocument.getMaterialSalesReportOptimized(
            req.user.id,
            { page, limit, ...filters }
        );

        return createApiResponse(
            res,
            200,
            'Material sales report data retrieved successfully',
            result.materialSales,
            result.pagination,
            startTime
        );
    } catch (error) {
        console.error('❌ getMaterialSalesReport error:', error);
        next(error);
    }
};

// @desc    Update project status - REFACTORED to use model static methods
// @route   PATCH /api/reports/:documentId/project-status
// @access  Private
exports.updateProjectStatus = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { projectStatus, actualCompletionDate } = req.body;

        const updateData = {
            projectStatus,
            ...(actualCompletionDate && { actualCompletionDate: new Date(actualCompletionDate) })
        };

        // Use model's atomic method
        const updatedDocument = await QuotationDocument.updateProjectStatusAtomic(
            req.params.documentId,
            req.user.id,
            updateData
        );

        return createApiResponse(
            res,
            200,
            'Project status updated successfully',
            updatedDocument,
            null,
            startTime
        );
    } catch (error) {
        if (error.message === 'Document not found') {
            return errorResponse(res, 404, error.message);
        }
        console.error('❌ updateProjectStatus error:', error);
        next(error);
    }
};