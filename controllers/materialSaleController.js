const mongoose = require('mongoose');
const MaterialSale = require('../models/MaterialSale');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { createApiResponse } = require('../utils/commonHelpers');

/**
 * 🔥 LEAN MATERIAL SALE CONTROLLER
 * 
 * This controller follows the "Skinny Controller" pattern:
 * - Business logic moved to MaterialSale model static methods
 * - Dashboard counter sync handled by Mongoose middleware
 * - Controllers focus only on HTTP concerns
 * - Consistent API responses with performance monitoring
 */

// @desc    Get all material sales - OPTIMIZED with model static method
// @route   GET /api/material-sales
// @access  Private
exports.getMaterialSales = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const userId = req.user.id;
        
        // 🔥 LEAN APPROACH: Use model static method for complex query logic
        const result = await MaterialSale.getOptimizedList(userId, req.query);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Material Sales Query: ${dbTime}ms (${result.materialSales.length}/${result.pagination.total} sales, page ${result.pagination.page})`.cyan);

        if (dbTime > 200) {
            console.log(`⚠️ Slow material sales query detected: ${dbTime}ms`.yellow);
        }

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper for standardized responses
        return createApiResponse(
            res, 
            200, 
            'Material sales retrieved successfully', 
            result.materialSales,
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
        console.error('❌ getMaterialSales error:', error);
        next(error);
    }
};

// @desc    Get single material sale - OPTIMIZED with lean virtuals
// @route   GET /api/material-sales/:id
// @access  Private
exports.getMaterialSale = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 LEAN VIRTUALS: Use lean() with virtuals for memory optimization + virtual fields
        const materialSale = await MaterialSale.findOne({
            _id: req.params.id,
            user: req.user.id,
        }).lean({ virtuals: true });

        if (!materialSale) return errorResponse(res, 404, 'Material sale not found');

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Get Material Sale: ${dbTime}ms (ID: ${req.params.id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Material sale retrieved successfully', materialSale, null, startTime);
    } catch (error) {
        console.error('❌ getMaterialSale error:', error);
        next(error);
    }
};

// @desc    Create material sale - LEAN with middleware handling sync
// @route   POST /api/material-sales
// @access  Private
exports.createMaterialSale = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const userId = req.user.id;
        
        // 🔥 ATOMIC ID GENERATION: Use model static method with retry logic
        const materialSale = await MaterialSale.createNewWithAtomicId(userId, req.body);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Create Material Sale: ${dbTime}ms (Invoice: ${materialSale.invoiceNumber})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 201, 'Material sale created successfully', materialSale, null, startTime);
    } catch (error) {
        console.error('❌ createMaterialSale error:', error);
        if (error.message.includes('invoice number collisions')) {
            return errorResponse(res, 500, 'Failed to generate unique invoice number after multiple attempts');
        } else if (error.code === 11000) {
            return errorResponse(res, 400, 'Invoice number already exists');
        }
        next(error);
    }
};

// @desc    Update material sale - LEAN with middleware handling sync
// @route   PUT /api/material-sales/:id
// @access  Private
exports.updateMaterialSale = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 LEAN VIRTUALS: Use atomic findOneAndUpdate with lean virtuals
        const materialSale = await MaterialSale.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id },
            req.body,
            { new: true, runValidators: true }
        ).lean({ virtuals: true });

        if (!materialSale) return errorResponse(res, 404, 'Material sale not found');

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Update Material Sale: ${dbTime}ms (ID: ${req.params.id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Material sale updated successfully', materialSale, null, startTime);
    } catch (error) {
        console.error('❌ updateMaterialSale error:', error);
        next(error);
    }
};

// @desc    Add payment - OPTIMIZED with atomic operations
// @route   POST /api/material-sales/:id/payments
// @access  Private
exports.addPayment = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 ATOMIC PAYMENT ADDITION: Use model static method
        const updatedMaterialSale = await MaterialSale.addPaymentAtomic(
            req.params.id, 
            req.user.id, 
            req.body
        );

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Add Payment: ${dbTime}ms (MaterialSale: ${req.params.id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Payment added successfully', updatedMaterialSale, null, startTime);
    } catch (error) {
        console.error('❌ addPayment error:', error);
        if (error.message === 'Material sale not found') {
            return errorResponse(res, 404, 'Material sale not found');
        }
        next(error);
    }
};

// @desc    Update status - OPTIMIZED with atomic operations
// @route   PATCH /api/material-sales/:id/status
// @access  Private
exports.updateStatus = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { status } = req.body;
        
        if (!status) return errorResponse(res, 400, 'Please provide a status');

        // 🔥 ATOMIC STATUS UPDATE: Use model static method
        const updatedMaterialSale = await MaterialSale.updateStatusAtomic(
            req.params.id, 
            req.user.id, 
            status
        );

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Update Status: ${dbTime}ms (MaterialSale: ${req.params.id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Status updated successfully', updatedMaterialSale, null, startTime);
    } catch (error) {
        console.error('❌ updateStatus error:', error);
        if (error.message === 'Material sale not found') {
            return errorResponse(res, 404, 'Material sale not found');
        }
        next(error);
    }
};

// @desc    Delete material sale - LEAN with middleware handling sync
// @route   DELETE /api/material-sales/:id
// @access  Private
exports.deleteMaterialSale = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        const materialSale = await MaterialSale.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!materialSale) return errorResponse(res, 404, 'Material sale not found');
        
        // 🔥 MIDDLEWARE HANDLES: Dashboard counter decrement automatically
        await materialSale.deleteOne();

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Delete Material Sale: ${dbTime}ms (ID: ${req.params.id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Material sale deleted successfully', null, null, startTime);
    } catch (error) {
        console.error('❌ deleteMaterialSale error:', error);
        next(error);
    }
};

// @desc    Search customer by phone number - LEAN implementation
// @route   GET /api/material-sales/search-customer
// @access  Private
exports.searchCustomerByPhone = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { phone } = req.query;

        if (!phone) {
            return errorResponse(res, 400, 'Phone number is required');
        }

        // TODO: Replace with actual Customer model when implemented
        // For now, return mock data based on phone number
        const mockCustomers = {
            '0771234567': {
                name: 'John Smith',
                address: '456 Oak Street, Colombo 05',
                phone: '0771234567'
            },
            '0772345678': {
                name: 'Sarah Johnson',
                address: '789 Pine Avenue, Colombo 03',
                phone: '0772345678'
            },
            '0773456789': {
                name: 'Mike Wilson',
                address: '321 Elm Road, Colombo 07',
                phone: '0773456789'
            },
            '0711234567': {
                name: 'Priya Fernando',
                address: '123 Lotus Lane, Nugegoda',
                phone: '0711234567'
            },
            '0769876543': {
                name: 'Rajesh Kumar',
                address: '456 Temple Road, Kandy',
                phone: '0769876543'
            },
        };

        const customer = mockCustomers[phone];

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        if (customer) {
            return createApiResponse(res, 200, 'Customer found', customer, null, startTime);
        } else {
            return createApiResponse(res, 200, 'Customer not found', null, null, startTime);
        }
    } catch (error) {
        console.error('❌ searchCustomerByPhone error:', error);
        next(error);
    }
};
