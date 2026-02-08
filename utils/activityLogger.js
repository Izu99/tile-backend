const ActivityLog = require('../models/ActivityLog');

/**
 * 🔥 Activity Logger Utility
 * 
 * Provides convenient methods to log activities throughout the application
 * with automatic error handling and performance optimization.
 */

class ActivityLogger {
    /**
     * Log a generic activity
     * @param {Object} params - Activity parameters
     * @param {string} params.action - Action type (e.g., 'CREATE', 'UPDATE', 'DELETE')
     * @param {string} params.description - Human-readable description
     * @param {ObjectId} params.performedBy - User who performed the action
     * @param {ObjectId} params.targetId - Target document ID (optional)
     * @param {string} params.targetType - Target document type (optional)
     * @param {Object} params.metadata - Additional metadata (optional)
     */
    static async log({
        action,
        description,
        performedBy,
        targetId = null,
        targetType = null,
        metadata = {}
    }) {
        try {
            const activity = await ActivityLog.create({
                action: action.toUpperCase(),
                description,
                performedBy,
                targetId,
                targetType,
                metadata: new Map(Object.entries(metadata))
            });

            console.log(`📝 Activity Logged: ${action} by ${performedBy}`.gray);
            return activity;
        } catch (error) {
            console.error('❌ Failed to log activity:', error.message);
            // Don't throw - logging should not break main functionality
            return null;
        }
    }

    /**
     * Log quotation/invoice activities
     */
    static async logQuotationActivity(action, description, userId, documentId, metadata = {}) {
        return this.log({
            action: `QUOTATION_${action}`,
            description,
            performedBy: userId,
            targetId: documentId,
            targetType: 'QuotationDocument',
            metadata
        });
    }

    /**
     * Log purchase order activities
     */
    static async logPurchaseOrderActivity(action, description, userId, poId, metadata = {}) {
        return this.log({
            action: `PO_${action}`,
            description,
            performedBy: userId,
            targetId: poId,
            targetType: 'PurchaseOrder',
            metadata
        });
    }

    /**
     * Log site visit activities
     */
    static async logSiteVisitActivity(action, description, userId, visitId, metadata = {}) {
        return this.log({
            action: `SITE_VISIT_${action}`,
            description,
            performedBy: userId,
            targetId: visitId,
            targetType: 'SiteVisit',
            metadata
        });
    }

    /**
     * Log user authentication activities
     */
    static async logAuthActivity(action, description, userId, metadata = {}) {
        return this.log({
            action: `AUTH_${action}`,
            description,
            performedBy: userId,
            targetType: 'User',
            metadata
        });
    }

    /**
     * Log system activities
     */
    static async logSystemActivity(action, description, userId, metadata = {}) {
        return this.log({
            action: `SYSTEM_${action}`,
            description,
            performedBy: userId,
            metadata
        });
    }

    /**
     * Bulk log multiple activities (for batch operations)
     * @param {Array} activities - Array of activity objects
     */
    static async bulkLog(activities) {
        try {
            const processedActivities = activities.map(activity => ({
                ...activity,
                action: activity.action.toUpperCase(),
                metadata: new Map(Object.entries(activity.metadata || {}))
            }));

            const result = await ActivityLog.insertMany(processedActivities);
            console.log(`📝 Bulk Activities Logged: ${result.length} activities`.gray);
            return result;
        } catch (error) {
            console.error('❌ Failed to bulk log activities:', error.message);
            return [];
        }
    }

    /**
     * Get activity statistics for monitoring
     */
    static async getLogStats(days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const stats = await ActivityLog.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate }
                    }
                },
                {
                    $group: {
                        _id: '$action',
                        count: { $sum: 1 },
                        lastActivity: { $max: '$createdAt' }
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);

            return stats;
        } catch (error) {
            console.error('❌ Failed to get activity stats:', error.message);
            return [];
        }
    }
}

module.exports = ActivityLogger;