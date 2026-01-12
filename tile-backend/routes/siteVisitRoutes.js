const express = require('express');
const router = express.Router();
const {
  getSiteVisits,
  getSiteVisit,
  createSiteVisit,
  updateSiteVisit,
  deleteSiteVisit,
  getSiteVisitStats,
  getSiteVisitsGroupedByCustomer,
  updateSiteVisitStatus
} = require('../controllers/siteVisitController');

const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Site visit CRUD routes
router.route('/')
  .get(getSiteVisits)
  .post(createSiteVisit);

router.route('/:id')
  .get(getSiteVisit)
  .put(updateSiteVisit)
  .delete(deleteSiteVisit);

// Status update route
router.patch('/:id/status', updateSiteVisitStatus);

// Statistics routes
router.get('/stats/summary', getSiteVisitStats);

// Grouped data routes
router.get('/grouped-by-customer', getSiteVisitsGroupedByCustomer);

module.exports = router;
