const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
            index: true, // Index for filtering by action type
        },
        description: {
            type: String,
            required: true,
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true, // Index for user-based queries
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            // Dynamic reference depending on context, stored as ObjectId
            index: true, // Index for target-based queries
        },
        targetType: {
            type: String,
            enum: ['QuotationDocument', 'PurchaseOrder', 'SiteVisit', 'User', 'Category', 'Supplier', 'Company'],
            // Helps identify what targetId refers to
        },
        metadata: {
            type: Map,
            of: String,
        },
        // 🔥 TTL FIELD: Auto-delete after 90 days (TTL handled by schema index)
        expiresAt: {
            type: Date,
            default: Date.now,
            // Removed expires and index properties to avoid duplicate with explicit TTL index below
        },
    },
    {
        timestamps: true,
    }
);

// 🔥 PERFORMANCE INDEXES
// Compound index for user-based queries with sorting
ActivityLogSchema.index({ performedBy: 1, createdAt: -1 });

// Compound index for action-based queries
ActivityLogSchema.index({ performedBy: 1, action: 1, createdAt: -1 });

// Compound index for target-based queries
ActivityLogSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });

// 🔥 TTL INDEX: Auto-delete documents after 90 days (7776000 seconds)
ActivityLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7776000 });

// 🔥 STATIC METHODS for common queries
ActivityLogSchema.statics.getRecentActivities = function(userId, limit = 10) {
    return this.find({ performedBy: userId })
        .populate('performedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

ActivityLogSchema.statics.getActivitiesByDateRange = function(userId, startDate, endDate) {
    return this.find({
        performedBy: userId,
        createdAt: {
            $gte: startDate,
            $lte: endDate
        }
    })
    .populate('performedBy', 'name email')
    .sort({ createdAt: -1 })
    .lean();
};

// --- SKINNY CONTROLLER STATIC METHODS ---

/**
 * Get recent activities with optimized performance logging
 * @param {string} userId - User ID
 * @param {number} limit - Number of activities to fetch
 * @returns {Promise} Recent activities with performance data
 */
ActivityLogSchema.statics.getRecentActivitiesOptimized = async function(userId, limit = 10) {
    const startTime = Date.now();
    
    try {
        const activities = await this.find({ performedBy: userId })
            .populate('performedBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Recent Activities: ${dbTime}ms (${activities.length} activities)`.cyan);

        return activities;
    } catch (error) {
        console.error('❌ getRecentActivitiesOptimized error:', error);
        throw error;
    }
};

/**
 * Get activities grouped by date with aggregation pipeline
 * @param {string} userId - User ID
 * @param {object} options - Query options
 * @returns {Promise} Grouped activities with summary
 */
ActivityLogSchema.statics.getActivitiesGroupedByDateOptimized = async function(userId, options = {}) {
    const startTime = Date.now();
    const { startDate, endDate, limit = 50 } = options;
    
    try {
        const userObjectId = new mongoose.Types.ObjectId(userId);
        
        // Build match query
        const matchQuery = { performedBy: userObjectId };
        
        if (startDate || endDate) {
            matchQuery.createdAt = {};
            if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
            if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
        }

        // Aggregation pipeline
        const pipeline = [
            { $match: matchQuery },
            { $sort: { createdAt: -1 } },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: 'performedBy',
                    foreignField: '_id',
                    as: 'performedByInfo',
                    pipeline: [
                        { $project: { name: 1, email: 1 } }
                    ]
                }
            },
            {
                $addFields: {
                    performedBy: { $arrayElemAt: ['$performedByInfo', 0] },
                    dateOnly: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    }
                }
            },
            {
                $group: {
                    _id: '$dateOnly',
                    date: { $first: '$dateOnly' },
                    activities: {
                        $push: {
                            _id: '$_id',
                            action: '$action',
                            description: '$description',
                            performedBy: '$performedBy',
                            targetId: '$targetId',
                            targetType: '$targetType',
                            metadata: '$metadata',
                            createdAt: '$createdAt',
                            updatedAt: '$updatedAt'
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: -1 }
            },
            {
                $project: {
                    _id: 0,
                    date: 1,
                    activities: 1,
                    count: 1
                }
            }
        ];

        const groupedActivities = await this.aggregate(pipeline);

        const dbTime = Date.now() - startTime;
        const totalActivities = groupedActivities.reduce((sum, group) => sum + group.count, 0);

        console.log(`🚀 Grouped Activities Aggregation: ${dbTime}ms (${totalActivities} activities, ${groupedActivities.length} days)`.cyan);

        return {
            groupedActivities,
            summary: {
                totalDays: groupedActivities.length,
                totalActivities,
                dateRange: {
                    start: startDate || 'all',
                    end: endDate || 'all'
                }
            },
            _performance: {
                dbTimeMs: dbTime,
                totalTimeMs: Date.now() - startTime,
                method: 'aggregation'
            }
        };
    } catch (error) {
        console.error('❌ getActivitiesGroupedByDateOptimized error:', error);
        throw error;
    }
};

/**
 * Get activity statistics with aggregation pipeline
 * @param {string} userId - User ID
 * @param {number} days - Number of days to analyze
 * @returns {Promise} Activity statistics
 */
ActivityLogSchema.statics.getActivityStatsOptimized = async function(userId, days = 30) {
    const startTime = Date.now();
    
    try {
        const userObjectId = new mongoose.Types.ObjectId(userId);
        
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        // Aggregation pipeline for statistics
        const pipeline = [
            {
                $match: {
                    performedBy: userObjectId,
                    createdAt: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalActivities: { $sum: 1 },
                    actionBreakdown: {
                        $push: '$action'
                    },
                    dailyActivities: {
                        $push: {
                            date: {
                                $dateToString: {
                                    format: '%Y-%m-%d',
                                    date: '$createdAt'
                                }
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    // Count activities by action type
                    actionCounts: {
                        $reduce: {
                            input: '$actionBreakdown',
                            initialValue: {},
                            in: {
                                $mergeObjects: [
                                    '$value',
                                    {
                                        $arrayToObject: [
                                            [{
                                                k: '$this',
                                                v: {
                                                    $add: [
                                                        { $ifNull: [{ $getField: { field: '$this', input: '$value' } }, 0] },
                                                        1
                                                    ]
                                                }
                                            }]
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    // Count activities by date
                    dailyCounts: {
                        $reduce: {
                            input: '$dailyActivities',
                            initialValue: {},
                            in: {
                                $mergeObjects: [
                                    '$value',
                                    {
                                        $arrayToObject: [
                                            [{
                                                k: '$this.date',
                                                v: {
                                                    $add: [
                                                        { $ifNull: [{ $getField: { field: '$this.date', input: '$value' } }, 0] },
                                                        1
                                                    ]
                                                }
                                            }]
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalActivities: 1,
                    actionCounts: 1,
                    dailyCounts: 1,
                    averagePerDay: {
                        $divide: ['$totalActivities', days]
                    }
                }
            }
        ];

        const [result] = await this.aggregate(pipeline);
        
        const stats = result || {
            totalActivities: 0,
            actionCounts: {},
            dailyCounts: {},
            averagePerDay: 0
        };

        const dbTime = Date.now() - startTime;
        console.log(`🚀 Activity Stats Aggregation: ${dbTime}ms (${stats.totalActivities} activities)`.cyan);

        return {
            stats,
            period: {
                days: days,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            },
            _performance: {
                dbTimeMs: dbTime,
                totalTimeMs: Date.now() - startTime,
                cached: false,
                method: 'aggregation'
            }
        };
    } catch (error) {
        console.error('❌ getActivityStatsOptimized error:', error);
        throw error;
    }
};

/**
 * Create activity log with cache invalidation callback
 * @param {object} activityData - Activity data
 * @param {function} cacheInvalidationCallback - Callback to clear cache
 * @returns {Promise} Created activity
 */
ActivityLogSchema.statics.createWithCacheInvalidation = async function(activityData, cacheInvalidationCallback) {
    const startTime = Date.now();
    
    try {
        const activity = await this.create(activityData);

        // Execute cache invalidation callback
        if (typeof cacheInvalidationCallback === 'function') {
            cacheInvalidationCallback();
        }

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Create Activity: ${dbTime}ms`.cyan);

        return activity;
    } catch (error) {
        console.error('❌ createWithCacheInvalidation error:', error);
        throw error;
    }
};

/**
 * Get activities by action type with pagination
 * @param {string} userId - User ID
 * @param {string} action - Action type
 * @param {object} options - Pagination options
 * @returns {Promise} Activities with pagination
 */
ActivityLogSchema.statics.getActivitiesByActionOptimized = async function(userId, action, options = {}) {
    const startTime = Date.now();
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;
    
    try {
        // Use compound index (performedBy + action + createdAt)
        const [total, activities] = await Promise.all([
            this.countDocuments({ performedBy: userId, action }),
            this.find({ performedBy: userId, action })
                .populate('performedBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const dbTime = Date.now() - startTime;
        const totalPages = Math.ceil(total / limit);

        console.log(`⚡ Activities by Action: ${dbTime}ms (${activities.length}/${total} activities)`.cyan);

        return {
            activities,
            pagination: {
                page: page,
                limit: limit,
                total,
                pages: totalPages,
                hasMore: page < totalPages
            },
            _performance: {
                dbTimeMs: dbTime,
                totalTimeMs: Date.now() - startTime,
                method: 'lean_populate'
            }
        };
    } catch (error) {
        console.error('❌ getActivitiesByActionOptimized error:', error);
        throw error;
    }
};

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
