const express = require('express');
const {
    getRecentActivities,
    getActivitiesGroupedByDate,
    getActivityStats,
    createActivityLog,
    getActivitiesByAction,
    clearActivityCache
} = require('../controllers/activityLogController');

const { protect } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// @route   GET /api/activities/recent
// @desc    Get latest activities for the authenticated user
// @access  Private
router.get('/recent', getRecentActivities);

// @route   GET /api/activities/grouped-by-date
// @desc    Get activities grouped by date using aggregation pipeline
// @access  Private
router.get('/grouped-by-date', getActivitiesGroupedByDate);

// @route   GET /api/activities/stats
// @desc    Get activity statistics for the user
// @access  Private
router.get('/stats', getActivityStats);

// @route   GET /api/activities/by-action/:action
// @desc    Get activities filtered by action type
// @access  Private
router.get('/by-action/:action', getActivitiesByAction);

// @route   POST /api/activities
// @desc    Create a new activity log
// @access  Private
router.post('/', createActivityLog);

// @route   DELETE /api/activities/cache
// @desc    Clear activity cache (admin/testing)
// @access  Private
router.delete('/cache', clearActivityCache);

module.exports = router;