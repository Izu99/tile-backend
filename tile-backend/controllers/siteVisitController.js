const SiteVisit = require('../models/SiteVisit');
const responseHandler = require('../utils/responseHandler');

// Generate unique ID for site visits
const generateSiteVisitId = async (companyId) => {
  const count = await SiteVisit.countDocuments({ companyId });
  return `SV-${(count + 1).toString().padStart(3, '0')}`;
};

// @desc    Get all site visits for a company
// @route   GET /api/site-visits
// @access  Private
const getSiteVisits = async (req, res) => {
  try {
    const { page = 1, limit = 50, search, status, fromDate, toDate } = req.query;
    const companyId = req.user.id;

    let query = { companyId };

    // Add search filter
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { id: { $regex: search, $options: 'i' } },
        { projectTitle: { $regex: search, $options: 'i' } },
        { contactNo: { $regex: search, $options: 'i' } }
      ];
    }

    // Add status filter
    if (status) {
      query.status = status;
    }

    // Add date range filter
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: []
    };

    const result = await SiteVisit.paginate(query, options);

    responseHandler.success(res, 'Site visits retrieved successfully', {
      siteVisits: result.docs || [],
      pagination: {
        page: result.page || 1,
        pages: result.totalPages || 0,
        total: result.totalDocs || 0,
        limit: result.limit || 50
      }
    });
  } catch (error) {
    console.error('Get site visits error:', error);
    responseHandler.error(res, 'Failed to retrieve site visits', 500);
  }
};

// @desc    Get single site visit
// @route   GET /api/site-visits/:id
// @access  Private
const getSiteVisit = async (req, res) => {
  try {
    const siteVisit = await SiteVisit.findOne({
      id: req.params.id,
      companyId: req.user.id
    });

    if (!siteVisit) {
      return responseHandler.error(res, 'Site visit not found', 404);
    }

    responseHandler.success(res, 'Site visit retrieved successfully', siteVisit);
  } catch (error) {
    console.error('Get site visit error:', error);
    responseHandler.error(res, 'Failed to retrieve site visit', 500);
  }
};

// @desc    Create new site visit
// @route   POST /api/site-visits
// @access  Private
const createSiteVisit = async (req, res) => {
  try {
    const companyId = req.user.id;
    const siteVisitId = await generateSiteVisitId(companyId);

    const siteVisitData = {
      ...req.body,
      id: siteVisitId,
      companyId
    };

    const siteVisit = await SiteVisit.create(siteVisitData);

    responseHandler.success(res, 'Site visit created successfully', siteVisit, 201);
  } catch (error) {
    console.error('Create site visit error:', error);
    if (error.code === 11000) {
      responseHandler.error(res, 'Site visit ID already exists', 400);
    } else {
      responseHandler.error(res, 'Failed to create site visit', 500);
    }
  }
};

// @desc    Update site visit
// @route   PUT /api/site-visits/:id
// @access  Private
const updateSiteVisit = async (req, res) => {
  try {
    const siteVisit = await SiteVisit.findOneAndUpdate(
      { id: req.params.id, companyId: req.user.id },
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!siteVisit) {
      return responseHandler.error(res, 'Site visit not found', 404);
    }

    responseHandler.success(res, 'Site visit updated successfully', siteVisit);
  } catch (error) {
    console.error('Update site visit error:', error);
    responseHandler.error(res, 'Failed to update site visit', 500);
  }
};

// @desc    Delete site visit
// @route   DELETE /api/site-visits/:id
// @access  Private
const deleteSiteVisit = async (req, res) => {
  try {
    const siteVisit = await SiteVisit.findOneAndDelete({
      id: req.params.id,
      companyId: req.user.id
    });

    if (!siteVisit) {
      return responseHandler.error(res, 'Site visit not found', 404);
    }

    responseHandler.success(res, 'Site visit deleted successfully');
  } catch (error) {
    console.error('Delete site visit error:', error);
    responseHandler.error(res, 'Failed to delete site visit', 500);
  }
};

// @desc    Get site visit statistics
// @route   GET /api/site-visits/stats/summary
// @access  Private
const getSiteVisitStats = async (req, res) => {
  try {
    const companyId = req.user.id;
    const { fromDate, toDate } = req.query;

    let matchQuery = { companyId };

    if (fromDate || toDate) {
      matchQuery.date = {};
      if (fromDate) matchQuery.date.$gte = new Date(fromDate);
      if (toDate) matchQuery.date.$lte = new Date(toDate);
    }

    const stats = await SiteVisit.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalVisits: { $sum: 1 },
          totalRevenue: { $sum: '$charge' },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          convertedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] }
          },
          invoicedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'invoiced'] }, 1, 0] }
          },
          paidCount: {
            $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] }
          }
        }
      }
    ]);

    const result = stats.length > 0 ? stats[0] : {
      totalVisits: 0,
      totalRevenue: 0,
      pendingCount: 0,
      convertedCount: 0,
      invoicedCount: 0,
      paidCount: 0
    };

    responseHandler.success(res, 'Site visit statistics retrieved successfully', result);
  } catch (error) {
    console.error('Get site visit stats error:', error);
    responseHandler.error(res, 'Failed to retrieve statistics', 500);
  }
};

// @desc    Get site visits grouped by customer
// @route   GET /api/site-visits/grouped-by-customer
// @access  Private
const getSiteVisitsGroupedByCustomer = async (req, res) => {
  try {
    const companyId = req.user.id;
    const { search, fromDate, toDate } = req.query;

    let matchQuery = { companyId };

    if (search) {
      matchQuery.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { id: { $regex: search, $options: 'i' } },
        { projectTitle: { $regex: search, $options: 'i' } }
      ];
    }

    if (fromDate || toDate) {
      matchQuery.date = {};
      if (fromDate) matchQuery.date.$gte = new Date(fromDate);
      if (toDate) matchQuery.date.$lte = new Date(toDate);
    }

    const groupedVisits = await SiteVisit.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$customerName',
          customerName: { $first: '$customerName' },
          contactNo: { $first: '$contactNo' },
          visits: {
            $push: {
              id: '$id',
              projectTitle: '$projectTitle',
              location: '$location',
              date: '$date',
              charge: '$charge',
              status: '$status',
              colorCode: '$colorCode',
              thickness: '$thickness',
              floorCondition: '$floorCondition',
              targetArea: '$targetArea',
              inspection: '$inspection',
              otherDetails: '$otherDetails',
              createdAt: '$createdAt',
              updatedAt: '$updatedAt'
            }
          },
          totalVisits: { $sum: 1 },
          totalRevenue: { $sum: '$charge' }
        }
      },
      {
        $project: {
          customerName: 1,
          contactNo: 1,
          visits: { $sortArray: { input: '$visits', sortBy: { date: -1 } } },
          totalVisits: 1,
          totalRevenue: 1
        }
      },
      { $sort: { customerName: 1 } }
    ]);

    responseHandler.success(res, 'Grouped site visits retrieved successfully', groupedVisits || []);
  } catch (error) {
    console.error('Get grouped site visits error:', error);
    responseHandler.error(res, 'Failed to retrieve grouped site visits', 500);
  }
};

// @desc    Update site visit status
// @route   PATCH /api/site-visits/:id/status
// @access  Private
const updateSiteVisitStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'invoiced', 'paid', 'converted'].includes(status)) {
      return responseHandler.error(res, 'Invalid status', 400);
    }

    const siteVisit = await SiteVisit.findOneAndUpdate(
      { id: req.params.id, companyId: req.user.id },
      { status, updatedAt: Date.now() },
      { new: true }
    );

    if (!siteVisit) {
      return responseHandler.error(res, 'Site visit not found', 404);
    }

    responseHandler.success(res, 'Site visit status updated successfully', siteVisit);
  } catch (error) {
    console.error('Update site visit status error:', error);
    responseHandler.error(res, 'Failed to update site visit status', 500);
  }
};

module.exports = {
  getSiteVisits,
  getSiteVisit,
  createSiteVisit,
  updateSiteVisit,
  deleteSiteVisit,
  getSiteVisitStats,
  getSiteVisitsGroupedByCustomer,
  updateSiteVisitStatus
};
