const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    getDashboardStats,
    getRevenueTrend,
    getProfitBreakdown,
    getActionableItems,
    getCombinedDashboardData,
} = require('../controllers/dashboardController');

router.get('/stats', protect, getDashboardStats);
router.get('/charts/revenue-trend', protect, getRevenueTrend);
router.get('/charts/profit-breakdown', protect, getProfitBreakdown);
router.get('/actionable-items', protect, getActionableItems);

// 🔥 MOBILE OPTIMIZATION: Combined endpoint for all dashboard data
router.get('/combined', protect, getCombinedDashboardData);

module.exports = router;
