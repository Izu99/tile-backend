const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * 🔥 OPTIMIZED USER MODEL FOR PRODUCTION
 * 
 * This model is optimized for:
 * - Fast dashboard loading with computed counters
 * - Secure API responses (excludes sensitive data)
 * - Efficient database queries with proper indexing
 * - Scalable counter updates using atomic operations
 */

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a name'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Please add an email'],
            unique: true, // This creates the index automatically, no need for explicit index
            lowercase: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please add a valid email',
            ],
        },
        password: {
            type: String,
            required: [true, 'Please add a password'],
            minlength: 6,
            select: false, // Don't return password by default
        },
        phone: {
            type: String,
            default: '',
        },
        companyName: {
            type: String,
            default: '',
        },
        companyAddress: {
            type: String,
            default: '',
        },
        companyPhone: {
            type: String,
            default: '',
        },
        websites: {
            type: String,
            default: '',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        role: {
            type: String,
            enum: ['super-admin', 'company', 'customer', 'admin'],
            default: 'company',
        },
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        mustChangePassword: {
            type: Boolean,
            default: false,
        },
        lastLoginAt: {
            type: Date,
        },
        
        // 🔥 FILE UPLOAD FIELDS: Store file paths instead of Base64 strings
        avatarId: {
            type: String,
            default: '',
        },
        avatarPath: {
            type: String,
            default: '',
        },
        originalAvatarName: {
            type: String,
            default: '',
        },
        signatureId: {
            type: String,
            default: '',
        },
        signaturePath: {
            type: String,
            default: '',
        },
        originalSignatureName: {
            type: String,
            default: '',
        },
        
        // 🔄 BACKWARD COMPATIBILITY: Keep deprecated fields as optional
        avatar: {
            type: String,
            default: '',
        },
        signature: {
            type: String,
            default: '',
        },
        
        termsAndConditions: {
            type: String,
            default: '',
        },
        bankDetails: {
            bankName: {
                type: String,
                default: '',
            },
            accountName: {
                type: String,
                default: '',
            },
            accountNumber: {
                type: String,
                default: '',
            },
            branchCode: {
                type: String,
                default: '',
            },
        },
        
        // 🔥 COMPUTED FIELDS: Pre-calculated counters for O(1) dashboard performance
        totalCategoriesCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalItemsCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalServicesCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalSuppliersCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalQuotationsCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalInvoicesCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalMaterialSalesCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalPurchaseOrdersCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalJobCostsCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        totalSiteVisitsCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        
        // 🔥 ATOMIC ID GENERATION COUNTERS
        siteVisitCounter: {
            type: Number,
            default: 0,
            min: 0,
        },
        materialSaleCounter: {
            type: Number,
            default: 0,
            min: 0,
        },
        jobCostCounter: {
            type: Number,
            default: 0,
            min: 0,
        },
        quotationCounter: {
            type: Number,
            default: 0,
            min: 0,
        },
        invoiceCounter: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        timestamps: true,
        toJSON: { 
            virtuals: true,
            transform: function(doc, ret) {
                delete ret.password;
                delete ret.__v;
                return ret;
            }
        },
        toObject: { virtuals: true }
    }
);

// 🔥 STATIC METHODS - Must be defined BEFORE mongoose.model()

// Global system statistics for Super Admin dashboard
UserSchema.statics.getGlobalSystemStats = async function() {
    try {
        const startTime = Date.now();
        
        // Multi-tenant security: Explicit $match for company users only
        const globalStats = await this.aggregate([
            { 
                $match: { 
                    role: 'company',
                    // Explicit security check - only company users count toward global stats
                    $expr: { $eq: ['$role', 'company'] }
                } 
            },
            {
                $group: {
                    _id: null,
                    totalCompanies: { $sum: 1 },
                    activeCompanies: { 
                        $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } 
                    },
                    inactiveCompanies: { 
                        $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] } 
                    },
                    // Global aggregated counts from computed fields
                    totalCategories: { $sum: '$totalCategoriesCount' },
                    totalItems: { $sum: '$totalItemsCount' },
                    totalServices: { $sum: '$totalServicesCount' },
                    totalSuppliers: { $sum: '$totalSuppliersCount' },
                    totalQuotations: { $sum: '$totalQuotationsCount' },
                    totalInvoices: { $sum: '$totalInvoicesCount' },
                    totalMaterialSales: { $sum: '$totalMaterialSalesCount' },
                    totalPurchaseOrders: { $sum: '$totalPurchaseOrdersCount' },
                    totalJobCosts: { $sum: '$totalJobCostsCount' },
                    totalSiteVisits: { $sum: '$totalSiteVisitsCount' }
                }
            }
        ]);

        const dbTime = Date.now() - startTime;
        
        const stats = globalStats[0] || {
            totalCompanies: 0,
            activeCompanies: 0,
            inactiveCompanies: 0,
            totalCategories: 0,
            totalItems: 0,
            totalServices: 0,
            totalSuppliers: 0,
            totalQuotations: 0,
            totalInvoices: 0,
            totalMaterialSales: 0,
            totalPurchaseOrders: 0,
            totalJobCosts: 0,
            totalSiteVisits: 0
        };

        return {
            stats,
            _performance: {
                dbTimeMs: dbTime,
                optimizationNote: 'Global stats using computed fields with multi-tenant security'
            }
        };
    } catch (error) {
        console.error('❌ User.getGlobalSystemStats error:', error);
        throw error;
    }
};

// User growth analytics for growth statistics
UserSchema.statics.getUserGrowthStats = async function(startDate, endDate) {
    try {
        const startTime = Date.now();
        
        // Multi-tenant security: Explicit $match for company users only
        const growthStats = await this.aggregate([
            {
                $match: {
                    role: 'company',
                    createdAt: { $gte: startDate, $lte: endDate },
                    // Explicit security check
                    $expr: { $eq: ['$role', 'company'] }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    newCompanies: { $sum: 1 },
                    activeCompanies: {
                        $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
                    }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        const dbTime = Date.now() - startTime;
        
        return {
            growthData: growthStats,
            _performance: {
                dbTimeMs: dbTime,
                optimizationNote: 'User growth with multi-tenant security'
            }
        };
    } catch (error) {
        console.error('❌ User.getUserGrowthStats error:', error);
        throw error;
    }
};

// Get active tenant IDs for cache priming
UserSchema.statics.getActiveTenantIds = async function() {
    try {
        const activeTenants = await this.find(
            { 
                role: 'company', 
                isActive: true,
                // Explicit security check
                $expr: { $eq: ['$role', 'company'] }
            },
            { _id: 1 }
        ).lean();
        
        return activeTenants.map(tenant => tenant._id.toString());
    } catch (error) {
        console.error('❌ User.getActiveTenantIds error:', error);
        throw error;
    }
};

// Company status management for subscription/status updates
UserSchema.statics.updateCompanyStatus = async function(companyId, statusData) {
    try {
        const { isActive, subscriptionStatus, subscriptionEndDate } = statusData;
        
        // Multi-tenant security: Ensure we're only updating company users
        const updateResult = await this.findOneAndUpdate(
            { 
                _id: companyId, 
                role: 'company',
                // Explicit security check
                $expr: { $eq: ['$role', 'company'] }
            },
            {
                ...(typeof isActive === 'boolean' && { isActive }),
                ...(subscriptionStatus && { subscriptionStatus }),
                ...(subscriptionEndDate && { subscriptionEndDate })
            },
            { new: true, runValidators: true }
        );

        if (!updateResult) {
            throw new Error('Company not found or invalid role');
        }

        return updateResult;
    } catch (error) {
        console.error('❌ User.updateCompanyStatus error:', error);
        throw error;
    }
};

// 🔥 STATIC METHODS FOR ATOMIC COUNTER OPERATIONS

/**
 * Atomically increment a counter field with validation and logging
 */
UserSchema.statics.incrementCounter = async function(userId, counterField, increment = 1) {
    try {
        const updatedUser = await this.findByIdAndUpdate(
            userId,
            { $inc: { [counterField]: increment } },
            { new: true, runValidators: true }
        );
        
        if (updatedUser) {
            console.log(`✅ Counter incremented: ${counterField} +${increment} for user ${userId}`);
            return updatedUser;
        } else {
            console.warn(`⚠️ User not found for counter increment: ${userId}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error incrementing counter ${counterField} for user ${userId}:`, error);
        throw error;
    }
};

/**
 * Atomically decrement a counter field with mandatory validation to prevent negative values
 */
UserSchema.statics.decrementCounter = async function(userId, counterField, decrement = 1) {
    try {
        // 🔥 MANDATORY SAFETY CHECK: Prevent negative counters
        const updatedUser = await this.findOneAndUpdate(
            { 
                _id: userId, 
                [counterField]: { $gte: decrement } // Prevents negative values
            },
            { $inc: { [counterField]: -decrement } },
            { new: true, runValidators: true }
        );
        
        if (updatedUser) {
            console.log(`✅ Counter decremented: ${counterField} -${decrement} for user ${userId}`);
            return updatedUser;
        } else {
            console.warn(`⚠️ Counter decrement blocked (would go negative) or user not found: ${counterField} for user ${userId}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error decrementing counter ${counterField} for user ${userId}:`, error);
        throw error;
    }
};

/**
 * Update multiple counters atomically in a single database operation
 */
UserSchema.statics.updateCounters = async function(userId, counterUpdates) {
    try {
        const incUpdates = {};
        for (const [field, value] of Object.entries(counterUpdates)) {
            incUpdates[field] = value;
        }
        
        const updatedUser = await this.findByIdAndUpdate(
            userId,
            { $inc: incUpdates },
            { new: true, runValidators: true }
        );
        
        if (updatedUser) {
            console.log(`✅ Multiple counters updated for user ${userId}:`, counterUpdates);
            return updatedUser;
        } else {
            console.warn(`⚠️ User not found for counter updates: ${userId}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error updating counters for user ${userId}:`, error);
        throw error;
    }
};

/**
 * Get users for admin management with pagination and optimized indexing
 * 🔥 NETWORK OPTIMIZATION: Minimal data transfer for high-latency connections
 */
UserSchema.statics.getForManagement = async function(options = {}) {
    const startTime = Date.now();
    const {
        page = 1,
        limit = 10,
        role = null,
        search = null,
        isActive = null
    } = options;
    
    try {
        // 🔥 OPTIMIZED QUERY BUILDING: Uses company_management index
        const query = {};
        
        if (role) {
            query.role = role;
        }
        
        if (isActive !== null) {
            query.isActive = isActive;
        }
        
        // 🔥 OPTIMIZED SEARCH: Uses company_search index
        if (search && typeof search === 'string' && search.trim()) {
            const searchRegex = new RegExp(search.trim(), 'i');
            query.$or = [
                { name: searchRegex },
                { email: searchRegex },
                { companyName: searchRegex }
            ];
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        console.log(`🔍 User.getForManagement: Query built in ${Date.now() - startTime}ms`);
        console.log(`🔍 Query:`, JSON.stringify(query, null, 2));
        
        // 🔥 NETWORK OPTIMIZATION: Minimal field selection for high-latency connections
        const minimalFields = {
            _id: 1,
            name: 1,
            email: 1,
            companyName: 1,
            companyAddress: 1,
            companyPhone: 1,
            phone: 1,
            isActive: 1,
            createdAt: 1
            // Exclude all heavy fields: avatar, signature, termsAndConditions, bankDetails, etc.
        };
        
        // 🔥 PERFORMANCE OPTIMIZATION: Execute queries in parallel with minimal data
        const queryStartTime = Date.now();
        
        const findQuery = this.find(query, minimalFields) // Explicit projection
            .sort({ createdAt: -1 }) // Uses company_management index
            .skip(skip)
            .limit(parseInt(limit))
            .lean(); // Memory optimization
            
        // Add index hint for role-based queries
        if (role) {
            findQuery.hint('company_management'); // Use specific index name
        }
        
        const [users, total] = await Promise.all([
            findQuery,
            this.countDocuments(query)
        ]);
        
        const queryTime = Date.now() - queryStartTime;
        const totalTime = Date.now() - startTime;
        
        console.log(`⚡ User.getForManagement: Query executed in ${queryTime}ms, Total: ${totalTime}ms`);
        console.log(`📊 Results: ${users?.length || 0} users, ${total} total`);
        
        // 🔥 PERFORMANCE WARNING
        if (queryTime > 2000) {
            console.log(`🚨 SLOW QUERY: getForManagement took ${queryTime}ms - check network latency!`.red);
        }
        
        return {
            users: users || [],
            pagination: {
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                total: total,
                limit: parseInt(limit),
                hasMore: skip + parseInt(limit) < total
            },
            _performance: {
                queryTimeMs: queryTime,
                totalTimeMs: totalTime,
                indexHint: role ? 'company_management' : 'none',
                networkOptimized: true
            }
        };
    } catch (error) {
        const totalTime = Date.now() - startTime;
        console.error(`❌ User.getForManagement error after ${totalTime}ms:`, error);
        throw error;
    }
};

// 🔥 HIGH-PERFORMANCE INDEXING FOR AUTH AND MANAGEMENT
// Compound indexes for filtered queries
UserSchema.index({ email: 1, isActive: 1 });
UserSchema.index({ role: 1, isActive: 1, createdAt: -1 });
UserSchema.index({ role: 1, companyName: 1 });
UserSchema.index({ lastLoginAt: -1, isActive: 1 });

// Note: email field already has unique: true in schema definition, 
// so no need for explicit email index

// 🔥 ENHANCED PRE-SAVE MIDDLEWARE
UserSchema.pre('save', async function (next) {
    // Handle password encryption
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

// 🔥 AUTHENTICATION AND SECURITY METHODS

// Sign JWT and return with enhanced payload
UserSchema.methods.getSignedJwtToken = function () {
    return jwt.sign(
        {
            id: this._id,
            role: this.role,
            companyId: (this.role === 'admin' && this.companyId) ? this.companyId : this._id,
            email: this.email,
            isActive: this.isActive,
            companyName: this.companyName || ''
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRE,
        }
    );
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Update last login timestamp
UserSchema.methods.updateLastLogin = async function () {
    this.lastLoginAt = new Date();
    return await this.save();
};

// Check if user account is active and can authenticate
UserSchema.methods.canAuthenticate = function () {
    return this.isActive === true;
};

// Find user for authentication with MINIMAL fields for performance - ULTRA-OPTIMIZED
UserSchema.statics.findForAuthentication = async function(email) {
    const methodStart = Date.now();
    console.log(`🔍 USER MODEL: Starting findForAuthentication for ${email}`);
    
    try {
        // 🔥 PERFORMANCE OPTIMIZATION: Use minimal field selection without hint
        const queryStart = Date.now();
        
        const user = await this.findOne({ email })
            .select('+password _id name email role isActive mustChangePassword companyName companyId totalQuotationsCount totalInvoicesCount totalPurchaseOrdersCount avatarId avatarPath signatureId signaturePath avatar signature')
            .lean(); // Use lean() for 2-3x faster queries
            
        const queryTime = Date.now() - queryStart;
        const totalTime = Date.now() - methodStart;
        
        console.log(`📊 USER MODEL: Database query took ${queryTime}ms`);
        console.log(`📊 USER MODEL: Total findForAuthentication took ${totalTime}ms`);
        
        // 🔥 PERFORMANCE MONITORING with specific thresholds
        if (queryTime > 1000) {
            console.log(`🚨 CRITICAL: Database query took ${queryTime}ms (>1s) - CHECK EMAIL INDEX!`);
            console.log(`🔍 SUGGESTION: Verify email index exists`);
        } else if (queryTime > 100) {
            console.log(`⚠️  WARNING: Database query took ${queryTime}ms (>100ms) - network latency?`);
        } else if (queryTime < 10) {
            console.log(`🚀 EXCELLENT: Database query took ${queryTime}ms - index working perfectly!`);
        }
        
        if (user) {
            console.log(`✅ USER MODEL: Found user ${user.name} (${user.email})`);
        } else {
            console.log(`❌ USER MODEL: No user found for ${email}`);
        }
        
        return user;
    } catch (error) {
        const errorTime = Date.now() - methodStart;
        console.error(`💥 USER MODEL: Error after ${errorTime}ms finding user for authentication:`, error);
        throw error;
    }
};

// 🔥 LIGHTWEIGHT LOGIN RESPONSE: Only essential data for initial authentication
UserSchema.methods.toLoginJSON = function() {
    const baseData = {
        _id: this._id,
        id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        isActive: this.isActive,
        mustChangePassword: this.mustChangePassword,
        lastLoginAt: this.lastLoginAt,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        
        // 🔥 MINIMAL COMPANY INFO: Only basic fields
        companyName: this.companyName || '',
        
        // 🔥 ESSENTIAL COUNTERS ONLY: Just the most important ones
        totalQuotationsCount: this.totalQuotationsCount || 0,
        totalInvoicesCount: this.totalInvoicesCount || 0,
        totalPurchaseOrdersCount: this.totalPurchaseOrdersCount || 0,
    };
    
    // 🔥 CRITICAL PERFORMANCE FIX: Completely exclude ALL image fields for super-admin
    // Super admins don't need avatar/signature data in login response (saves ~518KB)
    // DO NOT include Base64 data, paths, IDs, or URLs
    if (this.role !== 'super-admin') {
        // Only include image data for non-super-admin users
        // Use file paths instead of Base64 for better performance
        baseData.avatarId = this.avatarId || '';
        baseData.avatarPath = this.avatarPath || '';
        baseData.signatureId = this.signatureId || '';
        baseData.signaturePath = this.signaturePath || '';
        // 🔥 CRITICAL: Do NOT include Base64 avatar/signature in login response
        // These are huge and should only be loaded when needed
        // baseData.avatar = this.avatar || '';
        // baseData.signature = this.signature || '';
    }
    
    return baseData;
};

// Return safe user data for authentication responses (FULL VERSION - use for profile endpoints)
UserSchema.methods.toAuthJSON = function() {
    const baseData = {
        _id: this._id,
        id: this._id,
        name: this.name,
        email: this.email,
        phone: this.phone || '',
        companyName: this.companyName || '',
        companyAddress: this.companyAddress || '',
        companyPhone: this.companyPhone || '',
        websites: this.websites || '',
        role: this.role,
        isActive: this.isActive,
        mustChangePassword: this.mustChangePassword,
        lastLoginAt: this.lastLoginAt,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        termsAndConditions: this.termsAndConditions || '',
        bankDetails: this.bankDetails || {},
        
        // 🔥 NEW: Include computed counters for dashboard
        totalCategoriesCount: this.totalCategoriesCount || 0,
        totalItemsCount: this.totalItemsCount || 0,
        totalServicesCount: this.totalServicesCount || 0,
        totalSuppliersCount: this.totalSuppliersCount || 0,
        totalQuotationsCount: this.totalQuotationsCount || 0,
        totalInvoicesCount: this.totalInvoicesCount || 0,
        totalMaterialSalesCount: this.totalMaterialSalesCount || 0,
        totalPurchaseOrdersCount: this.totalPurchaseOrdersCount || 0,
        totalJobCostsCount: this.totalJobCostsCount || 0,
        totalSiteVisitsCount: this.totalSiteVisitsCount || 0,
        
        // Atomic counters
        siteVisitCounter: this.siteVisitCounter || 0,
        materialSaleCounter: this.materialSaleCounter || 0,
        jobCostCounter: this.jobCostCounter || 0,
        quotationCounter: this.quotationCounter || 0,
        invoiceCounter: this.invoiceCounter || 0,
    };
    
    // 🔥 CRITICAL PERFORMANCE FIX: Exclude ALL image fields for super-admin
    // Super admins don't need avatar/signature data (saves ~518KB per request)
    // DO NOT include Base64 data, paths, IDs, or URLs
    if (this.role !== 'super-admin') {
        // Only include image data for non-super-admin users
        // Use file paths instead of Base64 for better performance
        baseData.avatarId = this.avatarId || '';
        baseData.avatarPath = this.avatarPath || '';
        baseData.signatureId = this.signatureId || '';
        baseData.signaturePath = this.signaturePath || '';
        // 🔥 CRITICAL: Do NOT include Base64 avatar/signature in auth response
        // These are huge and should only be loaded when specifically requested
        // baseData.avatar = this.avatar || '';
        // baseData.signature = this.signature || '';
    }
    
    return baseData;
};

// 🔥 SAFE USER FIELDS: Constant for consistent field selection across auth endpoints
const SAFE_USER_FIELDS = '_id name email phone companyName companyAddress companyPhone role isActive mustChangePassword lastLoginAt createdAt updatedAt avatarId avatarPath signatureId signaturePath avatar signature termsAndConditions bankDetails websites';

// 🔥 PROFILE UPDATE VALIDATION: Allowed fields for security
const ALLOWED_PROFILE_FIELDS = [
    'name', 'phone', 'companyAddress', 'companyPhone', 
    'avatar', 'termsAndConditions', 'bankDetails', 'signature', 'websites'
];

// 🔥 AVATAR URL GENERATION METHOD
UserSchema.methods.getAvatarUrl = function(req) {
    if (!this.avatarPath) return null;
    
    if (req) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        return `${baseUrl}/tile_uploads/${this.avatarPath}`;
    }
    
    // Fallback for cases without request object
    return `/tile_uploads/${this.avatarPath}`;
};

// 🔥 SIGNATURE URL GENERATION METHOD
UserSchema.methods.getSignatureUrl = function(req) {
    if (!this.signaturePath) return null;
    
    if (req) {
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        return `${baseUrl}/tile_uploads/${this.signaturePath}`;
    }
    
    // Fallback for cases without request object
    return `/tile_uploads/${this.signaturePath}`;
};

// 🔥 SECURE PROFILE UPDATE METHOD
UserSchema.methods.updateProfileSecure = async function(updateData, userRole) {
    try {
        console.log('🔄 Starting secure profile update for user:', this._id);
        console.log('📝 Update data received:', Object.keys(updateData));
        
        // Validate allowed fields based on role
        const allowedFields = [...ALLOWED_PROFILE_FIELDS];
        
        // Super admin can update additional fields
        if (userRole === 'super-admin') {
            allowedFields.push('companyName', 'isActive', 'role');
        }
        
        // Filter and apply only allowed fields
        const filteredData = {};
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                // Special handling for nested objects
                if (key === 'bankDetails' && typeof value === 'object') {
                    // Validate bank details structure
                    const validBankFields = ['bankName', 'accountName', 'accountNumber', 'branchCode'];
                    const filteredBankDetails = {};
                    
                    for (const [bankKey, bankValue] of Object.entries(value)) {
                        if (validBankFields.includes(bankKey)) {
                            filteredBankDetails[bankKey] = bankValue || '';
                        }
                    }
                    filteredData[key] = filteredBankDetails;
                } else {
                    filteredData[key] = value;
                }
            } else {
                console.log(`⚠️ Skipping unauthorized field: ${key}`);
            }
        }
        
        console.log('✅ Filtered update data:', Object.keys(filteredData));
        
        // Use findByIdAndUpdate to avoid validation issues with existing counter fields
        const updatedUser = await this.constructor.findByIdAndUpdate(
            this._id,
            { $set: filteredData },
            { 
                new: true, 
                runValidators: true,
                context: 'query' // This ensures only the updated fields are validated
            }
        );
        
        if (!updatedUser) {
            throw new Error('User not found during update');
        }
        
        console.log('💾 Profile updated successfully for user:', this._id);
        
        return updatedUser;
    } catch (error) {
        console.error('❌ Error in updateProfileSecure:', error);
        throw error;
    }
};

// 🔥 CREATE THE MODEL - All static methods must be defined BEFORE this line
const User = mongoose.model('User', UserSchema);

// Export constants for use in controllers
User.SAFE_USER_FIELDS = SAFE_USER_FIELDS;
User.ALLOWED_PROFILE_FIELDS = ALLOWED_PROFILE_FIELDS;

module.exports = User;