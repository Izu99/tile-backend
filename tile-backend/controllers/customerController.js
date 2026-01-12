const Customer = require('../models/Customer');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// @desc    Search customer by phone number
// @route   GET /api/customers/search
// @access  Private
exports.searchCustomer = async (req, res, next) => {
    try {
        const { phone } = req.query;

        if (!phone) {
            return errorResponse(res, 400, 'Phone number is required');
        }

        // Search for customer by phone number for this user
        const customer = await Customer.findOne({
            phone: phone.trim(),
            user: req.user.id,
        });

        if (customer) {
            return successResponse(res, 200, 'Customer found', customer);
        } else {
            return successResponse(res, 200, 'Customer not found', null);
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new customer
// @route   POST /api/customers
// @access  Private
exports.createCustomer = async (req, res, next) => {
    try {
        req.body.user = req.user.id;

        const customer = await Customer.create(req.body);
        return successResponse(res, 201, 'Customer created successfully', customer);
    } catch (error) {
        // Handle duplicate phone number error
        if (error.code === 11000) {
            return errorResponse(res, 400, 'A customer with this phone number already exists');
        }
        next(error);
    }
};

// @desc    Get all customers (with pagination)
// @route   GET /api/customers
// @access  Private
exports.getCustomers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        const query = { user: req.user.id };

        if (req.query.search) {
            query.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { phone: { $regex: req.query.search, $options: 'i' } },
            ];
        }

        const total = await Customer.countDocuments(query);
        const customers = await Customer.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return res.status(200).json({
            success: true,
            count: customers.length,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            data: customers,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
exports.updateCustomer = async (req, res, next) => {
    try {
        let customer = await Customer.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!customer) {
            return errorResponse(res, 404, 'Customer not found');
        }

        customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        return successResponse(res, 200, 'Customer updated successfully', customer);
    } catch (error) {
        // Handle duplicate phone number error
        if (error.code === 11000) {
            return errorResponse(res, 400, 'A customer with this phone number already exists');
        }
        next(error);
    }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private
exports.deleteCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!customer) {
            return errorResponse(res, 404, 'Customer not found');
        }

        await customer.deleteOne();
        return successResponse(res, 200, 'Customer deleted successfully');
    } catch (error) {
        next(error);
    }
};
