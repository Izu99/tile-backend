const Category = require('../models/Category');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// @desc    Get all categories for the current company (or super admin can access any)
// @route   GET /api/categories
// @access  Private (Company/SuperAdmin)
exports.getCategories = async (req, res, next) => {
    try {
        let query = {};

        // Super admins can access all categories or filter by companyId
        if (req.user.role === 'super-admin') {
            // If companyId is provided in query, filter by it
            if (req.query.companyId) {
                query.companyId = req.query.companyId;
            }
            // If no companyId specified, super admin can see all (or we can restrict this)
            // For now, let's allow super admins to see all categories
        } else {
            // Regular company users only see their own categories
            query.companyId = req.user.id;
        }

        const categories = await Category.find(query);

        // Transform for frontend consistency
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
        next(error);
    }
};

// @desc    Create new category for the current company (or super admin can specify company)
// @route   POST /api/categories
// @access  Private (Company/SuperAdmin)
exports.createCategory = async (req, res, next) => {
    try {
        const { name, companyId } = req.body;

        // Determine which company ID to use
        let targetCompanyId;
        if (req.user.role === 'super-admin' && companyId) {
            // Super admin can specify companyId
            targetCompanyId = companyId;
        } else {
            // Regular users create for their own company
            targetCompanyId = req.user.id;
        }

        const category = await Category.create({
            name,
            companyId: targetCompanyId
        });

        const transformed = {
            id: category._id,
            name: category.name,
            companyId: category.companyId,
            items: []
        };

        return successResponse(res, 201, 'Category created successfully', transformed);
    } catch (error) {
        next(error);
    }
};

// @desc    Update category for the current company (or super admin can update any)
// @route   PUT /api/categories/:id
// @access  Private (Company/SuperAdmin)
exports.updateCategory = async (req, res, next) => {
    try {
        const { name } = req.body;

        let query = { _id: req.params.id };

        // Super admins can update any category, regular users only their own
        if (req.user.role !== 'super-admin') {
            query.companyId = req.user.id;
        }

        const category = await Category.findOne(query);

        if (!category) {
            return errorResponse(res, 404, 'Category not found');
        }

        if (name) category.name = name;
        await category.save();

        const transformed = {
            id: category._id,
            name: category.name,
            companyId: category.companyId,
            items: category.items
        };

        return successResponse(res, 200, 'Category updated successfully', transformed);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete category for the current company (or super admin can delete any)
// @route   DELETE /api/categories/:id
// @access  Private (Company/SuperAdmin)
exports.deleteCategory = async (req, res, next) => {
    try {
        let query = { _id: req.params.id };

        // Super admins can delete any category, regular users only their own
        if (req.user.role !== 'super-admin') {
            query.companyId = req.user.id;
        }

        const category = await Category.findOne(query);

        if (!category) {
            return errorResponse(res, 404, 'Category not found');
        }

        await category.deleteOne();

        return successResponse(res, 200, 'Category deleted successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Add item to category for the current company (or super admin can add to any)
// @route   POST /api/categories/:id/items
// @access  Private (Company/SuperAdmin)
exports.addItemToCategory = async (req, res, next) => {
    try {
        const { itemName, baseUnit, packagingUnit, sqftPerUnit, isService, pricingType } = req.body;

        let query = { _id: req.params.id };

        // Super admins can add items to any category, regular users only to their own
        if (req.user.role !== 'super-admin') {
            query.companyId = req.user.id;
        }

        const category = await Category.findOne(query);

        if (!category) {
            return errorResponse(res, 404, 'Category not found');
        }

        const itemData = {
            itemName,
            baseUnit,
            sqftPerUnit
        };

        if (packagingUnit !== undefined) itemData.packagingUnit = packagingUnit;
        if (isService !== undefined) itemData.isService = isService;
        if (pricingType !== undefined) itemData.pricingType = pricingType;

        category.items.push(itemData);
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
        next(error);
    }
};

// @desc    Update item in category for the current company (or super admin can update any)
// @route   PUT /api/categories/:catId/items/:itemId
// @access  Private (Company/SuperAdmin)
exports.updateItem = async (req, res, next) => {
    try {
        const { itemName, baseUnit, packagingUnit, sqftPerUnit, isService, pricingType } = req.body;

        let query = { _id: req.params.catId };

        // Super admins can update items in any category, regular users only their own
        if (req.user.role !== 'super-admin') {
            query.companyId = req.user.id;
        }

        const category = await Category.findOne(query);

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
        next(error);
    }
};

// @desc    Delete item from category for the current company (or super admin can delete from any)
// @route   DELETE /api/categories/:catId/items/:itemId
// @access  Private (Company/SuperAdmin)
exports.deleteItem = async (req, res, next) => {
    try {
        let query = { _id: req.params.catId };

        // Super admins can delete items from any category, regular users only their own
        if (req.user.role !== 'super-admin') {
            query.companyId = req.user.id;
        }

        const category = await Category.findOne(query);

        if (!category) {
            return errorResponse(res, 404, 'Category not found');
        }

        category.items.pull(req.params.itemId);
        await category.save();

        return successResponse(res, 200, 'Item deleted successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Get all items from all categories for the current company (or super admin can access any)
// @route   GET /api/categories/items/all
// @access  Private (Company/SuperAdmin)
exports.fetchAllItemCategories = async (req, res, next) => {
    try {
        let query = {};

        // Super admins can access all items or filter by companyId
        if (req.user.role === 'super-admin') {
            // If companyId is provided in query, filter by it
            if (req.query.companyId) {
                query.companyId = req.query.companyId;
            }
            // If no companyId specified, super admin can see all items
        } else {
            // Regular company users only see their own items
            query.companyId = req.user.id;
        }

        const categories = await Category.find(query);

        // Flatten all items from all categories
        const allItems = [];
        categories.forEach(category => {
            category.items.forEach(item => {
                allItems.push({
                    id: item._id,
                    itemName: item.itemName,
                    baseUnit: item.baseUnit,
                    packagingUnit: item.packagingUnit,
                    sqftPerUnit: item.sqftPerUnit,
                    isService: item.isService,
                    pricingType: item.pricingType,
                    categoryId: category._id,
                    categoryName: category.name
                });
            });
        });

        return successResponse(res, 200, 'All items retrieved successfully', allItems);
    } catch (error) {
        next(error);
    }
};
