const Customer = require('../models/Customer');
const { successResponse, errorResponse } = require('../utils/responseHandler');
const { createApiResponse } = require('../utils/commonHelpers');

/**
 * 🔥 LEAN CUSTOMER CONTROLLER
 * 
 * This controller follows the "Skinny Controller" pattern:
 * - Business logic moved to Customer model static methods
 * - Controllers focus only on HTTP concerns
 * - Consistent API responses with performance monitoring
 * - Multi-tenant data integrity handled by model layer
 */

// @desc    Search customer by phone number - OPTIMIZED with model static method
// @route   GET /api/customers/search
// @access  Private
exports.searchCustomer = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { phone } = req.query;

        if (!phone) {
            return errorResponse(res, 400, 'Phone number is required');
        }

        // 🔥 LEAN APPROACH: Use model static method for business logic
        const customer = await Customer.searchByPhone(phone, req.user.id);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Customer Search: ${dbTime}ms (phone: ${phone})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        if (customer) {
            return createApiResponse(res, 200, 'Customer found', customer, null, startTime);
        } else {
            return createApiResponse(res, 200, 'Customer not found', null, null, startTime);
        }
    } catch (error) {
        console.error('❌ searchCustomer error:', error);
        next(error);
    }
};

// @desc    Create a new customer - LEAN with model static method
// @route   POST /api/customers
// @access  Private
exports.createCustomer = async (req, res, next) => {
    try {
        const startTime = Date.now();
        req.body.user = req.user.id;

        // 🔥 BUSINESS LOGIC: Use model static method for creation with validation
        const customer = await Customer.createCustomer(req.body);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Create Customer: ${dbTime}ms (ID: ${customer._id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 201, 'Customer created successfully', customer, null, startTime);
    } catch (error) {
        console.error('❌ createCustomer error:', error);
        
        // 🔥 CUSTOM ERROR HANDLING: Catch model error messages
        if (error.message === 'A customer with this phone number already exists') {
            return errorResponse(res, 400, error.message);
        }
        
        next(error);
    }
};

// @desc    Get all customers - OPTIMIZED with model static method
// @route   GET /api/customers
// @access  Private
exports.getCustomers = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const userId = req.user.id;
        
        // 🔥 SKINNY CONTROLLER: Use model static method for all query logic
        const result = await Customer.getOptimizedList(userId, req.query);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Customers Query: ${dbTime}ms (${result.customers.length}/${result.pagination.total} customers, page ${result.pagination.page})`.cyan);
        
        if (dbTime > 100) {
            console.log(`⚠️ Slow customer query detected: ${dbTime}ms`.yellow);
        }

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper for standardized responses
        return createApiResponse(
            res, 
            200, 
            'Customers retrieved successfully', 
            result.customers,
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
        console.error('❌ getCustomers error:', error);
        next(error);
    }
};

// @desc    Update customer - OPTIMIZED with model static method
// @route   PUT /api/customers/:id
// @access  Private
exports.updateCustomer = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 ATOMIC OPERATION: Use model static method for atomic update
        const customer = await Customer.updateCustomerAtomic(req.params.id, req.user.id, req.body);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Customer Update: ${dbTime}ms (ID: ${req.params.id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Customer updated successfully', customer, null, startTime);
    } catch (error) {
        console.error('❌ updateCustomer error:', error);
        
        // 🔥 CUSTOM ERROR HANDLING: Catch model error messages
        if (error.message === 'Customer not found') {
            return errorResponse(res, 404, 'Customer not found');
        } else if (error.message === 'A customer with this phone number already exists') {
            return errorResponse(res, 400, error.message);
        }
        
        next(error);
    }
};

// @desc    Delete customer - OPTIMIZED with model static method
// @route   DELETE /api/customers/:id
// @access  Private
exports.deleteCustomer = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 ATOMIC OPERATION: Use model static method for atomic deletion
        await Customer.deleteCustomerAtomic(req.params.id, req.user.id);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Customer Delete: ${dbTime}ms (ID: ${req.params.id})`.cyan);

        // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
        return createApiResponse(res, 200, 'Customer deleted successfully', null, null, startTime);
    } catch (error) {
        console.error('❌ deleteCustomer error:', error);
        
        // 🔥 CUSTOM ERROR HANDLING: Catch model error messages
        if (error.message === 'Customer not found') {
            return errorResponse(res, 404, 'Customer not found');
        }
        
        next(error);
    }
};