const User = require('../models/User');
const Category = require('../models/Category');
const ActivityLog = require('../models/ActivityLog');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// Unit configurations
const UNIT_CONFIGS = {
    service_units: ['sqft', 'ft', 'Job', 'Visit', 'Day'],
    product_units: ['sqft', 'ft', 'pcs', 'kg', 'm']
};

// Default pricing logic based on base unit
const getDefaultPricingType = (baseUnit, isService) => {
    if (!isService) return null; // Products don't have pricing type

    // Service pricing logic
    if (['sqft', 'ft'].includes(baseUnit)) {
        return 'variable'; // Area-based services default to variable pricing
    } else if (['Job', 'Visit'].includes(baseUnit)) {
        return 'fixed'; // One-time services default to fixed pricing
    }

    return 'variable'; // Default fallback
};

// @desc    Get unit configurations and defaults for item creation
// @route   GET /api/super-admin/item-configs
// @access  Private/SuperAdmin
exports.getItemConfigs = async (req, res) => {
    try {
        const data = {
            unit_configs: UNIT_CONFIGS,
            default_pricing_logic: {
                description: "Default pricing type based on base unit selection",
                rules: [
                    { units: ['sqft', 'ft'], default_pricing: 'variable', description: 'Area-based services default to variable pricing' },
                    { units: ['Job', 'Visit'], default_pricing: 'fixed', description: 'One-time services default to fixed pricing' },
                    { units: ['Day'], default_pricing: 'variable', description: 'Time-based services default to variable pricing' }
                ]
            }
        };

        return successResponse(res, 200, 'Item configurations retrieved successfully', data);
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Get dashboard stats
// @route   GET /api/super-admin/dashboard/stats
// @access  Private/SuperAdmin
exports.getDashboardStats = async (req, res) => {
    try {
        const totalCompanies = await User.countDocuments({ role: 'company' });
        const activeCompanies = await User.countDocuments({ role: 'company', isActive: true });
        const inactiveCompanies = await User.countDocuments({ role: 'company', isActive: false });

        // Only count categories from active companies
        const activeCompanyIds = await User.find({ role: 'company', isActive: true }).select('_id');
        const activeCompanyIdStrings = activeCompanyIds.map(user => user._id.toString());
        const totalCategories = await Category.countDocuments({ companyId: { $in: activeCompanyIdStrings } });

        // Recent activity
        const recentActivity = await ActivityLog.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('performedBy', 'name');

        // Recent companies
        const recentCompanies = await User.find({ role: 'company' })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('name email role isActive createdAt companyName companyPhone');

        // Get total items and services counts (only from active companies)
        const categoriesFromActiveCompanies = await Category.find({ companyId: { $in: activeCompanyIdStrings } });
        let totalItems = 0; // Only non-service items (products)
        let totalServices = 0; // Only service items

        console.log(`Found ${categoriesFromActiveCompanies.length} categories from active companies for dashboard stats`);

        categoriesFromActiveCompanies.forEach(category => {
            console.log(`Category "${category.name}" (${category.companyId}): ${category.items.length} items`);
            category.items.forEach(item => {
                if (item.isService) {
                    totalServices++;
                    console.log(`  - Service: ${item.itemName}, isService: ${item.isService}`);
                } else {
                    totalItems++;
                    console.log(`  - Product: ${item.itemName}, isService: ${item.isService}`);
                }
            });
        });

        console.log(`Total calculation: ${totalItems} items, ${totalServices} services`);

        const data = {
            stats: {
                totalCompanies,
                activeCompanies,
                inactiveCompanies,
                totalCategories,
                totalItems,
                totalServices
            },
            recentActivity,
            recentCompanies
        };

        return successResponse(res, 200, 'Dashboard stats retrieved successfully', data);
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Get all companies
// @route   GET /api/super-admin/companies
// @access  Private/SuperAdmin
exports.getAllCompanies = async (req, res) => {
    try {
        const { search } = req.query;
        let query = { role: 'company' };

        if (search) {
            query.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { name: { $regex: search, $options: 'i' } }, // Owner name
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const companies = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 });

        // Transform to match frontend CompanyModel if needed, but standard User object is likely fine
        // Frontend CompanyModel: id, companyName, companyAddress, companyPhone, ownerName, ownerEmail, ownerPhone, isActive
        // Backend User: _id, companyName, companyAddress, companyPhone, name, email, phone, isActive

        const transformedCompanies = companies.map(user => ({
            id: user._id,
            companyName: user.companyName,
            companyAddress: user.companyAddress,
            companyPhone: user.companyPhone,
            ownerName: user.name,
            ownerEmail: user.email,
            ownerPhone: user.phone,
            isActive: user.isActive,
            createdAt: user.createdAt
        }));

        return successResponse(res, 200, 'Companies retrieved successfully', transformedCompanies);
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Create new company (Register User)
// @route   POST /api/super-admin/companies
// @access  Private/SuperAdmin
exports.createCompany = async (req, res) => {
    try {
        const {
            name, email, password, phone,
            companyName, companyAddress, companyPhone
        } = req.body;

        const userExists = await User.findOne({ email });

        if (userExists) {
            return errorResponse(res, 400, 'User already exists');
        }

        const user = await User.create({
            name,
            email,
            password,
            phone,
            companyName,
            companyAddress,
            companyPhone,
            role: 'company',
            isActive: true
        });

        // Log activity
        await ActivityLog.create({
            action: 'CREATE_COMPANY',
            description: `New company registered: ${companyName}`,
            performedBy: req.user.id,
            targetId: user._id
        });

        const company = {
            id: user._id,
            companyName: user.companyName,
            companyAddress: user.companyAddress,
            companyPhone: user.companyPhone,
            ownerName: user.name,
            ownerEmail: user.email,
            ownerPhone: user.phone,
            isActive: user.isActive,
            createdAt: user.createdAt
        };

        return successResponse(res, 201, 'Company created successfully', company);
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Update company
// @route   PUT /api/super-admin/companies/:id
// @access  Private/SuperAdmin
exports.updateCompany = async (req, res) => {
    try {
        const {
            name, email, phone,
            companyName, companyAddress, companyPhone,
            isActive
        } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {
            return errorResponse(res, 404, 'Company not found');
        }

        // Update fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        if (companyName) user.companyName = companyName;
        if (companyAddress) user.companyAddress = companyAddress;
        if (companyPhone) user.companyPhone = companyPhone;
        if (typeof isActive === 'boolean') user.isActive = isActive;

        await user.save();

        // Log activity
        await ActivityLog.create({
            action: 'UPDATE_COMPANY',
            description: `Company updated: ${user.companyName}`,
            performedBy: req.user.id,
            targetId: user._id
        });

        const company = {
            id: user._id,
            companyName: user.companyName,
            companyAddress: user.companyAddress,
            companyPhone: user.companyPhone,
            ownerName: user.name,
            ownerEmail: user.email,
            ownerPhone: user.phone,
            isActive: user.isActive,
            createdAt: user.createdAt
        };

        return successResponse(res, 200, 'Company updated successfully', company);
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Delete company
// @route   DELETE /api/super-admin/companies/:id
// @access  Private/SuperAdmin
exports.deleteCompany = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return errorResponse(res, 404, 'Company not found');
        }

        const companyName = user.companyName;
        await user.deleteOne();

        // Delete associated categories
        const deletedCategories = await Category.deleteMany({ companyId: req.params.id });
        console.log(`Deleted ${deletedCategories.deletedCount} categories for company ${req.params.id}`);

        // Log activity
        await ActivityLog.create({
            action: 'DELETE_COMPANY',
            description: `Company deleted: ${companyName}`,
            performedBy: req.user.id
        });

        return successResponse(res, 200, 'Company deleted successfully');
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Get categories for a company
// @route   GET /api/super-admin/companies/:companyId/categories
// @access  Private/SuperAdmin
exports.getCompanyCategories = async (req, res) => {
    try {
        const { companyId } = req.params;
        const categories = await Category.find({ companyId });

        // Transform for frontend
        const transformedCategories = categories.map(cat => ({
            id: cat._id,
            name: cat.name,
            companyId: cat.companyId,
            items: cat.items.map(item => ({
                id: item._id,
                itemName: item.itemName,
                baseUnit: item.baseUnit,
                packagingUnit: item.packagingUnit,
                sqftPerUnit: item.sqftPerUnit,
                isService: item.isService,
                pricingType: item.pricingType,
                categoryId: cat._id
            }))
        }));

        return successResponse(res, 200, 'Categories retrieved successfully', transformedCategories);
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Create category for a company
// @route   POST /api/super-admin/categories
// @access  Private/SuperAdmin
exports.createCategory = async (req, res) => {
    try {
        const { name, companyId } = req.body;

        const category = await Category.create({
            name,
            companyId
        });

        // Log activity
        await ActivityLog.create({
            action: 'CREATE_CATEGORY',
            description: `New category created: ${name}`,
            performedBy: req.user.id,
            targetId: category._id
        });

        const transformed = {
            id: category._id,
            name: category.name,
            companyId: category.companyId,
            items: []
        };

        return successResponse(res, 201, 'Category created successfully', transformed);
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Update category
// @route   PUT /api/super-admin/categories/:id
// @access  Private/SuperAdmin
exports.updateCategory = async (req, res) => {
    try {
        const { name, items } = req.body; // items might be passed to replace all items?

        const category = await Category.findById(req.params.id);
        if (!category) {
            return errorResponse(res, 404, 'Category not found');
        }

        if (name) category.name = name;
        // If items are passed, we could update them, but usually items are managed separately?
        // The frontend CompanySetupScreen seems to manage items via ItemTemplateDialog.
        // Let's assume there are endpoints for items, or we update the whole category.

        await category.save();

        // Log activity
        await ActivityLog.create({
            action: 'UPDATE_CATEGORY',
            description: `Category updated: ${category.name}`,
            performedBy: req.user.id,
            targetId: category._id
        });

        return successResponse(res, 200, 'Category updated successfully', {
            id: category._id,
            name: category.name,
            companyId: category.companyId,
            items: category.items
        });
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Delete category
// @route   DELETE /api/super-admin/categories/:id
// @access  Private/SuperAdmin
exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return errorResponse(res, 404, 'Category not found');
        }

        const categoryName = category.name;
        await category.deleteOne();

        // Log activity
        await ActivityLog.create({
            action: 'DELETE_CATEGORY',
            description: `Category deleted: ${categoryName}`,
            performedBy: req.user.id,
            targetId: req.params.id
        });

        return successResponse(res, 200, 'Category deleted successfully');
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Add item to category
// @route   POST /api/super-admin/categories/:id/items
// @access  Private/SuperAdmin
exports.addItemToCategory = async (req, res) => {
    try {
        const { itemName, baseUnit, packagingUnit, sqftPerUnit, isService, pricingType } = req.body;
        const category = await Category.findById(req.params.id);

        if (!category) {
            return errorResponse(res, 404, 'Category not found');
        }

        category.items.push({
            itemName,
            baseUnit,
            packagingUnit,
            sqftPerUnit,
            isService: isService || false,
            pricingType: pricingType || null
        });
        await category.save();

        const newItem = category.items[category.items.length - 1];

        return successResponse(res, 201, 'Item added successfully', {
            id: newItem._id,
            itemName: newItem.itemName,
            baseUnit: newItem.baseUnit,
            packagingUnit: newItem.packagingUnit,
            sqftPerUnit: newItem.sqftPerUnit,
            isService: newItem.isService,
            pricingType: newItem.pricingType,
            categoryId: category._id
        });
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Update item in category
// @route   PUT /api/super-admin/categories/:catId/items/:itemId
// @access  Private/SuperAdmin
exports.updateItem = async (req, res) => {
    try {
        const { itemName, baseUnit, packagingUnit, sqftPerUnit, isService, pricingType } = req.body;
        const category = await Category.findById(req.params.catId);

        if (!category) {
            return errorResponse(res, 404, 'Category not found');
        }

        const item = category.items.id(req.params.itemId);
        if (!item) {
            return errorResponse(res, 404, 'Item not found');
        }

        if (itemName !== undefined) item.itemName = itemName;
        if (baseUnit !== undefined) item.baseUnit = baseUnit;
        if (packagingUnit !== undefined) item.packagingUnit = packagingUnit;
        if (sqftPerUnit !== undefined) item.sqftPerUnit = sqftPerUnit;
        if (isService !== undefined) item.isService = isService;
        if (pricingType !== undefined) item.pricingType = pricingType;

        await category.save();

        return successResponse(res, 200, 'Item updated successfully', {
            id: item._id,
            itemName: item.itemName,
            baseUnit: item.baseUnit,
            packagingUnit: item.packagingUnit,
            sqftPerUnit: item.sqftPerUnit,
            isService: item.isService,
            pricingType: item.pricingType,
            categoryId: category._id
        });
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};

// @desc    Delete item from category
// @route   DELETE /api/super-admin/categories/:catId/items/:itemId
// @access  Private/SuperAdmin
exports.deleteItem = async (req, res) => {
    try {
        const category = await Category.findById(req.params.catId);

        if (!category) {
            return errorResponse(res, 404, 'Category not found');
        }

        category.items.pull(req.params.itemId);
        await category.save();

        return successResponse(res, 200, 'Item deleted successfully');
    } catch (error) {
        return errorResponse(res, 500, error.message);
    }
};
