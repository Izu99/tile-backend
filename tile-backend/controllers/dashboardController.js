const QuotationDocument = require('../models/QuotationDocument');
require('colors');
const MaterialSale = require('../models/MaterialSale');
const JobCost = require('../models/JobCost');
const PurchaseOrder = require('../models/PurchaseOrder');
const { successResponse } = require('../utils/responseHandler');
const mongoose = require('mongoose');

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

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const period = req.query.period || 'last30days';
        const { start, end } = getDateRange(period);
        const userId = new mongoose.Types.ObjectId(req.user.id);

        // Get all data using Aggregation Pipelines for maximum efficiency
        const [quotationStats, materialSaleStats, jobCostStats, purchaseOrderStats] = await Promise.all([
            // 1. Quotation & Invoice Stats
            QuotationDocument.aggregate([
                { $match: { user: userId, invoiceDate: { $gte: start, $lte: end } } },
                {
                    $project: {
                        type: 1,
                        status: 1,
                        subtotal: {
                            $reduce: {
                                input: "$lineItems",
                                initialValue: 0,
                                in: { $add: ["$$value", { $multiply: ["$$this.quantity", { $ifNull: ["$$this.item.sellingPrice", 0] }] }] }
                            }
                        },
                        totalPayments: {
                            $reduce: {
                                input: "$paymentHistory",
                                initialValue: 0,
                                in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] }
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        invoiceRevenue: { $sum: { $cond: [{ $eq: ["$type", "invoice"] }, "$subtotal", 0] } },
                        outstandingInvoices: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "invoice"] }, { $ne: ["$status", "paid"] }] }, { $subtract: ["$subtotal", "$totalPayments"] }, 0] } },
                        activeProjects: { $sum: { $cond: [{ $in: ["$status", ["pending", "approved"]] }, 1, 0] } },
                        quotationCount: { $sum: 1 },
                        invoiceCount: { $sum: { $cond: [{ $eq: ["$type", "invoice"] }, 1, 0] } }
                    }
                }
            ]),

            // 2. Material Sale Stats
            MaterialSale.aggregate([
                { $match: { user: userId, saleDate: { $gte: start, $lte: end } } },
                {
                    $project: {
                        status: 1,
                        totalAmount: {
                            $reduce: {
                                input: "$items",
                                initialValue: 0,
                                in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] }
                            }
                        },
                        totalCost: {
                            $reduce: {
                                input: "$items",
                                initialValue: 0,
                                in: { $add: ["$$value", { $ifNull: ["$$this.totalCost", 0] }] }
                            }
                        },
                        totalPaid: {
                            $reduce: {
                                input: "$paymentHistory",
                                initialValue: 0,
                                in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] }
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        revenue: { $sum: "$totalAmount" },
                        profit: { $sum: { $subtract: ["$totalAmount", "$totalCost"] } },
                        outstanding: { $sum: { $cond: [{ $ne: ["$status", "paid"] }, { $subtract: ["$totalAmount", "$totalPaid"] }, 0] } },
                        count: { $sum: 1 }
                    }
                }
            ]),

            // 3. Job Cost Stats
            JobCost.aggregate([
                { $match: { user: userId, invoiceDate: { $gte: start, $lte: end } } },
                {
                    $group: {
                        _id: null,
                        profit: { $sum: "$netProfit" },
                        count: { $sum: 1 }
                    }
                }
            ]),

            // 4. Purchase Order Stats
            PurchaseOrder.aggregate([
                { $match: { user: userId, orderDate: { $gte: start, $lte: end } } },
                {
                    $project: {
                        totalAmount: {
                            $reduce: {
                                input: "$items",
                                initialValue: 0,
                                in: { $add: ["$$value", { $multiply: ["$$this.quantity", { $ifNull: ["$$this.unitPrice", 0] }] }] }
                            }
                        }
                    }
                },
                {
                    $group: {
                        _id: null,
                        expenses: { $sum: "$totalAmount" },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const dbTime = Date.now() - startTime;

        // Process results safely
        const q = quotationStats[0] || { invoiceRevenue: 0, outstandingInvoices: 0, activeProjects: 0, quotationCount: 0, invoiceCount: 0 };
        const ms = materialSaleStats[0] || { revenue: 0, profit: 0, outstanding: 0, count: 0 };
        const jc = jobCostStats[0] || { profit: 0, count: 0 };
        const po = purchaseOrderStats[0] || { expenses: 0, count: 0 };

        const totalRevenue = q.invoiceRevenue + ms.revenue;
        const totalProfit = ms.profit + jc.profit;
        const totalOutstanding = q.outstandingInvoices + ms.outstanding;

        const stats = {
            totalRevenue,
            totalProfit,
            totalOutstanding,
            activeProjects: q.activeProjects,
            totalExpenses: po.expenses,
            profitMargin: totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0,
            counts: {
                quotations: q.quotationCount,
                invoices: q.invoiceCount,
                materialSales: ms.count,
                purchaseOrders: po.count,
                jobCosts: jc.count,
            },
            _performance: {
                dbTimeMs: dbTime,
                totalTimeMs: Date.now() - startTime
            }
        };

        console.log(`⏱️ DASHBOARD STATS: DB Query: ${dbTime}ms | Total: ${Date.now() - startTime}ms`.cyan);

        return successResponse(res, 200, 'Dashboard stats retrieved successfully', stats);
    } catch (error) {
        next(error);
    }
};

// @desc    Get revenue trend data
// @route   GET /api/dashboard/charts/revenue-trend
// @access  Private
exports.getRevenueTrend = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const period = req.query.period || 'last30days';
        const { start, end } = getDateRange(period);
        const userId = new mongoose.Types.ObjectId(req.user.id);

        const [invoicesTrend, materialSalesTrend] = await Promise.all([
            QuotationDocument.aggregate([
                { $match: { user: userId, type: 'invoice', invoiceDate: { $gte: start, $lte: end } } },
                {
                    $project: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$invoiceDate" } },
                        subtotal: {
                            $reduce: {
                                input: "$lineItems",
                                initialValue: 0,
                                in: { $add: ["$$value", { $multiply: ["$$this.quantity", { $ifNull: ["$$this.item.sellingPrice", 0] }] }] }
                            }
                        }
                    }
                },
                { $group: { _id: "$date", value: { $sum: "$subtotal" } } }
            ]),
            MaterialSale.aggregate([
                { $match: { user: userId, saleDate: { $gte: start, $lte: end } } },
                {
                    $project: {
                        date: { $dateToString: { format: "%Y-%m-%d", date: "$saleDate" } },
                        totalAmount: {
                            $reduce: {
                                input: "$items",
                                initialValue: 0,
                                in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] }
                            }
                        }
                    }
                },
                { $group: { _id: "$date", value: { $sum: "$totalAmount" } } }
            ])
        ]);

        // Merge and sort
        const revenueByDate = {};

        invoicesTrend.forEach(item => {
            revenueByDate[item._id] = (revenueByDate[item._id] || 0) + item.value;
        });

        materialSalesTrend.forEach(item => {
            revenueByDate[item._id] = (revenueByDate[item._id] || 0) + item.value;
        });

        const chartData = Object.entries(revenueByDate)
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => a.date.localeCompare(b.date));

        console.log(`⏱️ REVENUE TREND: Aggregation: ${Date.now() - startTime}ms`.cyan);

        return successResponse(res, 200, 'Revenue trend retrieved successfully', chartData);
    } catch (error) {
        next(error);
    }
};

// @desc    Get profit breakdown
// @route   GET /api/dashboard/charts/profit-breakdown
// @access  Private
exports.getProfitBreakdown = async (req, res, next) => {
    try {
        const startTime = Date.now();
        const period = req.query.period || 'last30days';
        const { start, end } = getDateRange(period);
        const userId = new mongoose.Types.ObjectId(req.user.id);

        const [msProfit, jcProfit] = await Promise.all([
            MaterialSale.aggregate([
                { $match: { user: userId, saleDate: { $gte: start, $lte: end } } },
                {
                    $project: {
                        profit: {
                            $subtract: [
                                { $reduce: { input: "$items", initialValue: 0, in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] } } },
                                { $reduce: { input: "$items", initialValue: 0, in: { $add: ["$$value", { $ifNull: ["$$this.totalCost", 0] }] } } }
                            ]
                        }
                    }
                },
                { $group: { _id: null, total: { $sum: "$profit" } } }
            ]),
            JobCost.aggregate([
                { $match: { user: userId, invoiceDate: { $gte: start, $lte: end } } },
                { $group: { _id: null, total: { $sum: "$netProfit" } } }
            ])
        ]);

        const chartData = [
            { label: 'Material Sales', value: msProfit[0]?.total || 0 },
            { label: 'Project Jobs', value: jcProfit[0]?.total || 0 },
        ];

        console.log(`⏱️ PROFIT BREAKDOWN: Aggregation: ${Date.now() - startTime}ms`.cyan);

        return successResponse(res, 200, 'Profit breakdown retrieved successfully', chartData);
    } catch (error) {
        next(error);
    }
};

// @desc    Get actionable items
// @route   GET /api/dashboard/actionable-items
// @access  Private
exports.getActionableItems = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const now = new Date();

        const [overdueInvoices, overdueMaterialSales, pendingPOs] = await Promise.all([
            QuotationDocument.find({
                user: userId,
                type: 'invoice',
                status: { $ne: 'paid' },
                dueDate: { $lt: now },
            }).select('documentNumber customerName dueDate amountDue'),
            MaterialSale.find({
                user: userId,
                status: { $in: ['pending', 'partial'] },
            })
                .select('invoiceNumber customerName saleDate amountDue')
                .limit(5),
            PurchaseOrder.find({
                user: userId,
                status: { $in: ['Draft', 'Ordered'] },
            })
                .select('poId customerName orderDate totalAmount')
                .limit(5),
        ]);

        const actionableItems = {
            overdueInvoices: overdueInvoices.map(inv => ({
                id: inv._id,
                title: `Invoice ${inv.documentNumber}`,
                subtitle: inv.customerName,
                value: `$${inv.amountDue.toFixed(2)}`,
                badge: 'Overdue',
            })),
            pendingPayments: overdueMaterialSales.map(ms => ({
                id: ms._id,
                title: `Material Sale ${ms.invoiceNumber}`,
                subtitle: ms.customerName,
                value: `$${ms.amountDue.toFixed(2)}`,
                badge: 'Pending',
            })),
            pendingPOs: pendingPOs.map(po => ({
                id: po._id,
                title: `PO ${po.poId}`,
                subtitle: po.customerName,
                value: `$${po.totalAmount.toFixed(2)}`,
                badge: po.status,
            })),
        };

        return successResponse(res, 200, 'Actionable items retrieved successfully', actionableItems);
    } catch (error) {
        next(error);
    }
};
