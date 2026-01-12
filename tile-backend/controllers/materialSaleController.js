const MaterialSale = require('../models/MaterialSale');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/responseHandler');
const { generateNumericId } = require('../utils/idGenerator');

// @desc    Get all material sales
// @route   GET /api/material-sales
// @access  Private
exports.getMaterialSales = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        const query = { user: req.user.id };

        if (req.query.status) query.status = req.query.status;
        if (req.query.search) {
            query.customerName = { $regex: req.query.search, $options: 'i' };
        }

        if (req.query.startDate || req.query.endDate) {
            query.saleDate = {};
            if (req.query.startDate) query.saleDate.$gte = new Date(req.query.startDate);
            if (req.query.endDate) query.saleDate.$lte = new Date(req.query.endDate);
        }

        const total = await MaterialSale.countDocuments(query);
        console.log(`📊 MATERIAL SALES BACKEND: Sorting by createdAt DESC (newest first)`);
        console.log(`📊 MATERIAL SALES BACKEND: Page ${page}, Limit ${limit}, Skip ${skip}, Total ${total}`);

        const materialSales = await MaterialSale.find(query)
            .sort({ createdAt: -1 }) // Newest records first
            .skip(skip)
            .limit(limit);

        // Debug: Log creation dates to verify sorting
        if (materialSales.length > 0) {
            console.log(`📊 MATERIAL SALES BACKEND: First record createdAt: ${materialSales[0].createdAt}`);
            console.log(`📊 MATERIAL SALES BACKEND: Last record createdAt: ${materialSales[materialSales.length - 1].createdAt}`);
        }

        return paginatedResponse(res, 200, 'Material sales retrieved successfully', materialSales, {
            total, page, pages: Math.ceil(total / limit), limit,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single material sale
// @route   GET /api/material-sales/:id
// @access  Private
exports.getMaterialSale = async (req, res, next) => {
    try {
        const materialSale = await MaterialSale.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!materialSale) return errorResponse(res, 404, 'Material sale not found');
        return successResponse(res, 200, 'Material sale retrieved successfully', materialSale);
    } catch (error) {
        next(error);
    }
};

// @desc    Create material sale
// @route   POST /api/material-sales
// @access  Private
exports.createMaterialSale = async (req, res, next) => {
    try {
        req.body.user = req.user.id;
        if (!req.body.invoiceNumber) {
            req.body.invoiceNumber = await generateNumericId(MaterialSale, 'invoiceNumber');
        }

        // Calculate due date for material sales: dueDate = saleDate + paymentTerms
        if (req.body.saleDate && req.body.paymentTerms) {
            const saleDate = new Date(req.body.saleDate);
            const paymentTerms = req.body.paymentTerms || 30;
            const dueDate = new Date(saleDate.getTime());
            dueDate.setDate(saleDate.getDate() + paymentTerms);
            req.body.dueDate = dueDate;
        }

        const materialSale = await MaterialSale.create(req.body);
        return successResponse(res, 201, 'Material sale created successfully', materialSale);
    } catch (error) {
        next(error);
    }
};

// @desc    Update material sale
// @route   PUT /api/material-sales/:id
// @access  Private
exports.updateMaterialSale = async (req, res, next) => {
    try {
        let materialSale = await MaterialSale.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!materialSale) return errorResponse(res, 404, 'Material sale not found');

        materialSale = await MaterialSale.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        return successResponse(res, 200, 'Material sale updated successfully', materialSale);
    } catch (error) {
        next(error);
    }
};

// @desc    Add payment
// @route   POST /api/material-sales/:id/payments
// @access  Private
exports.addPayment = async (req, res, next) => {
    try {
        const materialSale = await MaterialSale.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!materialSale) return errorResponse(res, 404, 'Material sale not found');

        materialSale.paymentHistory.push(req.body);

        // Auto-update status
        const totalPaid = materialSale.paymentHistory.reduce((sum, p) => sum + p.amount, 0);
        const totalAmount = materialSale.items.reduce((sum, item) => sum + item.amount, 0);

        if (totalPaid >= totalAmount) {
            materialSale.status = 'paid';
        } else if (totalPaid > 0) {
            materialSale.status = 'partial';
        } else {
            materialSale.status = 'pending';
        }

        await materialSale.save();

        return successResponse(res, 200, 'Payment added successfully', materialSale);
    } catch (error) {
        next(error);
    }
};

// @desc    Update status
// @route   PATCH /api/material-sales/:id/status
// @access  Private
exports.updateStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!status) return errorResponse(res, 400, 'Please provide a status');

        let materialSale = await MaterialSale.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!materialSale) return errorResponse(res, 404, 'Material sale not found');

        materialSale.status = status;
        await materialSale.save();

        return successResponse(res, 200, 'Status updated successfully', materialSale);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete material sale
// @route   DELETE /api/material-sales/:id
// @access  Private
exports.deleteMaterialSale = async (req, res, next) => {
    try {
        const materialSale = await MaterialSale.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

        if (!materialSale) return errorResponse(res, 404, 'Material sale not found');
        await materialSale.deleteOne();

        return successResponse(res, 200, 'Material sale deleted successfully', null);
    } catch (error) {
        next(error);
    }
};

// @desc    Search customer by phone number
// @route   GET /api/material-sales/search-customer
// @access  Private
exports.searchCustomerByPhone = async (req, res, next) => {
    try {
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

        if (customer) {
            return successResponse(res, 200, 'Customer found', customer);
        } else {
            return successResponse(res, 200, 'Customer not found', null);
        }
    } catch (error) {
        next(error);
    }
};
