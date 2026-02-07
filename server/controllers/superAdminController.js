const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const ActivityLog = require('../models/ActivityLog');
const CacheService = require('../services/cacheService');
const { createApiResponse } = require('../utils/commonHelpers');

// Unit configurations
const UNIT_CONFIGS = {
    service_units: ['sqft', 'ft', 'Job', 'Visit', 'Day'],
    product_units: ['sqft', 'ft', 'pcs', 'kg', 'm']
};

/**
 * 🔥 SKINNY CONTROLLER PATTERN IMPLEMENTATION
 * 
 * This controller follows the Skinny Controller pattern by:
 * - Delegating business logic to Model static methods
 * - Using CacheService for cache management and priming
 * - Handling only authentication, orchestration, and API responses
 * - Ensuring multi-tenant security at the controller level
 */

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

        return createApiResponse(res, 200, 'Item configurations retrieved successfully', data);
    } catch (error) {
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Get global system statistics for Super Admin dashboard
// @route   GET /api/super-admin/dashboard/stats
// @access  Private/SuperAdmin
exports.getDashboardStats = async (req, res) => {
    try {
        // 🔥 SKINNY CONTROLLER: Delegate to CacheService
        const data = await CacheService.getGlobalSystemStats();
        
        return createApiResponse(res, 200, 'Dashboard stats retrieved successfully', data);
    } catch (error) {
        console.error('❌ getDashboardStats error:', error);
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Prime dashboard caches for all active tenants (Super Admin only)
// @route   POST /api/super-admin/cache/prime
// @access  Private/SuperAdmin
exports.primeDashboardCaches = async (req, res) => {
    try {
        const { batchSize = 10 } = req.body;
        
        // 🔥 CACHE PRIMING: Delegate to CacheService with batch processing
        const result = await CacheService.primeAllTenantCaches(batchSize);
        
        return createApiResponse(res, 200, 'Cache priming completed', {
            primedCount: result.primedCount,
            failedCount: result.failedCount,
            totalTimeMs: result.totalTime,
            batchSize
        });
    } catch (error) {
        console.error('❌ primeDashboardCaches error:', error);
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Get all companies with search and filtering
// @route   GET /api/super-admin/companies
// @access  Private/SuperAdmin
exports.getAllCompanies = async (req, res) => {
    const startTime = Date.now(); // Move to function scope
    try {
        const { search, page = 1, limit = 20, isActive } = req.query;
        
        console.log(`🔍 getAllCompanies: Starting query with params:`, { search, page, limit, isActive });
        
        // 🔥 HIGH-LATENCY OPTIMIZATION: Check cache first for repeated requests
        const cacheKey = `companies_${search || 'all'}_${page}_${limit}_${isActive || 'all'}`;
        const cachedResult = CacheService.get(cacheKey);
        
        if (cachedResult) {
            console.log(`⚡ Cache hit: ${cacheKey} (${Date.now() - startTime}ms)`);
            return createApiResponse(res, 200, 'Companies retrieved from cache', {
                ...cachedResult,
                _performance: {
                    ...cachedResult._performance,
                    fromCache: true,
                    totalTimeMs: Date.now() - startTime
                }
            });
        }
        
        // 🔥 PERFORMANCE OPTIMIZATION: Use optimized query with minimal data transfer
        const queryOptions = {
            role: 'company',
            search,
            page: parseInt(page),
            limit: parseInt(limit),
            isActive: isActive !== undefined ? isActive === 'true' : null
        };
        
        // 🔥 SKINNY CONTROLLER: Delegate to User model static method with performance monitoring
        const queryStartTime = Date.now();
        const result = await User.getForManagement(queryOptions);
        const queryTime = Date.now() - queryStartTime;
        
        console.log(`⚡ User.getForManagement: ${queryTime}ms (${result.users.length} companies)`);
        
        // 🔥 HIGH-LATENCY WARNING: Alert if query is slow due to network
        if (queryTime > 10000) {
            console.log(`🚨 HIGH LATENCY WARNING: getAllCompanies took ${queryTime}ms - network latency detected!`.red);
        }

        // Transform to match frontend CompanyModel with minimal data
        const transformStartTime = Date.now();
        const transformedCompanies = result.users.map(user => ({
            id: user._id,
            companyName: user.companyName || '',
            companyAddress: user.companyAddress || '',
            companyPhone: user.companyPhone || '',
            ownerName: user.name || '',
            ownerEmail: user.email || '',
            ownerPhone: user.phone || '',
            isActive: user.isActive,
            createdAt: user.createdAt
        }));
        const transformTime = Date.now() - transformStartTime;
        
        const responseData = {
            companies: transformedCompanies,
            pagination: result.pagination,
            _performance: {
                totalTimeMs: Date.now() - startTime,
                queryTimeMs: queryTime,
                transformTimeMs: transformTime,
                companiesCount: transformedCompanies.length,
                networkOptimized: true
            }
        };
        
        // 🔥 HIGH-LATENCY OPTIMIZATION: Cache successful results for 2 minutes
        if (transformedCompanies.length > 0) {
            CacheService.set(cacheKey, responseData, 120); // 2 minute cache
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`⚡ getAllCompanies: Total time ${totalTime}ms (Query: ${queryTime}ms, Transform: ${transformTime}ms)`);

        return createApiResponse(res, 200, 'Companies retrieved successfully', responseData);
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`❌ getAllCompanies error after ${totalTime}ms:`, error);
        
        // 🔥 HIGH-LATENCY ERROR HANDLING: Provide specific error messages
        let errorMessage = error.message;
        if (totalTime > 30000) {
            errorMessage = 'Request timed out due to high network latency. The database may be in a distant region.';
        } else if (error.name === 'MongoNetworkTimeoutError') {
            errorMessage = 'Network timeout - the database connection is experiencing high latency.';
        }
        
        return createApiResponse(res, 500, errorMessage);
    }
};

// @desc    Create new company
// @route   POST /api/super-admin/companies
// @access  Private/SuperAdmin
exports.createCompany = async (req, res) => {
    try {
        const {
            name, email, password, phone,
            companyName, companyAddress, companyPhone
        } = req.body;

        // 🔥 MULTI-TENANT SECURITY: Check if user already exists
        const userExists = await User.findOne({ 
            email: email.toLowerCase().trim(),
            // Explicit security check
            $expr: { $ne: ['$role', 'super-admin'] }
        });

        if (userExists) {
            return createApiResponse(res, 400, 'User already exists');
        }

        // 🔥 SKINNY CONTROLLER: Use User model for creation
        const user = await User.create({
            name,
            email: email.toLowerCase().trim(),
            password,
            phone,
            companyName,
            companyAddress,
            companyPhone,
            role: 'company',
            isActive: true
        });

        // 🔥 CACHE INVALIDATION: Clear and reprime global cache SYNCHRONOUSLY
        await CacheService.clearAndPrimeGlobalCache();

        // Log activity with error handling
        try {
            await ActivityLog.create({
                action: 'CREATE_COMPANY',
                description: `New company registered: ${companyName}`,
                performedBy: req.user._id,
                targetId: user._id,
                targetType: 'Company'
            });
        } catch (logError) {
            console.log('⚠️  Activity log creation failed (non-critical):', logError.message.yellow);
        }

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

        return createApiResponse(res, 201, 'Company created successfully', company);
    } catch (error) {
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Update company status and subscription
// @route   PUT /api/super-admin/companies/:id
// @access  Private/SuperAdmin
exports.updateCompany = async (req, res) => {
    try {
        const {
            name, email, phone,
            companyName, companyAddress, companyPhone,
            isActive, subscriptionStatus, subscriptionEndDate
        } = req.body;

        // 🔥 SKINNY CONTROLLER: Delegate to User model static method for status updates
        const statusData = { isActive, subscriptionStatus, subscriptionEndDate };
        const updatedUser = await User.updateCompanyStatus(req.params.id, statusData);

        // Update other fields if provided
        if (name || email || phone || companyName || companyAddress || companyPhone) {
            const updateFields = {};
            if (name) updateFields.name = name;
            if (email) updateFields.email = email.toLowerCase().trim();
            if (phone) updateFields.phone = phone;
            if (companyName) updateFields.companyName = companyName;
            if (companyAddress) updateFields.companyAddress = companyAddress;
            if (companyPhone) updateFields.companyPhone = companyPhone;

            Object.assign(updatedUser, updateFields);
            await updatedUser.save();
        }

        // 🔥 CACHE INVALIDATION: Clear and reprime global cache SYNCHRONOUSLY
        await CacheService.clearAndPrimeGlobalCache();

        // Log activity
        await ActivityLog.create({
            action: 'UPDATE_COMPANY',
            description: `Company updated: ${updatedUser.companyName}`,
            performedBy: req.user._id,
            targetId: updatedUser._id,
            targetType: 'Company'
        });

        const company = {
            id: updatedUser._id,
            companyName: updatedUser.companyName,
            companyAddress: updatedUser.companyAddress,
            companyPhone: updatedUser.companyPhone,
            ownerName: updatedUser.name,
            ownerEmail: updatedUser.email,
            ownerPhone: updatedUser.phone,
            isActive: updatedUser.isActive,
            createdAt: updatedUser.createdAt
        };

        return createApiResponse(res, 200, 'Company updated successfully', company);
    } catch (error) {
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Delete company with cascade deletion
// @route   DELETE /api/super-admin/companies/:id
// @access  Private/SuperAdmin
exports.deleteCompany = async (req, res) => {
    try {
        // 🔥 MULTI-TENANT SECURITY: Use session for transaction-like behavior
        const session = await mongoose.startSession();
        
        try {
            await session.withTransaction(async () => {
                // 🔥 MULTI-TENANT SECURITY: Ensure we're only deleting company users
                const user = await User.findOne({
                    _id: req.params.id,
                    role: 'company',
                    // Explicit security check
                    $expr: { $eq: ['$role', 'company'] }
                }).session(session);

                if (!user) {
                    throw new Error('Company not found or invalid role');
                }

                const companyName = user.companyName;

                // Delete categories first, then user (proper order)
                const deletedCategories = await Category.deleteMany({ 
                    companyId: req.params.id 
                }).session(session);
                
                console.log(`Deleted ${deletedCategories.deletedCount} categories for company ${req.params.id}`);

                // Delete the user
                await User.findByIdAndDelete(req.params.id).session(session);

                // Log activity
                await ActivityLog.create([{
                    action: 'DELETE_COMPANY',
                    description: `Company deleted: ${companyName}`,
                    performedBy: req.user._id,
                    targetId: req.params.id,
                    targetType: 'Company'
                }], { session });

                return { companyName, deletedCategories: deletedCategories.deletedCount };
            }, {
                // 🔥 TRANSACTION OPTIONS: Ensure primary read preference for transactions
                readPreference: 'primary',
                readConcern: { level: 'majority' },
                writeConcern: { w: 'majority' }
            });

            // 🔥 CACHE INVALIDATION: Clear and reprime global cache SYNCHRONOUSLY
            await CacheService.clearAndPrimeGlobalCache();

            return createApiResponse(res, 200, 'Company deleted successfully');
        } finally {
            await session.endSession();
        }
    } catch (error) {
        console.error('❌ deleteCompany error:', error);
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Get categories for a company with pagination support
// @route   GET /api/super-admin/companies/:companyId/categories
// @access  Private/SuperAdmin
exports.getCompanyCategories = async (req, res) => {
    const startTime = Date.now();
    const { companyId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    try {
        console.log(`🔍 getCompanyCategories: Starting for companyId: ${companyId} (page: ${page}, limit: ${limit})`.cyan);
        
        // 🔥 PERFORMANCE FIX: Skip company validation for speed - auth middleware already validates user
        // The auth middleware ensures only super-admin can access this route
        // This removes the 18-second delay caused by the User.findOne query
        
        console.log(`⚡ Auth check skipped: ${Date.now() - startTime}ms`.green);
        
        // 🔥 PERFORMANCE OPTIMIZATION: Direct category fetch with pagination and timeout
        const categoryStartTime = Date.now();
        const result = await Category.getOptimizedListWithPagination(companyId, {
            page: parseInt(page),
            limit: parseInt(limit)
        });
        const categoryTime = Date.now() - categoryStartTime;
        
        console.log(`⚡ Category fetch: ${categoryTime}ms (${result.categories.length} categories, total: ${result.totalCount})`.cyan);
        
        const totalTime = Date.now() - startTime;
        console.log(`⚡ getCompanyCategories: Total time ${totalTime}ms`.cyan);

        return createApiResponse(res, 200, 'Categories retrieved successfully', {
            categories: result.categories,
            totalCount: result.totalCount,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(result.totalCount / parseInt(limit)),
                hasMore: (parseInt(page) * parseInt(limit)) < result.totalCount
            }
        });
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`❌ getCompanyCategories error after ${totalTime}ms:`, error);
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Create category for a company
// @route   POST /api/super-admin/categories
// @access  Private/SuperAdmin
exports.createCategory = async (req, res) => {
    try {
        const { name, companyId } = req.body;

        // 🔥 MULTI-TENANT SECURITY: Verify company exists and is valid
        const company = await User.findOne({
            _id: companyId,
            role: 'company',
            // Explicit security check
            $expr: { $eq: ['$role', 'company'] }
        });

        if (!company) {
            return createApiResponse(res, 404, 'Company not found');
        }

        const category = await Category.create({
            name,
            companyId
        });

        // 🔥 ATOMIC COUNTER UPDATE: Increment totalCategoriesCount
        await User.incrementCounter(companyId, 'totalCategoriesCount', 1);

        // 🔥 CACHE INVALIDATION: Clear and reprime global cache SYNCHRONOUSLY
        await CacheService.clearAndPrimeGlobalCache();

        // Log activity with error handling
        try {
            await ActivityLog.create({
                action: 'CREATE_CATEGORY',
                description: `New category created: ${name}`,
                performedBy: req.user._id,
                targetId: category._id,
                targetType: 'Category'
            });
        } catch (logError) {
            console.log('⚠️  Activity log creation failed (non-critical):', logError.message.yellow);
        }

        const transformed = {
            id: category._id,
            name: category.name,
            companyId: category.companyId,
            items: []
        };

        return createApiResponse(res, 201, 'Category created successfully', transformed);
    } catch (error) {
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Update category
// @route   PUT /api/super-admin/categories/:id
// @access  Private/SuperAdmin
exports.updateCategory = async (req, res) => {
    try {
        const { name } = req.body;

        // 🔥 ATOMIC UPDATE: Use findOneAndUpdate
        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            { ...(name && { name }) },
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return createApiResponse(res, 404, 'Category not found');
        }

        // Log activity
        await ActivityLog.create({
            action: 'UPDATE_CATEGORY',
            description: `Category updated: ${updatedCategory.name}`,
            performedBy: req.user._id,
            targetId: updatedCategory._id,
            targetType: 'Category'
        });

        return createApiResponse(res, 200, 'Category updated successfully', {
            id: updatedCategory._id,
            name: updatedCategory.name,
            companyId: updatedCategory.companyId,
            items: updatedCategory.items
        });
    } catch (error) {
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Delete category with counter updates
// @route   DELETE /api/super-admin/categories/:id
// @access  Private/SuperAdmin
exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        
        if (!category) {
            return createApiResponse(res, 404, 'Category not found');
        }

        // Count items and services for counter updates
        let itemsCount = 0;
        let servicesCount = 0;
        
        if (category.items && Array.isArray(category.items)) {
            category.items.forEach(item => {
                if (item.isService === true) {
                    servicesCount++;
                } else {
                    itemsCount++;
                }
            });
        }

        // Delete the category
        await Category.findByIdAndDelete(req.params.id);

        // 🔥 ATOMIC COUNTER UPDATES: Update all counts atomically
        await User.updateCounters(category.companyId, {
            totalCategoriesCount: -1,
            totalItemsCount: -itemsCount,
            totalServicesCount: -servicesCount
        });

        // 🔥 CACHE INVALIDATION: Clear and reprime global cache SYNCHRONOUSLY
        await CacheService.clearAndPrimeGlobalCache();

        // Log activity with error handling
        try {
            await ActivityLog.create({
                action: 'DELETE_CATEGORY',
                description: `Category deleted: ${category.name}`,
                performedBy: req.user._id,
                targetId: req.params.id,
                targetType: 'Category'
            });
        } catch (logError) {
            console.log('⚠️  Activity log creation failed (non-critical):', logError.message.yellow);
        }

        return createApiResponse(res, 200, 'Category deleted successfully');
    } catch (error) {
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Add item to category
// @route   POST /api/super-admin/categories/:id/items
// @access  Private/SuperAdmin
exports.addItemToCategory = async (req, res) => {
    try {
        const { itemName, baseUnit, packagingUnit, sqftPerUnit, isService, pricingType } = req.body;
        
        // 🔥 ATOMIC OPERATION: Use $push operation
        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.id,
            {
                $push: {
                    items: {
                        itemName,
                        baseUnit,
                        packagingUnit,
                        sqftPerUnit,
                        isService: isService || false,
                        pricingType: pricingType || null
                    }
                }
            },
            { new: true }
        );

        if (!updatedCategory) {
            return createApiResponse(res, 404, 'Category not found');
        }

        // 🔥 ATOMIC COUNTER UPDATE: Increment appropriate count
        const incrementField = isService === true ? 'totalServicesCount' : 'totalItemsCount';
        await User.incrementCounter(updatedCategory.companyId, incrementField, 1);

        // 🔥 CACHE INVALIDATION: Clear and reprime global cache SYNCHRONOUSLY
        await CacheService.clearAndPrimeGlobalCache();

        const newItem = updatedCategory.items[updatedCategory.items.length - 1];

        return createApiResponse(res, 201, 'Item added successfully', {
            id: newItem._id,
            itemName: newItem.itemName,
            baseUnit: newItem.baseUnit,
            packagingUnit: newItem.packagingUnit,
            sqftPerUnit: newItem.sqftPerUnit,
            isService: newItem.isService,
            pricingType: newItem.pricingType,
            categoryId: updatedCategory._id
        });
    } catch (error) {
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Update item in category
// @route   PUT /api/super-admin/categories/:catId/items/:itemId
// @access  Private/SuperAdmin
exports.updateItem = async (req, res) => {
    try {
        const { itemName, baseUnit, packagingUnit, sqftPerUnit, isService, pricingType } = req.body;
        
        // Get current item to check if isService is changing
        const category = await Category.findOne(
            { _id: req.params.catId, 'items._id': req.params.itemId }
        );

        if (!category) {
            return createApiResponse(res, 404, 'Category or item not found');
        }

        const currentItem = category.items.find(item => item._id.toString() === req.params.itemId);
        const currentIsService = currentItem.isService;
        const newIsService = isService !== undefined ? isService : currentIsService;

        // Build update object
        const updateFields = {};
        if (itemName !== undefined) updateFields['items.$.itemName'] = itemName;
        if (baseUnit !== undefined) updateFields['items.$.baseUnit'] = baseUnit;
        if (packagingUnit !== undefined) updateFields['items.$.packagingUnit'] = packagingUnit;
        if (sqftPerUnit !== undefined) updateFields['items.$.sqftPerUnit'] = sqftPerUnit;
        if (isService !== undefined) updateFields['items.$.isService'] = isService;
        if (pricingType !== undefined) updateFields['items.$.pricingType'] = pricingType;

        // 🔥 ATOMIC UPDATE: Use positional operator
        const updatedCategory = await Category.findOneAndUpdate(
            { _id: req.params.catId, 'items._id': req.params.itemId },
            { $set: updateFields },
            { new: true }
        );

        if (!updatedCategory) {
            return createApiResponse(res, 404, 'Category or item not found');
        }

        // 🔥 ATOMIC COUNTER UPDATES: Update counts if isService flag changed
        if (isService !== undefined && currentIsService !== newIsService) {
            const updateObj = {};
            if (newIsService) {
                // Changed from item to service
                updateObj.totalItemsCount = -1;
                updateObj.totalServicesCount = 1;
            } else {
                // Changed from service to item
                updateObj.totalItemsCount = 1;
                updateObj.totalServicesCount = -1;
            }
            
            await User.updateCounters(updatedCategory.companyId, updateObj);
        }

        // 🔥 CACHE INVALIDATION: Clear and reprime global cache SYNCHRONOUSLY
        await CacheService.clearAndPrimeGlobalCache();

        const updatedItem = updatedCategory.items.find(
            item => item._id.toString() === req.params.itemId
        );

        return createApiResponse(res, 200, 'Item updated successfully', {
            id: updatedItem._id,
            itemName: updatedItem.itemName,
            baseUnit: updatedItem.baseUnit,
            packagingUnit: updatedItem.packagingUnit,
            sqftPerUnit: updatedItem.sqftPerUnit,
            isService: updatedItem.isService,
            pricingType: updatedItem.pricingType,
            categoryId: updatedCategory._id
        });
    } catch (error) {
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Delete item from category
// @route   DELETE /api/super-admin/categories/:catId/items/:itemId
// @access  Private/SuperAdmin
exports.deleteItem = async (req, res) => {
    try {
        // Get the item to check if it's a service or item
        const category = await Category.findOne(
            { _id: req.params.catId, 'items._id': req.params.itemId }
        );

        if (!category) {
            return createApiResponse(res, 404, 'Category or item not found');
        }

        const itemToDelete = category.items.find(item => item._id.toString() === req.params.itemId);
        const isService = itemToDelete.isService;

        // 🔥 ATOMIC OPERATION: Use $pull operation
        const updatedCategory = await Category.findByIdAndUpdate(
            req.params.catId,
            { $pull: { items: { _id: req.params.itemId } } },
            { new: true }
        );

        if (!updatedCategory) {
            return createApiResponse(res, 404, 'Category not found');
        }

        // 🔥 ATOMIC COUNTER UPDATE: Decrement appropriate count
        const decrementField = isService === true ? 'totalServicesCount' : 'totalItemsCount';
        await User.decrementCounter(updatedCategory.companyId, decrementField, 1);

        // 🔥 CACHE INVALIDATION: Clear and reprime global cache SYNCHRONOUSLY
        await CacheService.clearAndPrimeGlobalCache();

        return createApiResponse(res, 200, 'Item deleted successfully');
    } catch (error) {
        return createApiResponse(res, 500, error.message);
    }
};

// @desc    Get cache statistics for monitoring
// @route   GET /api/super-admin/cache/stats
// @access  Private/SuperAdmin
exports.getCacheStats = async (req, res) => {
    try {
        // 🔥 SKINNY CONTROLLER: Delegate to CacheService
        const stats = CacheService.getCacheStats();
        
        return createApiResponse(res, 200, 'Cache statistics retrieved successfully', stats);
    } catch (error) {
        return createApiResponse(res, 500, error.message);
    }
};

module.exports = {
    getItemConfigs: exports.getItemConfigs,
    getDashboardStats: exports.getDashboardStats,
    primeDashboardCaches: exports.primeDashboardCaches,
    getAllCompanies: exports.getAllCompanies,
    createCompany: exports.createCompany,
    updateCompany: exports.updateCompany,
    deleteCompany: exports.deleteCompany,
    getCompanyCategories: exports.getCompanyCategories,
    createCategory: exports.createCategory,
    updateCategory: exports.updateCategory,
    deleteCategory: exports.deleteCategory,
    addItemToCategory: exports.addItemToCategory,
    updateItem: exports.updateItem,
    deleteItem: exports.deleteItem,
    getCacheStats: exports.getCacheStats
};