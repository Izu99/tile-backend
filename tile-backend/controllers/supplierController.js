const Supplier = require('../models/Supplier');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseHandler');

// @desc    Get all suppliers
// @route   GET /api/suppliers
// @access  Private
exports.getSuppliers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        // Build query
        const query = { user: req.user.id };

        // Search functionality
        if (req.query.search) {
            query.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { categories: { $regex: req.query.search, $options: 'i' } },
                { phone: { $regex: req.query.search, $options: 'i' } },
            ];
        }

        // Category filter
        if (req.query.category) {
            query.categories = { $in: [req.query.category] };
        }

        // Get total count
        const total = await Supplier.countDocuments(query);

        // Get suppliers
        const suppliers = await Supplier.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return paginatedResponse(
            res,
            200,
            'Suppliers retrieved successfully',
            suppliers,
            {
                total,
                page,
                pages: Math.ceil(total / limit),
                limit,
            }
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Get single supplier
// @route   GET /api/suppliers/:id
// @access  Private
exports.getSupplier = async (req, res, next) => {
    try {
        const supplier = await Supplier.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!supplier) {
            return errorResponse(res, 404, 'Supplier not found');
        }

        return successResponse(res, 200, 'Supplier retrieved successfully', supplier);
    } catch (error) {
        next(error);
    }
};

// @desc    Create supplier
// @route   POST /api/suppliers
// @access  Private
exports.createSupplier = async (req, res, next) => {
    try {
        // Add user to req.body
        req.body.user = req.user.id;

        const supplier = await Supplier.create(req.body);

        return successResponse(res, 201, 'Supplier created successfully', supplier);
    } catch (error) {
        next(error);
    }
};

// @desc    Update supplier
// @route   PUT /api/suppliers/:id
// @access  Private
exports.updateSupplier = async (req, res, next) => {
    try {
        let supplier = await Supplier.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!supplier) {
            return errorResponse(res, 404, 'Supplier not found');
        }

        supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        return successResponse(res, 200, 'Supplier updated successfully', supplier);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete supplier
// @route   DELETE /api/suppliers/:id
// @access  Private
exports.deleteSupplier = async (req, res, next) => {
    try {
        const supplier = await Supplier.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!supplier) {
            return errorResponse(res, 404, 'Supplier not found');
        }

        await supplier.deleteOne();

        return successResponse(res, 200, 'Supplier deleted successfully', null);
    } catch (error) {
        next(error);
    }
};
