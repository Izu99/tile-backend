const mongoose = require('mongoose');
const ActivityLog = require('../models/ActivityLog');
const { createApiResponse } = require('../utils/commonHelpers');
const { errorResponse } = require('../utils/responseHandler');
require('colors');

// 🔥 CACHING: In-memory cache for recent activities
const NodeCache = require('node-cache');
const activityCache = new NodeCache({ 
    stdTTL: 300, // 5 minutes
    checkperiod: 60,
    useClones: false 
});

// Helper function to clear user-specific cache
const clearUserCache = (userId) => {
    const keys = activityCache.keys();
    const userKeys = keys.filter(key => key.includes(userId.toString()));
    
    if (userKeys.length > 0) {
        activityCache.del(userKeys);
        console.log(`🗑️  Cleared ${userKeys.length} cache entries for user ${userId}`.yellow);
    }
};

// @desc    Get latest activities for a user - REFACTORED to use model static methods
// @route   GET /api/activities/recent
// @access  Private
exports.getRecentActivities = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const userId = req.user._id;
        const limit = parseInt(req.query.limit) || 10;
        
        // Check cache first
        const cacheKey = `recent_${userId}_${limit}`;
        let activities = activityCache.get(cacheKey);
        
        if (activities) {
            console.log(`💾 Activity Cache Hit: ${Date.now() - startTime}ms`.green);
            return createApiResponse(
                res,
                200,
                'Recent activities retrieved (cached)',
                { activities, _performance: { cached: true, totalTimeMs: Date.now() - startTime } },
                null,
                startTime
            );
        }

        // Use model's static method
        activities = await ActivityLog.getRecentActivitiesOptimized(userId, limit);

        // Store in cache
        activityCache.set(cacheKey, activities);

        return createApiResponse(
            res,
            200,
            'Recent activities retrieved successfully',
            { activities, _performance: { cached: false, method: 'lean_populate' } },
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ getRecentActivities error:', error);
        next(error);
    }
};

// @desc    Get activities grouped by date - REFACTORED to use model static methods
// @route   GET /api/activities/grouped-by-date
// @access  Private
exports.getActivitiesGroupedByDate = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { startDate, endDate, limit = 50 } = req.query;

        // Use model's optimized aggregation method
        const result = await ActivityLog.getActivitiesGroupedByDateOptimized(
            req.user._id,
            { startDate, endDate, limit: parseInt(limit) }
        );

        return createApiResponse(
            res,
            200,
            'Activities grouped by date retrieved successfully',
            result,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ getActivitiesGroupedByDate error:', error);
        next(error);
    }
};

// @desc    Get activity statistics - REFACTORED to use model static methods
// @route   GET /api/activities/stats
// @access  Private
exports.getActivityStats = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const userId = req.user._id;
        const { days = 30 } = req.query;

        // Check cache first
        const cacheKey = `stats_${userId}_${days}`;
        let stats = activityCache.get(cacheKey);
        
        if (stats) {
            console.log(`💾 Activity Stats Cache Hit: ${Date.now() - startTime}ms`.green);
            return createApiResponse(
                res,
                200,
                'Activity statistics retrieved (cached)',
                { stats, _performance: { cached: true, totalTimeMs: Date.now() - startTime } },
                null,
                startTime
            );
        }

        // Use model's optimized aggregation method
        const result = await ActivityLog.getActivityStatsOptimized(userId, parseInt(days));

        // Store in cache for 10 minutes
        activityCache.set(cacheKey, result.stats, 600);

        return createApiResponse(
            res,
            200,
            'Activity statistics retrieved successfully',
            result,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ getActivityStats error:', error);
        next(error);
    }
};

// @desc    Create activity log - REFACTORED to use model static methods
// @route   POST /api/activities
// @access  Private
exports.createActivityLog = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        // Use model's create method with cache invalidation
        const activity = await ActivityLog.createWithCacheInvalidation(
            { ...req.body, performedBy: req.user._id },
            () => clearUserCache(req.user._id)
        );

        return createApiResponse(
            res,
            201,
            'Activity log created successfully',
            activity,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ createActivityLog error:', error);
        next(error);
    }
};

// @desc    Get activities by action type - REFACTORED to use model static methods
// @route   GET /api/activities/by-action/:action
// @access  Private
exports.getActivitiesByAction = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const { action } = req.params;
        const { limit = 20, page = 1 } = req.query;

        // Use model's optimized method
        const result = await ActivityLog.getActivitiesByActionOptimized(
            req.user._id,
            action,
            { page: parseInt(page), limit: parseInt(limit) }
        );

        return createApiResponse(
            res,
            200,
            `Activities for action '${action}' retrieved successfully`,
            result,
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ getActivitiesByAction error:', error);
        next(error);
    }
};

// @desc    Clear cache manually (for testing/admin)
// @route   DELETE /api/activities/cache
// @access  Private
exports.clearActivityCache = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const keys = activityCache.keys();
        activityCache.flushAll();
        
        console.log(`🗑️  Cleared all activity cache (${keys.length} entries)`.yellow);
        
        return createApiResponse(
            res,
            200,
            'Activity cache cleared successfully',
            { clearedEntries: keys.length },
            null,
            startTime
        );
    } catch (error) {
        console.error('❌ clearActivityCache error:', error);
        next(error);
    }
};