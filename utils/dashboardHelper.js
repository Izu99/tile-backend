const mongoose = require('mongoose');
const User = require('../models/User');
const { clearCompanyDashboardCache } = require('../controllers/dashboardController');
const webSocketService = require('../services/websocketService');
require('colors');

/**
 * 🔥 CENTRAL DASHBOARD SYNCHRONIZATION UTILITY
 * 
 * This utility handles atomic counter updates and cache invalidation
 * for all financial transactions that affect dashboard statistics.
 */

// 🔥 ATOMIC COUNTER UPDATES: Update User model computed fields
const updateAtomicCounters = async (userId, updates) => {
    try {
        if (!userId || !updates || Object.keys(updates).length === 0) {
            return;
        }

        const result = await User.findByIdAndUpdate(
            userId,
            { $inc: updates },
            { new: true, select: 'totalQuotationsCount totalInvoicesCount totalMaterialSalesCount totalJobCostsCount totalPurchaseOrdersCount' }
        );

        if (result) {
            console.log(`⚡ Atomic Counters Updated for user ${userId}:`.cyan, updates);
        } else {
            console.log(`⚠️  User ${userId} not found for counter update`.yellow);
        }

        return result;
    } catch (error) {
        console.error(`❌ Atomic counter update failed for user ${userId}:`, error.message.red);
        // Don't throw - this should not break the main operation
    }
};

// 🔥 COMPREHENSIVE DASHBOARD REFRESH: Cache invalidation + optional background priming
const refreshCompanyStats = async (userId, options = {}) => {
    try {
        const {
            counters = {},
            skipCacheInvalidation = false,
            backgroundPriming = false
        } = options;

        console.log(`🔄 Refreshing dashboard stats for user ${userId}...`.cyan);

        // Parallel execution for optimal performance
        const promises = [];

        // 1. Update atomic counters if provided
        if (Object.keys(counters).length > 0) {
            promises.push(updateAtomicCounters(userId, counters));
        }

        // 2. Clear dashboard cache
        if (!skipCacheInvalidation) {
            promises.push(
                new Promise((resolve) => {
                    const clearedCount = clearCompanyDashboardCache(userId);
                    resolve(clearedCount);
                })
            );
        }

        // Execute all operations in parallel
        const results = await Promise.all(promises);

        // 🔥 REAL-TIME UPDATES: Emit WebSocket event for dashboard refresh
        webSocketService.emitDashboardUpdate(userId, {
            reason: 'transaction_update',
            counters: counters,
            backgroundPriming: backgroundPriming
        });

        // 3. Optional background priming for 'last30days' view
        if (backgroundPriming) {
            setImmediate(async () => {
                try {
                    // Import here to avoid circular dependency
                    const { getCombinedDashboardData } = require('../controllers/dashboardController');
                    
                    // Create mock request for background priming
                    const mockReq = {
                        user: { id: userId },
                        query: { period: 'last30days' }
                    };
                    
                    const mockRes = {
                        status: () => mockRes,
                        json: () => mockRes
                    };

                    await getCombinedDashboardData(mockReq, mockRes, () => {});
                    console.log(`💾 Background priming completed for user ${userId}`.green);
                } catch (primingError) {
                    console.error(`❌ Background priming failed for user ${userId}:`, primingError.message.red);
                }
            });
        }

        console.log(`✅ Dashboard refresh completed for user ${userId}`.green);
        return results;

    } catch (error) {
        console.error(`❌ Dashboard refresh failed for user ${userId}:`, error.message.red);
        // Don't throw - this should not break the main operation
    }
};

// 🔥 SPECIALIZED HELPERS FOR DIFFERENT TRANSACTION TYPES

/**
 * Handle quotation/invoice operations
 */
const handleQuotationTransaction = async (userId, operation, documentType = 'quotation') => {
    const counterField = documentType === 'invoice' ? 'totalInvoicesCount' : 'totalQuotationsCount';
    const increment = operation === 'create' ? 1 : (operation === 'delete' ? -1 : 0);
    
    if (increment !== 0) {
        await refreshCompanyStats(userId, {
            counters: { [counterField]: increment },
            backgroundPriming: true
        });
    } else {
        // For updates, just clear cache
        await refreshCompanyStats(userId, {
            backgroundPriming: true
        });
    }
};

/**
 * Handle material sale operations
 */
const handleMaterialSaleTransaction = async (userId, operation) => {
    const increment = operation === 'create' ? 1 : (operation === 'delete' ? -1 : 0);
    
    if (increment !== 0) {
        await refreshCompanyStats(userId, {
            counters: { totalMaterialSalesCount: increment },
            backgroundPriming: true
        });
    } else {
        // For updates, just clear cache
        await refreshCompanyStats(userId, {
            backgroundPriming: true
        });
    }
};

/**
 * Handle job cost operations
 */
const handleJobCostTransaction = async (userId, operation) => {
    const increment = operation === 'create' ? 1 : (operation === 'delete' ? -1 : 0);
    
    if (increment !== 0) {
        await refreshCompanyStats(userId, {
            counters: { totalJobCostsCount: increment },
            backgroundPriming: true
        });
    } else {
        // For updates, just clear cache
        await refreshCompanyStats(userId, {
            backgroundPriming: true
        });
    }
};

/**
 * Handle purchase order operations
 */
const handlePurchaseOrderTransaction = async (userId, operation) => {
    const increment = operation === 'create' ? 1 : (operation === 'delete' ? -1 : 0);
    
    if (increment !== 0) {
        await refreshCompanyStats(userId, {
            counters: { totalPurchaseOrdersCount: increment },
            backgroundPriming: true
        });
    } else {
        // For updates, just clear cache
        await refreshCompanyStats(userId, {
            backgroundPriming: true
        });
    }
};

// 🔥 BATCH OPERATIONS: For multiple transactions
const handleBatchTransactions = async (userId, transactions) => {
    try {
        const totalCounters = {};
        
        transactions.forEach(({ operation, type, documentType }) => {
            const increment = operation === 'create' ? 1 : (operation === 'delete' ? -1 : 0);
            
            if (increment !== 0) {
                let counterField;
                switch (type) {
                    case 'quotation':
                        counterField = documentType === 'invoice' ? 'totalInvoicesCount' : 'totalQuotationsCount';
                        break;
                    case 'materialSale':
                        counterField = 'totalMaterialSalesCount';
                        break;
                    case 'jobCost':
                        counterField = 'totalJobCostsCount';
                        break;
                    case 'purchaseOrder':
                        counterField = 'totalPurchaseOrdersCount';
                        break;
                }
                
                if (counterField) {
                    totalCounters[counterField] = (totalCounters[counterField] || 0) + increment;
                }
            }
        });

        await refreshCompanyStats(userId, {
            counters: totalCounters,
            backgroundPriming: true
        });

    } catch (error) {
        console.error(`❌ Batch transaction handling failed for user ${userId}:`, error.message.red);
    }
};

module.exports = {
    refreshCompanyStats,
    updateAtomicCounters,
    handleQuotationTransaction,
    handleMaterialSaleTransaction,
    handleJobCostTransaction,
    handlePurchaseOrderTransaction,
    handleBatchTransactions
};