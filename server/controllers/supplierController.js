const Supplier = require('../models/Supplier');
const { errorResponse } = require('../utils/responseHandler');
const { createApiResponse } = require('../utils/commonHelpers');

// Import cache clearing function from Dashboard Controller
const { clearCompanyDashboardCache } = require('./dashboardController');

/**
 * 🔥 SKINNY SUPPLIER CONTROLLER
 * 
 * This controller follows the Skinny Controller pattern by:
 * - Delegating all business logic to Supplier model static methods
 * - Using standardized API responses across all endpoints
 * - Leveraging automatic dashboard synchronization via middleware
 * - Maintaining security and performance optimizations
 */

// @desc    Get all suppliers - REFACTORED to use model static methods
// @route   GET /api/suppliers
// @access  Private
exports.getSuppliers = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // Parse query parameters
        const options = {
            page: parseInt(req.query.page, 10) || 1,
            limit: parseInt(req.query.limit, 10) || 10,
            search: req.query.search,
            category: req.query.category
        };

        // Use model's optimized static method
        const result = await Supplier.getSuppliersOptimized(req.user.id, options);

        return createApiResponse(
            res,
            200,
            'Suppliers retrieved successfully',
            result.suppliers,
            result.pagination,
            startTime
        );
    } catch (error) {
        console.error('❌ getSuppliers error:', error);
        next(error);
    }
};

// @desc    Get single supplier - REFACTORED to use model static methods
// @route   GET /api/suppliers/:id
// @access  Private
exports.getSupplier = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // Use model's static method for secure retrieval
        const supplier = await Supplier.getSupplierByIdSecure(req.params.id, req.user.id);

        if (!supplier) {
            return errorResponse(res, 404, 'Supplier not found');
        }

        return createApiResponse(
            res,
            200,
            'Supplier retrieved successfully',
            supplier,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ getSupplier error:', error);
        next(error);
    }
};

// @desc    Create supplier - REFACTORED to use model static methods
// @route   POST /api/suppliers
// @access  Private
exports.createSupplier = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // Use model's atomic creation method
        const supplier = await Supplier.createSupplierAtomic(
            { ...req.body, user: req.user.id },
            () => clearCompanyDashboardCache(req.user.id)
        );

        return createApiResponse(
            res,
            201,
            'Supplier created successfully',
            supplier,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ createSupplier error:', error);
        
        // Handle duplicate supplier name error
        if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
            return errorResponse(
                res,
                400,
                `A supplier with the name "${error.keyValue.name}" already exists. Please use a different name.`
            );
        }
        next(error);
    }
};

// @desc    Update supplier - REFACTORED to use model static methods
// @route   PUT /api/suppliers/:id
// @access  Private
exports.updateSupplier = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // Use model's atomic update method
        const updatedSupplier = await Supplier.updateSupplierAtomic(
            req.params.id,
            req.user.id,
            req.body
        );

        if (!updatedSupplier) {
            return errorResponse(res, 404, 'Supplier not found');
        }

        return createApiResponse(
            res,
            200,
            'Supplier updated successfully',
            updatedSupplier,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ updateSupplier error:', error);
        next(error);
    }
};

// @desc    Delete supplier - REFACTORED to use model static methods
// @route   DELETE /api/suppliers/:id
// @access  Private
exports.deleteSupplier = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // Use model's atomic deletion method
        const deletedSupplier = await Supplier.deleteSupplierAtomic(
            req.params.id,
            req.user.id,
            () => clearCompanyDashboardCache(req.user.id)
        );

        if (!deletedSupplier) {
            return errorResponse(res, 404, 'Supplier not found');
        }

        return createApiResponse(
            res,
            200,
            'Supplier deleted successfully',
            null,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ deleteSupplier error:', error);
        next(error);
    }
};
