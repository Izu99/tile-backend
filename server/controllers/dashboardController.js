const QuotationDocument = require('../models/QuotationDocument');
const MaterialSale = require('../models/MaterialSale');
const JobCost = require('../models/JobCost');
const PurchaseOrder = require('../models/PurchaseOrder');
const User = require('../models/User');
const { successResponse } = require('../utils/responseHandler');
const mongoose = require('mongoose');
const NodeCache = require('node-cache');
require('colors');

// 🔥 IN-MEMORY CACHING: Initialize cache with 15-minute TTL for dashboard data
const dashboardCache = new NodeCache({ 
    stdTTL: 900, // 15 minutes
    checkperiod: 60, // Check for expired keys every 60 seconds
    useClones: false // Better performance for read-heavy operations
});

// 🔥 CACHE HELPER FUNCTIONS
const createCacheKey = (userId, period) => `dashboard:stats:${userId}:${period}`;

// 🔥 INTELLIGENT CACHE INVALIDATION: Clear cache for specific user
const clearCompanyDashboardCache = (userId) => {
    const periods = ['today', 'last7days', 'last30days', 'thisMonth', 'ytd'];
    let clearedCount = 0;
    
    periods.forEach(period => {
        const key = createCacheKey(userId, period);
        if (dashboardCache.del(key)) {
            clearedCount++;
        }
    });
    
    if (clearedCount > 0) {
        console.log(`🗑️  Cleared ${clearedCount} dashboard cache entries for user ${userId}`.yellow);
    }
    
    return clearedCount;
};

// Helper to parse date range from period
const getDateRange = (period) => {
    const now = new Date();
    const today = new Date(now.setHours(0, 0, 0, 0));

    switch (period) {
        case 'today':
            return { start: today, end: new Date() };
        case 'last7days':
            return { start: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000), end: new Date() };
        case 'last30days':
            return { start: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000), end: new Date() };
        case 'thisMonth':
            return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date() };
        case 'ytd':
            return { start: new Date(now.getFullYear(), 0, 1), end: new Date() };
        default:
            return { start: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000), end: new Date() };
    }
};

// --- PRIVATE HELPERS (Internal use only) ---

// 🔥 OPTIMIZED: Revenue trend with efficient date grouping
const _getRevenueTrend = async (userId, start, end) => {
    const [invoicesTrend, materialSalesTrend] = await Promise.all([
        QuotationDocument.aggregate([
            // 🚀 CRITICAL: $match with indexes as the very first stage
            { $match: { user: userId, type: 'invoice', invoiceDate: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$invoiceDate" } },
                    value: { $sum: '$subtotal' }
                }
            }
        ]),
        MaterialSale.aggregate([
            // 🚀 CRITICAL: $match with indexes as the very first stage
            { $match: { user: userId, saleDate: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } },
                    value: { $sum: '$totalAmount' }
                }
            }
        ])
    ]);

    // Merge and sort efficiently
    const revenueByDate = {};

    [...invoicesTrend, ...materialSalesTrend].forEach(item => {
        revenueByDate[item._id] = (revenueByDate[item._id] || 0) + item.value;
    });

    return Object.entries(revenueByDate)
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));
};

// 🔥 OPTIMIZED: Profit breakdown with parallel aggregation
const _getProfitBreakdown = async (userId, start, end) => {
    const [msProfit, jcProfit] = await Promise.all([
        MaterialSale.aggregate([
            // 🚀 CRITICAL: $match with indexes as the very first stage
            { $match: { user: userId, saleDate: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $subtract: ['$totalAmount', '$totalCost'] } }
                }
            }
        ]),
        JobCost.aggregate([
            // 🚀 CRITICAL: $match with indexes as the very first stage
            { $match: { user: userId, invoiceDate: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$netProfit' }
                }
            }
        ])
    ]);

    return [
        { label: 'Material Sales', value: msProfit[0]?.total || 0 },
        { label: 'Project Jobs', value: jcProfit[0]?.total || 0 },
    ];
};

// 🔥 OPTIMIZED: Actionable items with lean queries - PROJECT-ONLY
const _getActionableItems = async (userId) => {
    const now = new Date();

    // 🔥 CRITICAL FIX: Only return project-related actionable items
    // 1. Low margin projects (profit margin < 10%)
    // 2. Projects with losses (netProfit < 0)
    // 3. Overdue project invoices
    const [lowMarginProjects, lossProjects, overdueInvoices] = await Promise.all([
        // Low margin projects (profit margin < 10%)
        JobCost.find({
            user: userId,
            profitMargin: { $lt: 10, $gte: 0 }, // Between 0% and 10%
        })
        .select('jobCostId customerName netProfit profitMargin totalRevenue')
        .sort({ profitMargin: 1 }) // Lowest margin first
        .limit(5)
        .lean(),

        // Projects with losses (negative profit)
        JobCost.find({
            user: userId,
            netProfit: { $lt: 0 }, // Negative profit
        })
        .select('jobCostId customerName netProfit profitMargin totalRevenue')
        .sort({ netProfit: 1 }) // Biggest loss first
        .limit(5)
        .lean(),

        // Overdue project invoices
        QuotationDocument.find({
            user: userId,
            type: 'invoice',
            status: { $ne: 'paid' },
            dueDate: { $lt: now },
        })
        .select('documentNumber customerName dueDate amountDue')
        .sort({ dueDate: 1 }) // Oldest first
        .limit(5)
        .lean(),
    ]);

    // Combine all project issues
    const problemProjects = [];

    // Add low margin projects
    lowMarginProjects.forEach(project => {
        problemProjects.push({
            id: project._id,
            title: `Job ${project.jobCostId}`,
            subtitle: project.customerName,
            value: `${(project.totalRevenue || 0).toFixed(2)}`,
            badge: 'LOW MARGIN',
            badgeColor: 'warning',
            profitMargin: project.profitMargin,
        });
    });

    // Add loss projects
    lossProjects.forEach(project => {
        problemProjects.push({
            id: project._id,
            title: `Job ${project.jobCostId}`,
            subtitle: project.customerName,
            value: `${(project.netProfit || 0).toFixed(2)}`,
            badge: 'LOSS',
            badgeColor: 'error',
            profitMargin: project.profitMargin,
        });
    });

    // Add overdue invoices
    overdueInvoices.forEach(inv => {
        problemProjects.push({
            id: inv._id,
            title: `Invoice ${inv.documentNumber}`,
            subtitle: inv.customerName,
            value: `${(inv.amountDue || 0).toFixed(2)}`,
            badge: 'OVERDUE',
            badgeColor: 'error',
        });
    });

    return {
        problemProjects, // Combined list of all project issues
        lowMarginProjects: lowMarginProjects.map(project => ({
            id: project._id,
            title: `Job ${project.jobCostId}`,
            subtitle: project.customerName,
            value: `${(project.totalRevenue || 0).toFixed(2)}`,
            badge: 'LOW MARGIN',
            profitMargin: project.profitMargin,
        })),
        lossProjects: lossProjects.map(project => ({
            id: project._id,
            title: `Job ${project.jobCostId}`,
            subtitle: project.customerName,
            value: `${(project.netProfit || 0).toFixed(2)}`,
            badge: 'LOSS',
            profitMargin: project.profitMargin,
        })),
        overdueInvoices: overdueInvoices.map(inv => ({
            id: inv._id,
            title: `Invoice ${inv.documentNumber}`,
            subtitle: inv.customerName,
            value: `${(inv.amountDue || 0).toFixed(2)}`,
            badge: 'OVERDUE',
        })),
    };
};

// --- EXPORTED CONTROLLERS ---

// @desc    Get dashboard statistics - ENHANCED with caching
// @route   GET /api/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const period = req.query.period || 'last30days';
        const userId = req.user.id;
        
        // 🔥 IN-MEMORY CACHING: Check cache first
        const cacheKey = createCacheKey(userId, `stats:${period}`);
        const cachedData = dashboardCache.get(cacheKey);
        
        if (cachedData) {
            console.log(`💾 Stats Cache Hit: ${period} for user ${userId} (0ms)`.green);
            return successResponse(res, 200, 'Dashboard stats retrieved successfully (cached)', {
                ...cachedData,
                _performance: {
                    ...cachedData._performance,
                    cacheHit: true,
                    totalTimeMs: Date.now() - startTime
                }
            });
        }

        const { start, end } = getDateRange(period);
        const userObjectId = new mongoose.Types.ObjectId(userId);

        // 🔥 SKINNY CONTROLLER PATTERN: Use model static methods with Promise.all
        const [quotationStats, materialSaleStats, jobCostStats, purchaseOrderStats] = await Promise.all([
            QuotationDocument.getDashboardStats(userObjectId, start, end),
            MaterialSale.getDashboardStats(userObjectId, start, end),
            JobCost.getDashboardStats(userObjectId, start, end),
            PurchaseOrder.getDashboardStats(userObjectId, start, end)
        ]);

        const dbTime = Date.now() - startTime;

        const totalRevenue = quotationStats.invoiceRevenue + materialSaleStats.revenue;
        const totalProfit = materialSaleStats.profit + jobCostStats.profit;
        const totalOutstanding = quotationStats.outstandingInvoices + materialSaleStats.outstanding;

        const stats = {
            totalRevenue,
            totalProfit,
            totalOutstanding,
            activeProjects: quotationStats.activeProjects,
            totalExpenses: purchaseOrderStats.expenses,
            profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0,
            counts: {
                quotations: quotationStats.quotationCount,
                invoices: quotationStats.invoiceCount,
                materialSales: materialSaleStats.count,
                purchaseOrders: purchaseOrderStats.count,
                jobCosts: jobCostStats.count,
            },
            // 🔥 NEW: Separate project-only stats
            projectStats: {
                revenue: quotationStats.invoiceRevenue,
                profit: jobCostStats.profit,
                profitMargin: quotationStats.invoiceRevenue > 0 
                    ? ((jobCostStats.profit / quotationStats.invoiceRevenue) * 100).toFixed(2) 
                    : 0,
                activeProjects: quotationStats.activeProjects,
                totalProjects: jobCostStats.count,
            },
            // 🔥 NEW: Separate material sales stats
            materialSalesStats: {
                revenue: materialSaleStats.revenue,
                profit: materialSaleStats.profit,
                profitMargin: materialSaleStats.revenue > 0 
                    ? ((materialSaleStats.profit / materialSaleStats.revenue) * 100).toFixed(2) 
                    : 0,
                totalSales: materialSaleStats.count,
                outstanding: materialSaleStats.outstanding,
            },
            _performance: {
                cacheHit: false,
                dbTimeMs: dbTime,
                totalTimeMs: Date.now() - startTime
            }
        };

        // 🔥 IN-MEMORY CACHING: Store in cache
        dashboardCache.set(cacheKey, stats);
        console.log(`💾 Stats Cached: ${period} for user ${userId}`.green);

        console.log(`⚡ Dashboard Stats: ${dbTime}ms (skinny controller pattern)`.cyan);

        return successResponse(res, 200, 'Dashboard stats retrieved successfully', stats);
    } catch (error) {
        console.error('❌ getDashboardStats error:', error);
        next(error);
    }
};

// @desc    Get revenue trend data - REFACTORED with private helpers
// @route   GET /api/dashboard/charts/revenue-trend
// @access  Private
exports.getRevenueTrend = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const period = req.query.period || 'last30days';
        const { start, end } = getDateRange(period);
        const userId = new mongoose.Types.ObjectId(req.user.id);

        // 🔥 OPTIMIZED: Use private helper function
        const chartData = await _getRevenueTrend(userId, start, end);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Revenue Trend: ${dbTime}ms (optimized date grouping)`.cyan);

        return successResponse(res, 200, 'Revenue trend retrieved successfully', {
            data: chartData,
            _performance: {
                dbTimeMs: dbTime,
                totalTimeMs: Date.now() - startTime
            }
        });
    } catch (error) {
        console.error('❌ getRevenueTrend error:', error);
        next(error);
    }
};

// @desc    Get profit breakdown - REFACTORED with private helpers
// @route   GET /api/dashboard/charts/profit-breakdown
// @access  Private
exports.getProfitBreakdown = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const period = req.query.period || 'last30days';
        const { start, end } = getDateRange(period);
        const userId = new mongoose.Types.ObjectId(req.user.id);

        // 🔥 OPTIMIZED: Use private helper function
        const chartData = await _getProfitBreakdown(userId, start, end);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Profit Breakdown: ${dbTime}ms (parallel aggregation)`.cyan);

        return successResponse(res, 200, 'Profit breakdown retrieved successfully', {
            data: chartData,
            _performance: {
                dbTimeMs: dbTime,
                totalTimeMs: Date.now() - startTime
            }
        });
    } catch (error) {
        console.error('❌ getProfitBreakdown error:', error);
        next(error);
    }
};

// @desc    Get actionable items - REFACTORED with private helpers
// @route   GET /api/dashboard/actionable-items
// @access  Private
exports.getActionableItems = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const userId = new mongoose.Types.ObjectId(req.user.id);

        // 🔥 OPTIMIZED: Use private helper function
        const actionableItems = await _getActionableItems(userId);

        const dbTime = Date.now() - startTime;
        console.log(`⚡ Actionable Items: ${dbTime}ms (lean queries)`.cyan);

        return successResponse(res, 200, 'Actionable items retrieved successfully', {
            ...actionableItems,
            _performance: {
                dbTimeMs: dbTime,
                totalTimeMs: Date.now() - startTime
            }
        });
    } catch (error) {
        console.error('❌ getActionableItems error:', error);
        next(error);
    }
};

// @desc    Get combined dashboard data - HYBRID OPTIMIZATION (Computed Fields + In-Memory Caching)
// @route   GET /api/dashboard/combined
// @access  Private
exports.getCombinedDashboardData = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const period = req.query.period || 'last30days';
        const userId = req.user.id;
        
        // 🔥 IN-MEMORY CACHING: Check cache first
        const cacheKey = createCacheKey(userId, period);
        const cachedData = dashboardCache.get(cacheKey);
        
        if (cachedData) {
            console.log(`💾 Dashboard Cache Hit: ${period} for user ${userId} (0ms)`.green);
            return successResponse(res, 200, 'Combined dashboard data retrieved successfully (cached)', {
                ...cachedData,
                _performance: {
                    ...cachedData._performance,
                    cacheHit: true,
                    totalTimeMs: Date.now() - startTime
                }
            });
        }

        // Cache miss - fetch data
        console.log(`🔄 Dashboard Cache Miss: ${period} for user ${userId}`.cyan);
        
        const { start, end } = getDateRange(period);
        const userObjectId = new mongoose.Types.ObjectId(userId);
        
        // 🔥 COMPUTED FIELDS INTEGRATION: Get user data with computed fields
        const userData = await User.findById(userId)
            .select('totalCategoriesCount totalItemsCount totalSuppliersCount')
            .lean();
        
        if (!userData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log(`🚀 Combined Dashboard: Starting optimized parallel data fetch...`.cyan);

        // 🔥 SKINNY CONTROLLER PATTERN: Use model static methods with Promise.all
        const [quotationStats, materialSaleStats, jobCostStats, purchaseOrderStats, revenueTrend, profitBreakdown, actionableItems] = await Promise.all([
            QuotationDocument.getDashboardStats(userObjectId, start, end),
            MaterialSale.getDashboardStats(userObjectId, start, end),
            JobCost.getDashboardStats(userObjectId, start, end),
            PurchaseOrder.getDashboardStats(userObjectId, start, end),
            _getRevenueTrend(userObjectId, start, end),
            _getProfitBreakdown(userObjectId, start, end),
            _getActionableItems(userObjectId)
        ]);

        const dbTime = Date.now() - startTime;

        // Calculate derived metrics
        const totalRevenue = quotationStats.invoiceRevenue + materialSaleStats.revenue;
        const totalProfit = materialSaleStats.profit + jobCostStats.profit;
        const totalOutstanding = quotationStats.outstandingInvoices + materialSaleStats.outstanding;

        // 🔥 COMPUTED FIELDS: Use O(1) access from user object
        const stats = {
            totalRevenue,
            totalProfit,
            totalOutstanding,
            activeProjects: quotationStats.activeProjects,
            totalExpenses: purchaseOrderStats.expenses,
            profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0,
            counts: {
                quotations: quotationStats.quotationCount,
                invoices: quotationStats.invoiceCount,
                materialSales: materialSaleStats.count,
                purchaseOrders: purchaseOrderStats.count,
                jobCosts: jobCostStats.count,
                // 🔥 O(1) ACCESS: Direct from computed fields
                categories: userData.totalCategoriesCount || 0,
                items: userData.totalItemsCount || 0,
                suppliers: userData.totalSuppliersCount || 0
            }
        };

        const totalTime = Date.now() - startTime;
        
        const combinedData = {
            stats,
            revenueTrend,
            profitBreakdown,
            actionableItems,
            _performance: {
                cacheHit: false,
                dbTimeMs: dbTime,
                totalTimeMs: totalTime,
                period: period,
                optimizationNote: 'Skinny Controller: Model static methods + Computed fields (O1) + In-memory caching'
            }
        };

        // 🔥 IN-MEMORY CACHING: Store in cache with 15-minute TTL
        dashboardCache.set(cacheKey, combinedData);
        console.log(`💾 Dashboard Cached: ${period} for user ${userId} (TTL: 15min)`.green);

        console.log(`✅ Combined Dashboard: ${totalTime}ms (skinny controller pattern)`.green.bold);

        return successResponse(res, 200, 'Combined dashboard data retrieved successfully', combinedData);
    } catch (error) {
        console.error('❌ getCombinedDashboardData error:', error);
        next(error);
    }
};

// 🔥 EXPORT CACHE INVALIDATION FUNCTION for external use
module.exports.clearCompanyDashboardCache = clearCompanyDashboardCache;