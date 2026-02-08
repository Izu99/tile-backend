const jwt = require('jsonwebtoken');
const { errorResponse } = require('../utils/responseHandler');
const User = require('../models/User');

// 🔥 OPTIMIZED: Cache for user data to avoid redundant DB calls
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Protect routes - require authentication - OPTIMIZED
const protect = async (req, res, next) => {
    let token;

    // Check for token in headers
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
        return errorResponse(res, 401, 'Not authorized to access this route');
    }

    try {
        const startTime = Date.now();
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 🔥 OPTIMIZATION: Check cache first to avoid DB call
        const cacheKey = `user_${decoded.id}`;
        const cachedUser = userCache.get(cacheKey);
        
        if (cachedUser && (Date.now() - cachedUser.timestamp) < CACHE_TTL) {
            req.user = cachedUser.data;
            // Ensure id field exists for cached users
            if (!req.user.id && req.user._id) {
                req.user.id = req.user._id.toString();
            }
            console.log(`💾 Auth Cache Hit: ${Date.now() - startTime}ms (User: ${decoded.id})`.green);
            return next();
        }

        // 🔥 OPTIMIZATION: Use lean() and select only required fields for auth
        const user = await User.findById(decoded.id)
            .select('_id name email role companyName')
            .lean();

        if (!user) {
            return errorResponse(res, 401, 'User not found');
        }

        // Add virtual id field for compatibility (since we're using lean())
        user.id = user._id.toString();

        // 🔥 OPTIMIZATION: Cache user data for subsequent requests
        userCache.set(cacheKey, {
            data: user,
            timestamp: Date.now()
        });

        // Clean up expired cache entries periodically
        if (userCache.size > 1000) {
            const now = Date.now();
            for (const [key, value] of userCache.entries()) {
                if (now - value.timestamp > CACHE_TTL) {
                    userCache.delete(key);
                }
            }
        }

        req.user = user;
        
        const dbTime = Date.now() - startTime;
        console.log(`⚡ Auth DB Query: ${dbTime}ms (User: ${decoded.id})`.cyan);
        
        next();
    } catch (error) {
        return errorResponse(res, 401, 'Not authorized to access this route');
    }
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
        } catch (error) {
            // Ignore errors for optional auth
            req.user = null;
        }
    }

    next();
};

// Grant access to specific roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return errorResponse(
                res,
                403,
                `User role ${req.user.role} is not authorized to access this route`
            );
        }
        next();
    };
};

module.exports = {
    protect,
    optionalAuth,
    authorize,
};
