const Category = require('../models/Category');
const { createApiResponse } = require('../utils/commonHelpers');
const { errorResponse } = require('../utils/responseHandler');

// Helper function to determine company access
const getCompanyQuery = (user, providedCompanyId = null) => {
    if (user.role === 'super-admin') {
        return providedCompanyId ? { companyId: providedCompanyId } : {};
    }
    return { companyId: user.id };
};

// @desc    Get all categories for the current company (or super admin can access any)
// @route   GET /api/categories
// @access  Private (Company/SuperAdmin)
exports.getCategories = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 CRITICAL FIX: Always require companyId - no global access
        let companyId;
        
        if (req.user.role === 'super-admin') {
            // Super admin MUST provide companyId in query params
            companyId = req.query.companyId;
            if (!companyId) {
                return createApiResponse(res, 400, 'companyId is required for super admin access');
            }
        } else {
            // Regular company users can only access their own categories
            companyId = req.user.id;
        }

        console.log(`🔍 CategoryController: Fetching categories for companyId: ${companyId}`.cyan);

        // Use model's optimized method with strict company filtering
        const result = await Category.getOptimizedList(companyId);

        console.log(`✅ Categories Total: ${result.totalTime}ms (${result.categories.length} categories)`.green);

        return createApiResponse(
            res, 
            200, 
            'Categories retrieved successfully', 
            result.categories,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ getCategories error:', error);
        next(error);
    }
};

// @desc    Create new category for the current company (or super admin can specify company)
// @route   POST /api/categories
// @access  Private (Company/SuperAdmin)
exports.createCategory = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { name, companyId } = req.body;

        // 🔥 CRITICAL FIX: Strict company ID validation
        let targetCompanyId;
        
        if (req.user.role === 'super-admin') {
            // Super admin MUST provide companyId in request body
            targetCompanyId = companyId;
            if (!targetCompanyId) {
                return createApiResponse(res, 400, 'companyId is required for super admin category creation');
            }
        } else {
            // Regular company users can only create categories for their own company
            targetCompanyId = req.user.id;
            
            // Prevent company users from creating categories for other companies
            if (companyId && companyId !== req.user.id) {
                return createApiResponse(res, 403, 'You can only create categories for your own company');
            }
        }

        console.log(`🔍 CategoryController: Creating category "${name}" for companyId: ${targetCompanyId}`.cyan);

        // Use model's atomic method
        const category = await Category.createCategoryAtomic({
            name,
            companyId: targetCompanyId
        });

        console.log(`✅ Category created successfully: ${category.name} (ID: ${category.id})`.green);

        return createApiResponse(
            res,
            201,
            'Category created successfully',
            category,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ createCategory error:', error);
        if (error.message.includes('already exists')) {
            return createApiResponse(res, 409, error.message);
        }
        next(error);
    }
};

// @desc    Update category for the current company (or super admin can update any)
// @route   PUT /api/categories/:id
// @access  Private (Company/SuperAdmin)
exports.updateCategory = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { name } = req.body;

        // Build query based on user role
        const query = getCompanyQuery(req.user);
        query._id = req.params.id;

        // Use model's atomic method
        const category = await Category.updateCategoryAtomic(query, { name });

        return createApiResponse(
            res,
            200,
            'Category updated successfully',
            category,
            null,
            startTime
        );
    } catch (error) {
        if (error.message === 'Category not found') {
            return errorResponse(res, 404, error.message);
        }
        if (error.message.includes('already exists')) {
            return errorResponse(res, 409, error.message);
        }
        next(error);
    }
};

// @desc    Delete category for the current company (or super admin can delete any)
// @route   DELETE /api/categories/:id
// @access  Private (Company/SuperAdmin)
exports.deleteCategory = async (req, res, next) => {
    try {
        const startTime = Date.now();

        // Build query based on user role
        const query = getCompanyQuery(req.user);
        query._id = req.params.id;

        // Use atomic delete operation
        const category = await Category.findOneAndDelete(query).lean();

        if (!category) {
            return errorResponse(res, 404, 'Category not found');
        }

        return createApiResponse(
            res,
            200,
            'Category deleted successfully',
            null,
            null,
            startTime
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Add item to category for the current company (or super admin can add to any)
// @route   POST /api/categories/:id/items
// @access  Private (Company/SuperAdmin)
exports.addItemToCategory = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { itemName, baseUnit, packagingUnit, sqftPerUnit, isService, pricingType } = req.body;

        // Build query based on user role
        const query = getCompanyQuery(req.user);
        query._id = req.params.id;

        // Prepare item data
        const itemData = {
            itemName,
            baseUnit,
            sqftPerUnit
        };

        if (packagingUnit !== undefined) itemData.packagingUnit = packagingUnit;
        if (isService !== undefined) itemData.isService = isService;
        if (pricingType !== undefined) itemData.pricingType = pricingType;

        // Use model's atomic method
        const newItem = await Category.addItemAtomic(query, itemData);

        return createApiResponse(
            res,
            201,
            'Item added successfully',
            newItem,
            null,
            startTime
        );
    } catch (error) {
        if (error.message === 'Category not found') {
            return errorResponse(res, 404, error.message);
        }
        next(error);
    }
};

// @desc    Update item in category for the current company (or super admin can update any)
// @route   PUT /api/categories/:catId/items/:itemId
// @access  Private (Company/SuperAdmin)
exports.updateItem = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { itemName, baseUnit, packagingUnit, sqftPerUnit, isService, pricingType } = req.body;

        // Build query based on user role
        const categoryQuery = getCompanyQuery(req.user);
        categoryQuery._id = req.params.catId;

        // Prepare update data (only include defined fields)
        const updateData = {};
        if (itemName !== undefined) updateData.itemName = itemName;
        if (baseUnit !== undefined) updateData.baseUnit = baseUnit;
        if (packagingUnit !== undefined) updateData.packagingUnit = packagingUnit;
        if (sqftPerUnit !== undefined) updateData.sqftPerUnit = sqftPerUnit;
        if (isService !== undefined) updateData.isService = isService;
        if (pricingType !== undefined) updateData.pricingType = pricingType;

        // Use model's atomic method with positional operator
        const updatedItem = await Category.updateItemAtomic(
            categoryQuery,
            req.params.itemId,
            updateData
        );

        return createApiResponse(
            res,
            200,
            'Item updated successfully',
            updatedItem,
            null,
            startTime
        );
    } catch (error) {
        if (error.message === 'Category or item not found') {
            return errorResponse(res, 404, error.message);
        }
        next(error);
    }
};

// @desc    Delete item from category for the current company (or super admin can delete from any)
// @route   DELETE /api/categories/:catId/items/:itemId
// @access  Private (Company/SuperAdmin)
exports.deleteItem = async (req, res, next) => {
    try {
        const startTime = Date.now();

        // Build query based on user role
        const query = getCompanyQuery(req.user);
        query._id = req.params.catId;

        // Use atomic $pull operation
        const updatedCategory = await Category.findOneAndUpdate(
            query,
            { $pull: { items: { _id: req.params.itemId } } },
            { new: true, lean: true }
        );

        if (!updatedCategory) {
            return errorResponse(res, 404, 'Category not found');
        }

        return createApiResponse(
            res,
            200,
            'Item deleted successfully',
            null,
            null,
            startTime
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Get all items from all categories for the current company (or super admin can access any)
// @route   GET /api/categories/items/all
// @access  Private (Company/SuperAdmin)
exports.fetchAllItemCategories = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // 🔥 CRITICAL FIX: Always require companyId - no global access
        let companyId;
        
        if (req.user.role === 'super-admin') {
            // Super admin MUST provide companyId in query params
            companyId = req.query.companyId;
            if (!companyId) {
                return createApiResponse(res, 400, 'companyId is required for super admin access');
            }
        } else {
            // Regular company users can only access their own items
            companyId = req.user.id;
        }

        console.log(`🔍 CategoryController: Fetching all items for companyId: ${companyId}`.cyan);

        // Use model's optimized aggregation method
        const allItems = await Category.getAllItemsOptimized(companyId);

        console.log(`✅ All items retrieved: ${allItems.length} items`.green);

        return createApiResponse(
            res,
            200,
            'All items retrieved successfully',
            allItems,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ fetchAllItemCategories error:', error);
        next(error);
    }
};
