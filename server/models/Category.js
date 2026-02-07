const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');

const ItemTemplateSchema = new mongoose.Schema({
    itemName: {
        type: String,
        required: [true, 'Please add item name'],
    },
    baseUnit: {
        type: String,
        required: [true, 'Please add base unit'],
    },
    packagingUnit: {
        type: String,
        default: null,
    },
    sqftPerUnit: {
        type: Number,
        required: [true, 'Please add sqft per unit'],
        default: 0,
    },
    isService: {
        type: Boolean,
        default: false,
    },
    pricingType: {
        type: String,
        enum: ['fixed', 'variable'],
        default: null,
    }
});

const CategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add category name'],
        },
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company', // Fixed: Should reference Company, not User
            required: true,
        },
        items: [ItemTemplateSchema]
    },
    {
        timestamps: true,
    }
);

// 🔥 CRITICAL PERFORMANCE INDEXES for multi-tenant queries
CategorySchema.index({ companyId: 1 }); // Single field index for company filtering
CategorySchema.index({ name: 1, companyId: 1 }, { unique: true }); // Compound unique index
CategorySchema.index({ companyId: 1, createdAt: -1 }); // For sorted company queries
CategorySchema.index({ companyId: 1, 'items.itemName': 1 }); // For item searches within company
CategorySchema.index({ companyId: 1, 'items.itemName': 'text' }); // Text search index for items

// Add lean virtuals plugin for virtual field support with lean queries
CategorySchema.plugin(mongooseLeanVirtuals);

// Virtual for item count
CategorySchema.virtual('itemCount').get(function() {
    return this.items ? this.items.length : 0;
});

// Virtual for transformed data (DRY principle)
CategorySchema.virtual('transformedData').get(function() {
    return {
        id: this._id,
        name: this.name,
        companyId: this.companyId,
        itemCount: this.itemCount,
        items: this.items?.map(item => ({
            id: item._id,
            itemName: item.itemName,
            baseUnit: item.baseUnit,
            packagingUnit: item.packagingUnit,
            sqftPerUnit: item.sqftPerUnit,
            isService: item.isService,
            pricingType: item.pricingType,
            categoryId: this._id
        })) || []
    };
});

// 🔥 CACHING: Simple in-memory cache for categories
const categoryCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// 🔥 NEW: Static method: Get optimized categories list with pagination
CategorySchema.statics.getOptimizedListWithPagination = async function(companyId, options = {}) {
    const startTime = Date.now();
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;
    
    try {
        // 🔥 CRITICAL FIX: Always require companyId for data isolation
        if (!companyId) {
            throw new Error('companyId is required for category access');
        }

        // 🔥 PERFORMANCE FIX: Simplified query with proper ObjectId conversion
        let companyObjectId;
        try {
            companyObjectId = new mongoose.Types.ObjectId(companyId);
        } catch (error) {
            throw new Error(`Invalid companyId format: ${companyId}`);
        }
        
        const query = { companyId: companyObjectId };
        
        console.log(`🔍 getOptimizedListWithPagination: Query for companyId: ${companyId} (page: ${page}, limit: ${limit})`.cyan);
        
        // 🔥 PERFORMANCE OPTIMIZATION: Use aggregation with pagination
        const [categoriesResult, totalCountResult] = await Promise.all([
            // Get paginated categories
            this.aggregate([
                { $match: query },
                {
                    $project: {
                        _id: 1,
                        name: 1,
                        companyId: 1,
                        items: 1,
                        itemCount: { $size: { $ifNull: ['$items', []] } }
                    }
                },
                { $sort: { name: 1 } },
                { $skip: skip },
                { $limit: limit }
            ]).option({ 
                maxTimeMS: 10000, // 10 second timeout
                allowDiskUse: false // Force memory-only for speed
            }),
            
            // Get total count
            this.countDocuments(query)
        ]);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Categories Pagination: ${dbTime}ms (${categoriesResult.length} categories, total: ${totalCountResult})`.cyan);

        // 🔥 OPTIMIZED TRANSFORMATION: Direct mapping without virtual fields
        const transformedCategories = categoriesResult.map(cat => ({
            id: cat._id,
            name: cat.name,
            companyId: cat.companyId,
            itemCount: cat.itemCount,
            items: cat.items?.map(item => ({
                id: item._id,
                itemName: item.itemName,
                baseUnit: item.baseUnit,
                packagingUnit: item.packagingUnit,
                sqftPerUnit: item.sqftPerUnit,
                isService: item.isService,
                pricingType: item.pricingType,
                categoryId: cat._id
            })) || []
        }));

        return {
            categories: transformedCategories,
            totalCount: totalCountResult,
            totalTime: Date.now() - startTime,
            cached: false
        };
    } catch (error) {
        console.error('❌ getOptimizedListWithPagination error:', error);
        
        // 🔥 ENHANCED ERROR HANDLING with specific error types
        if (error.name === 'MongoTimeoutError') {
            throw new Error('Database query timed out - please try again');
        } else if (error.name === 'MongoNetworkError') {
            throw new Error('Database connection error - please check your connection');
        } else if (error.message.includes('Invalid companyId')) {
            throw error; // Re-throw validation errors as-is
        } else {
            throw new Error(`Failed to fetch categories: ${error.message}`);
        }
    }
};

// Static method: Get optimized categories list with caching
CategorySchema.statics.getOptimizedList = async function(companyId, options = {}) {
    const startTime = Date.now();
    
    try {
        // 🔥 CRITICAL FIX: Always require companyId for data isolation
        if (!companyId) {
            throw new Error('companyId is required for category access');
        }

        // 🔥 CACHING: Check cache first with strict key validation
        const cacheKey = `categories_${companyId}`;
        const cachedData = categoryCache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
            // 🔥 ADDITIONAL VALIDATION: Ensure cached data belongs to correct company
            const isValidCache = cachedData.data.every(cat => 
                cat.companyId && cat.companyId.toString() === companyId.toString()
            );
            
            if (isValidCache) {
                console.log(`💾 Categories Cache Hit: ${Date.now() - startTime}ms (${cachedData.data.length} categories) for company: ${companyId}`.green);
                return {
                    categories: cachedData.data,
                    totalTime: Date.now() - startTime,
                    cached: true
                };
            } else {
                // 🔥 SECURITY: Clear corrupted cache
                console.log(`⚠️  Cache corruption detected for company ${companyId}, clearing...`.yellow);
                categoryCache.delete(cacheKey);
            }
        }

        // 🔥 PERFORMANCE FIX: Simplified query with proper ObjectId conversion
        let companyObjectId;
        try {
            companyObjectId = new mongoose.Types.ObjectId(companyId);
        } catch (error) {
            throw new Error(`Invalid companyId format: ${companyId}`);
        }
        
        // 🔥 SIMPLIFIED QUERY: Remove complex $expr validation for speed
        const query = { companyId: companyObjectId };
        
        console.log(`🔍 getOptimizedList: Fast query for companyId: ${companyId}`.cyan);
        
        // 🔥 PERFORMANCE OPTIMIZATION: Use aggregation for better performance
        const categories = await this.aggregate([
            { $match: query },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    companyId: 1,
                    items: 1,
                    itemCount: { $size: { $ifNull: ['$items', []] } }
                }
            },
            { $sort: { name: 1 } }
        ]).option({ 
            maxTimeMS: 10000, // 10 second timeout instead of 30
            allowDiskUse: false // Force memory-only for speed
        });

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Categories Aggregation: ${dbTime}ms (${categories.length} categories)`.cyan);

        // 🔥 OPTIMIZED TRANSFORMATION: Direct mapping without virtual fields
        const transformedCategories = categories.map(cat => ({
            id: cat._id,
            name: cat.name,
            companyId: cat.companyId,
            itemCount: cat.itemCount,
            items: cat.items?.map(item => ({
                id: item._id,
                itemName: item.itemName,
                baseUnit: item.baseUnit,
                packagingUnit: item.packagingUnit,
                sqftPerUnit: item.sqftPerUnit,
                isService: item.isService,
                pricingType: item.pricingType,
                categoryId: cat._id
            })) || []
        }));

        // 🔥 CACHING: Store in cache
        categoryCache.set(cacheKey, {
            data: transformedCategories,
            timestamp: Date.now()
        });

        // Clean up expired cache entries periodically
        if (categoryCache.size > 100) {
            const now = Date.now();
            for (const [key, value] of categoryCache.entries()) {
                if (now - value.timestamp > CACHE_TTL) {
                    categoryCache.delete(key);
                }
            }
        }

        return {
            categories: transformedCategories,
            totalTime: Date.now() - startTime,
            cached: false
        };
    } catch (error) {
        console.error('❌ getOptimizedList error:', error);
        
        // 🔥 ENHANCED ERROR HANDLING with specific error types
        if (error.name === 'MongoServerError' || error.name === 'MongoTimeoutError') {
            console.error('💡 Database query failed, check connection and indexes'.yellow);
        }
        
        throw error;
    }
};

// 🔥 CACHE INVALIDATION: Clear cache for a specific company
CategorySchema.statics.clearCacheForCompany = function(companyId) {
    const cacheKey = `categories_${companyId}`;
    categoryCache.delete(cacheKey);
    console.log(`🗑️  Cache cleared for company: ${companyId}`.yellow);
};

// 🔥 CACHE MANAGEMENT: Clear all caches (for maintenance)
CategorySchema.statics.clearAllCaches = function() {
    categoryCache.clear();
    console.log(`🗑️  All category caches cleared`.yellow);
};

// 🔥 CACHE STATS: Get cache statistics
CategorySchema.statics.getCacheStats = function() {
    const now = Date.now();
    let activeEntries = 0;
    let expiredEntries = 0;
    
    for (const [key, value] of categoryCache.entries()) {
        if (now - value.timestamp < CACHE_TTL) {
            activeEntries++;
        } else {
            expiredEntries++;
        }
    }
    
    return {
        totalEntries: categoryCache.size,
        activeEntries,
        expiredEntries,
        cacheTTL: CACHE_TTL / 1000 // in seconds
    };
};

// Static method: Create category with validation and cache invalidation
CategorySchema.statics.createCategoryAtomic = async function(data) {
    try {
        const category = await this.create(data);
        
        // 🔥 CACHE INVALIDATION: Clear cache after creation
        this.clearCacheForCompany(data.companyId);
        
        return {
            id: category._id,
            name: category.name,
            companyId: category.companyId,
            itemCount: 0,
            items: []
        };
    } catch (error) {
        if (error.code === 11000) {
            throw new Error('Category name already exists for this company');
        }
        throw error;
    }
};

// Static method: Update category atomically with cache invalidation
CategorySchema.statics.updateCategoryAtomic = async function(query, updateData) {
    try {
        const updatedCategory = await this.findOneAndUpdate(
            query,
            updateData,
            { new: true, lean: true }
        );

        if (!updatedCategory) {
            throw new Error('Category not found');
        }

        // 🔥 CACHE INVALIDATION: Clear cache after update
        this.clearCacheForCompany(updatedCategory.companyId);

        return {
            id: updatedCategory._id,
            name: updatedCategory.name,
            companyId: updatedCategory.companyId,
            itemCount: updatedCategory.items?.length || 0,
            items: updatedCategory.items || []
        };
    } catch (error) {
        if (error.code === 11000) {
            throw new Error('Category name already exists for this company');
        }
        throw error;
    }
};

// Static method: Add item to category atomically with cache invalidation
CategorySchema.statics.addItemAtomic = async function(query, itemData) {
    try {
        const updatedCategory = await this.findOneAndUpdate(
            query,
            { $push: { items: itemData } },
            { new: true, lean: true }
        );

        if (!updatedCategory) {
            throw new Error('Category not found');
        }

        // 🔥 CACHE INVALIDATION: Clear cache after adding item
        this.clearCacheForCompany(updatedCategory.companyId);

        const newItem = updatedCategory.items[updatedCategory.items.length - 1];
        
        return {
            id: newItem._id,
            itemName: newItem.itemName,
            baseUnit: newItem.baseUnit,
            packagingUnit: newItem.packagingUnit,
            sqftPerUnit: newItem.sqftPerUnit,
            isService: newItem.isService,
            pricingType: newItem.pricingType,
            categoryId: updatedCategory._id
        };
    } catch (error) {
        throw error;
    }
};

// Static method: Update item atomically using positional operator
CategorySchema.statics.updateItemAtomic = async function(categoryQuery, itemId, updateData) {
    try {
        // Build the update object with positional operator
        const updateFields = {};
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                updateFields[`items.$.${key}`] = updateData[key];
            }
        });

        const updatedCategory = await this.findOneAndUpdate(
            { ...categoryQuery, 'items._id': itemId },
            { $set: updateFields },
            { new: true, lean: true }
        );

        if (!updatedCategory) {
            throw new Error('Category or item not found');
        }

        const updatedItem = updatedCategory.items.find(item => 
            item._id.toString() === itemId.toString()
        );

        return {
            id: updatedItem._id,
            itemName: updatedItem.itemName,
            baseUnit: updatedItem.baseUnit,
            packagingUnit: updatedItem.packagingUnit,
            sqftPerUnit: updatedItem.sqftPerUnit,
            isService: updatedItem.isService,
            pricingType: updatedItem.pricingType,
            categoryId: updatedCategory._id
        };
    } catch (error) {
        throw error;
    }
};

// Static method: Get all items with aggregation (keep existing efficient logic)
CategorySchema.statics.getAllItemsOptimized = async function(companyId) {
    const startTime = Date.now();
    
    try {
        let matchQuery = {};
        if (companyId) {
            // 🔥 CRITICAL FIX: Ensure companyId is ObjectId for proper matching
            matchQuery.companyId = new mongoose.Types.ObjectId(companyId);
        }

        console.log(`🔍 getAllItemsOptimized: Query for companyId: ${companyId}`.cyan);

        // 🔥 ENHANCED AGGREGATION with better error handling and cursor management
        const aggregationPipeline = [
            { $match: matchQuery },
            { $unwind: '$items' },
            {
                $project: {
                    'id': '$items._id',
                    'itemName': '$items.itemName',
                    'baseUnit': '$items.baseUnit',
                    'packagingUnit': '$items.packagingUnit',
                    'sqftPerUnit': '$items.sqftPerUnit',
                    'isService': '$items.isService',
                    'pricingType': '$items.pricingType',
                    'categoryId': '$_id',
                    'categoryName': '$name'
                }
            },
            { $sort: { categoryName: 1, itemName: 1 } }
        ];

        // Use aggregation with cursor options for better memory management
        const cursor = this.aggregate(aggregationPipeline)
            .option({ 
                allowDiskUse: true, // Allow using disk for large datasets
                maxTimeMS: 30000,   // 30 second timeout
                batchSize: 1000     // Process in batches
            });

        const allItems = await cursor.exec();

        const dbTime = Date.now() - startTime;
        console.log(`⚡ All Items Aggregation: ${dbTime}ms (${allItems.length} items)`.cyan);

        return allItems;
    } catch (error) {
        console.error('❌ getAllItemsOptimized error:', error);
        
        // 🔥 FALLBACK STRATEGY: If aggregation fails, use find with populate
        if (error.name === 'MongoServerError' || error.message.includes('cursor')) {
            console.log('🔄 Aggregation failed, falling back to find query...'.yellow);
            
            try {
                let matchQuery = {};
                if (companyId) {
                    matchQuery.companyId = companyId;
                }
                
                const categories = await this.find(matchQuery)
                    .select('name items')
                    .lean()
                    .maxTimeMS(30000);
                
                const allItems = [];
                categories.forEach(category => {
                    if (category.items && category.items.length > 0) {
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
                    }
                });
                
                // Sort manually
                allItems.sort((a, b) => {
                    if (a.categoryName !== b.categoryName) {
                        return a.categoryName.localeCompare(b.categoryName);
                    }
                    return a.itemName.localeCompare(b.itemName);
                });
                
                console.log(`✅ Fallback query successful: ${allItems.length} items`.green);
                return allItems;
            } catch (fallbackError) {
                console.error('❌ Fallback query also failed:', fallbackError);
                throw fallbackError;
            }
        }
        
        throw error;
    }
};

module.exports = mongoose.model('Category', CategorySchema);
