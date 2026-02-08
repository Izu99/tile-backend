const User = require('../models/User');
const { SAFE_USER_FIELDS } = require('../models/User');
const { createApiResponse } = require('../utils/commonHelpers');
const { errorResponse } = require('../utils/responseHandler');

// @desc    Register user - REFACTORED to use model methods and safe field selection
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { name, email, password, phone, companyName, companyAddress, companyPhone } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return errorResponse(res, 400, 'User already exists with this email');
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            phone,
            companyName,
            companyAddress,
            companyPhone,
        });

        // Get token
        const token = user.getSignedJwtToken();

        // Use model's toAuthJSON method for consistent response
        const userData = user.toAuthJSON();

        return createApiResponse(
            res,
            201,
            'User registered successfully',
            { token, user: userData },
            null,
            startTime
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Login user - ULTRA-FAST OPTIMIZED with DETAILED PERFORMANCE TIMING
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    // 🔥 START TOTAL TIMING
    console.time('Total Login Process');
    const overallStartTime = Date.now();
    
    try {
        const startTime = Date.now();
        const { email, password } = req.body;

        console.log(`🚀 LOGIN START: Processing login for ${email} at ${new Date().toISOString()}`);

        // 🔥 STEP 1: INPUT VALIDATION TIMING
        console.time('Input Validation');
        if (!email || !password) {
            console.timeEnd('Input Validation');
            console.timeEnd('Total Login Process');
            return errorResponse(res, 400, 'Please provide email and password');
        }
        console.timeEnd('Input Validation');
        console.log(`✅ Input validation completed in ${Date.now() - startTime}ms`);

        // 🔥 STEP 2: DATABASE FETCH TIMING
        console.time('Database Fetch');
        const dbFetchStart = Date.now();
        console.log(`🔍 DATABASE: Starting user lookup for ${email}`);
        
        const user = await User.findForAuthentication(email);
        
        const dbFetchTime = Date.now() - dbFetchStart;
        console.timeEnd('Database Fetch');
        console.log(`📊 DATABASE: User lookup took ${dbFetchTime}ms`);
        
        if (dbFetchTime > 5000) {
            console.log(`⚠️  SLOW DATABASE: User lookup took ${dbFetchTime}ms (>5s) - potential bottleneck!`);
        }

        if (!user) {
            console.log(`❌ USER NOT FOUND: ${email} not found in database`);
            console.timeEnd('Total Login Process');
            return errorResponse(res, 401, 'Invalid credentials');
        }

        console.log(`✅ USER FOUND: ${user.name} (${user.email}) - Role: ${user.role}`);

        // 🔥 STEP 3: PASSWORD HASHING/COMPARISON TIMING
        console.time('Password Comparison');
        const passwordStart = Date.now();
        console.log(`🔐 PASSWORD: Starting bcrypt comparison`);
        
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, user.password);
        
        const passwordTime = Date.now() - passwordStart;
        console.timeEnd('Password Comparison');
        console.log(`🔐 PASSWORD: Bcrypt comparison took ${passwordTime}ms`);
        
        if (passwordTime > 2000) {
            console.log(`⚠️  SLOW PASSWORD: Bcrypt took ${passwordTime}ms (>2s) - potential bottleneck!`);
        }

        if (!isMatch) {
            console.log(`❌ INVALID PASSWORD: Password mismatch for ${email}`);
            console.timeEnd('Total Login Process');
            return errorResponse(res, 401, 'Invalid credentials');
        }

        console.log(`✅ PASSWORD MATCH: Authentication successful`);

        // 🔥 STEP 4: ASYNC DATABASE UPDATE (Last Login) - NON-BLOCKING
        console.log(`💾 DATABASE: Scheduling async last login update`);
        const asyncUpdateStart = Date.now();
        
        // 🚀 PERFORMANCE BOOST: Update last login asynchronously (fire-and-forget)
        // This allows the API to return immediately without waiting for the update
        setImmediate(async () => {
            try {
                const updateStart = Date.now();
                await User.findByIdAndUpdate(
                    user._id, 
                    { lastLoginAt: Date.now() },
                    { lean: true }
                );
                const updateTime = Date.now() - updateStart;
                console.log(`✅ ASYNC: Last login updated in ${updateTime}ms (background)`);
                
                if (updateTime > 5000) {
                    console.log(`⚠️  SLOW ASYNC UPDATE: ${updateTime}ms - check database performance`);
                }
            } catch (asyncError) {
                console.error('❌ ASYNC: Last login update failed (non-critical):', asyncError.message);
            }
        });
        
        const asyncScheduleTime = Date.now() - asyncUpdateStart;
        console.log(`⚡ DATABASE: Async update scheduled in ${asyncScheduleTime}ms`);
        
        // Set updateTime to 0 since we're not waiting for the actual update
        const updateTime = asyncScheduleTime;

        // 🔥 STEP 5: TOKEN GENERATION TIMING
        console.time('Token Generation');
        const tokenStart = Date.now();
        console.log(`🎫 TOKEN: Starting JWT generation`);
        
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            {
                id: user._id,
                role: user.role,
                companyId: user._id,
                email: user.email,
                isActive: user.isActive,
                companyName: user.companyName || ''
            },
            process.env.JWT_SECRET,
            {
                expiresIn: process.env.JWT_EXPIRE,
            }
        );
        
        const tokenTime = Date.now() - tokenStart;
        console.timeEnd('Token Generation');
        console.log(`🎫 TOKEN: JWT generation took ${tokenTime}ms`);
        
        if (tokenTime > 500) {
            console.log(`⚠️  SLOW TOKEN: JWT generation took ${tokenTime}ms (>500ms) - potential bottleneck!`);
        }

        // 🔥 STEP 6: RESPONSE PREPARATION TIMING
        console.time('Response Preparation');
        const responseStart = Date.now();
        console.log(`📦 RESPONSE: Preparing user data`);
        
        const userData = {
            _id: user._id,
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            mustChangePassword: user.mustChangePassword,
            lastLoginAt: Date.now(),
            companyName: user.companyName || '',
            
            // 🔥 AVATAR FIELDS: Include for profile display
            avatarId: user.avatarId || '',
            avatarPath: user.avatarPath || '',
            avatarUrl: user.avatarPath ? `${req.protocol}://${req.get('host')}/uploads/${user.avatarPath}` : null,
            signatureId: user.signatureId || '',
            signaturePath: user.signaturePath || '',
            signatureUrl: user.signaturePath ? `${req.protocol}://${req.get('host')}/uploads/${user.signaturePath}` : null,
            avatar: user.avatar || '', // Backward compatibility
            signature: user.signature || '', // Backward compatibility
            
            // 🔥 MINIMAL COUNTERS: Only essential ones for initial UI
            totalQuotationsCount: user.totalQuotationsCount || 0,
            totalInvoicesCount: user.totalInvoicesCount || 0,
            totalPurchaseOrdersCount: user.totalPurchaseOrdersCount || 0,
        };

        const responseData = { token, user: userData };
        const responseSize = JSON.stringify(responseData).length;
        const responseTime = Date.now() - responseStart;
        
        console.timeEnd('Response Preparation');
        console.log(`📦 RESPONSE: Data preparation took ${responseTime}ms`);
        console.log(`📊 RESPONSE: Size ${responseSize} bytes (${(responseSize / 1024).toFixed(2)} KB)`);
        
        if (responseSize > 5000) {
            console.log(`⚠️  LARGE RESPONSE: ${responseSize} bytes (>5KB) - potential bottleneck!`);
        }

        // 🔥 FINAL TIMING SUMMARY
        const totalTime = Date.now() - overallStartTime;
        console.timeEnd('Total Login Process');
        
        console.log(`\n🎯 LOGIN PERFORMANCE SUMMARY:`);
        console.log(`   📊 Database Fetch: ${dbFetchTime}ms`);
        console.log(`   🔐 Password Check: ${passwordTime}ms`);
        console.log(`   💾 Database Update: ${updateTime}ms`);
        console.log(`   🎫 Token Generation: ${tokenTime}ms`);
        console.log(`   📦 Response Prep: ${responseTime}ms`);
        console.log(`   ⏱️  TOTAL TIME: ${totalTime}ms`);
        
        if (totalTime > 10000) {
            console.log(`🚨 CRITICAL: Login took ${totalTime}ms (>${(totalTime/1000).toFixed(1)}s) - MAJOR BOTTLENECK DETECTED!`);
        } else if (totalTime > 5000) {
            console.log(`⚠️  WARNING: Login took ${totalTime}ms (>${(totalTime/1000).toFixed(1)}s) - optimization needed`);
        } else if (totalTime > 1000) {
            console.log(`⚡ GOOD: Login took ${totalTime}ms (${(totalTime/1000).toFixed(1)}s) - acceptable but could be faster`);
        } else {
            console.log(`🚀 EXCELLENT: Login took ${totalTime}ms - very fast!`);
        }
        console.log(`\n`);

        return createApiResponse(
            res,
            200,
            'Login successful',
            responseData,
            null,
            startTime
        );
        
    } catch (error) {
        // 🔥 ENSURE TIMERS END ON ERROR
        console.timeEnd('Total Login Process');
        
        const errorTime = Date.now() - overallStartTime;
        console.log(`💥 LOGIN ERROR after ${errorTime}ms:`, error.message);
        console.log(`📍 ERROR STACK:`, error.stack);
        
        next(error);
    }
};

// @desc    Get current logged in user - REFACTORED to use safe field selection
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const startTime = Date.now();

        // Use safe field selection constant for consistent optimization
        const user = await User.findById(req.user.id)
            .select(SAFE_USER_FIELDS);

        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        // Convert to object and add avatar URLs
        const userData = user.toObject();
        userData.avatarUrl = user.getAvatarUrl(req);
        userData.signatureUrl = user.getSignatureUrl(req);

        return createApiResponse(
            res,
            200,
            'User retrieved successfully',
            userData,
            null,
            startTime
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Get full user data with counters - LAZY LOADED after login
// @route   GET /api/auth/me/full
// @access  Private
exports.getMeFull = async (req, res, next) => {
    try {
        const startTime = Date.now();

        // Get full user data including all computed counters
        const user = await User.findById(req.user.id).lean();

        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        // Use the full toAuthJSON equivalent for lean document
        const fullUserData = {
            _id: user._id,
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            companyName: user.companyName || '',
            companyAddress: user.companyAddress || '',
            companyPhone: user.companyPhone || '',
            websites: user.websites || '',
            role: user.role,
            isActive: user.isActive,
            mustChangePassword: user.mustChangePassword,
            lastLoginAt: user.lastLoginAt,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            
            // File upload fields (paths only, not Base64 data)
            avatarId: user.avatarId || '',
            avatarPath: user.avatarPath || '',
            avatarUrl: user.getAvatarUrl(req), // Generate avatar URL
            signatureId: user.signatureId || '',
            signaturePath: user.signaturePath || '',
            signatureUrl: user.getSignatureUrl(req), // Generate signature URL
            
            // All computed counters for dashboard
            totalCategoriesCount: user.totalCategoriesCount || 0,
            totalItemsCount: user.totalItemsCount || 0,
            totalServicesCount: user.totalServicesCount || 0,
            totalSuppliersCount: user.totalSuppliersCount || 0,
            totalQuotationsCount: user.totalQuotationsCount || 0,
            totalInvoicesCount: user.totalInvoicesCount || 0,
            totalMaterialSalesCount: user.totalMaterialSalesCount || 0,
            totalPurchaseOrdersCount: user.totalPurchaseOrdersCount || 0,
            totalJobCostsCount: user.totalJobCostsCount || 0,
            totalSiteVisitsCount: user.totalSiteVisitsCount || 0,
            
            // Atomic counters
            siteVisitCounter: user.siteVisitCounter || 0,
            materialSaleCounter: user.materialSaleCounter || 0,
            jobCostCounter: user.jobCostCounter || 0,
        };

        return createApiResponse(
            res,
            200,
            'Full user data retrieved successfully',
            fullUserData,
            null,
            startTime
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Get user profile with heavy fields (avatar, signature, etc.) - OPTIMIZED with lean queries
// @route   GET /api/auth/profile
// @access  Private
exports.getProfile = async (req, res, next) => {
    try {
        const startTime = Date.now();

        // Use lean query for faster retrieval of profile fields including file upload fields
        const user = await User.findById(req.user.id)
            .select('avatar signature termsAndConditions bankDetails avatarId avatarPath originalAvatarName signatureId signaturePath originalSignatureName')
            .lean();
        
        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        // Generate avatar and signature URLs if paths exist
        const avatarUrl = user.avatarPath ? `${req.protocol}://${req.get('host')}/uploads/${user.avatarPath}` : null;
        const signatureUrl = user.signaturePath ? `${req.protocol}://${req.get('host')}/uploads/${user.signaturePath}` : null;

        // Return profile data with both old and new fields for compatibility
        const profileData = {
            // File upload fields (new)
            avatarId: user.avatarId || '',
            avatarPath: user.avatarPath || '',
            avatarUrl: avatarUrl,
            signatureId: user.signatureId || '',
            signaturePath: user.signaturePath || '',
            signatureUrl: signatureUrl,
            // Backward compatibility fields (old)
            avatar: user.avatar || '',
            signature: user.signature || '',
            // Other profile data
            termsAndConditions: user.termsAndConditions || '',
            bankDetails: user.bankDetails || {
                bankName: '',
                accountName: '',
                accountNumber: '',
                branchCode: ''
            }
        };

        return createApiResponse(
            res,
            200,
            'Profile data retrieved successfully',
            profileData,
            null,
            startTime
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Get user profile assets (avatar, signature) - OPTIMIZED with lean queries
// @route   GET /api/auth/profile/assets
// @access  Private
exports.getProfileAssets = async (req, res, next) => {
    try {
        const startTime = Date.now();

        // Use lean query for faster retrieval
        const user = await User.findById(req.user.id)
            .select('avatar signature')
            .lean();
        
        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }
        
        const assetsData = {
            avatar: user.avatar || '',
            signature: user.signature || ''
        };

        // Log asset sizes for monitoring
        const avatarSize = (user.avatar || '').length;
        const signatureSize = (user.signature || '').length;
        const totalSize = avatarSize + signatureSize;
        
        console.log(`📊 Profile Assets: Avatar: ${avatarSize} bytes, Signature: ${signatureSize} bytes, Total: ${totalSize} bytes`.cyan);
        
        if (totalSize > 500000) { // 500KB warning
            console.log(`⚠️  Large profile assets detected: ${(totalSize/1024).toFixed(2)}KB`.yellow);
        }

        return createApiResponse(
            res,
            200,
            'Profile assets retrieved successfully',
            assetsData,
            null,
            startTime
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Update user profile - REFACTORED to use model's secure update method
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
    try {
        const startTime = Date.now();

        // Find user
        const user = await User.findById(req.user.id);
        if (!user) {
            return errorResponse(res, 404, 'User not found');
        }

        // Use model's secure update method with field validation
        const updatedUser = await user.updateProfileSecure(req.body, req.user.role);

        return createApiResponse(
            res,
            200,
            'Profile updated successfully',
            updatedUser.toAuthJSON(),
            null,
            startTime
        );
    } catch (error) {
        next(error);
    }
};

// @desc    Change password - OPTIMIZED with model methods
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return errorResponse(res, 400, 'Please provide current and new password');
        }

        // Get user with password using model's authentication method
        const user = await User.findById(req.user.id).select('+password');

        // Check current password using model method
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return errorResponse(res, 401, 'Current password is incorrect');
        }

        // Update password
        user.password = newPassword;
        await user.save();

        // Get new token
        const token = user.getSignedJwtToken();

        return createApiResponse(
            res,
            200,
            'Password changed successfully',
            { token },
            null,
            startTime
        );
    } catch (error) {
        next(error);
    }
};
