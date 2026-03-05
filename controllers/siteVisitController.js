const SiteVisit = require('../models/SiteVisit');
const responseHandler = require('../utils/responseHandler');
const { logPerformance, createApiResponse } = require('../utils/commonHelpers');
const { getEffectiveCompanyId } = require('../utils/companyHelper');

/**
 * 🔥 LEAN SITE VISIT CONTROLLER
 * 
 * This controller follows the "Skinny Controller" pattern:
 * - Business logic moved to SiteVisit model static methods
 * - Cache management handled by Mongoose middleware
 * - Dashboard counter sync handled by Mongoose middleware
 * - Controllers focus only on HTTP concerns
 */

// @desc    Get all site visits for a company - OPTIMIZED with model static method
// @route   GET /api/site-visits
// @access  Private
const getSiteVisits = async (req, res) => {
  try {
    const startTime = Date.now();
    const companyId = getEffectiveCompanyId(req.user);
    
    // 🔍 ENHANCED DEBUG LOGGING: Track company context
    console.log(`🏢 Site Visits Request Debug:`.yellow);
    console.log(`   Company ID: ${companyId}`.yellow);
    console.log(`   Company Name: ${req.user.companyName || 'Unknown'}`.yellow);
    console.log(`   User Email: ${req.user.email || 'Unknown'}`.yellow);
    console.log(`   Query Params: ${JSON.stringify(req.query)}`.yellow);
    
    // 🔥 LEAN APPROACH: Use model static method for complex query logic
    const result = await SiteVisit.getOptimizedList(companyId, req.query);

    const dbTime = Date.now() - startTime;
    console.log(`⚡ Site Visits Query: ${dbTime}ms (${result.siteVisits.length}/${result.pagination.total} visits, page ${result.pagination.page})`.cyan);
    
    // 🔍 ENHANCED DEBUG LOGGING: Show sample data
    if (result.siteVisits.length > 0) {
      console.log(`📋 Sample Site Visits for Company ${req.user.companyName}:`.blue);
      result.siteVisits.slice(0, 3).forEach((visit, index) => {
        console.log(`   ${index + 1}. ID: ${visit.id}, Customer: ${visit.customerName}, Project: ${visit.projectTitle}`.blue);
      });
    } else {
      console.log(`📋 No site visits found for Company: ${req.user.companyName} (ID: ${companyId})`.yellow);
    }

    if (dbTime > 200) {
      console.log(`⚠️  Slow site visits query detected: ${dbTime}ms`.yellow);
    }

    // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper for standardized responses
    return createApiResponse(
      res, 
      200, 
      'Site visits retrieved successfully', 
      result.siteVisits,
      {
        ...result.pagination,
        _performance: {
          dbTimeMs: dbTime,
          totalTimeMs: Date.now() - startTime
        },
        _debug: {
          companyId: companyId,
          companyName: req.user.companyName,
          userEmail: req.user.email
        }
      },
      startTime
    );
  } catch (error) {
    console.error('❌ getSiteVisits error:', error);
    responseHandler.error(res, 'Failed to retrieve site visits', 500);
  }
};

// @desc    Get single site visit
// @route   GET /api/site-visits/:id
// @access  Private
const getSiteVisit = async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 🔥 LEAN VIRTUALS: Use lean() with virtuals for memory optimization + virtual fields
    const siteVisit = await SiteVisit.findOne({
      id: req.params.id,
      companyId: getEffectiveCompanyId(req.user)
    }).lean({ virtuals: true });

    if (!siteVisit) {
      return responseHandler.error(res, 'Site visit not found', 404);
    }

    const dbTime = Date.now() - startTime;
    console.log(`⚡ Get Site Visit: ${dbTime}ms (ID: ${req.params.id})`.cyan);

    // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
    return createApiResponse(res, 200, 'Site visit retrieved successfully', siteVisit, null, startTime);
  } catch (error) {
    console.error('❌ getSiteVisit error:', error);
    responseHandler.error(res, 'Failed to retrieve site visit', 500);
  }
};

// @desc    Create new site visit - LEAN with middleware handling sync and cache
// @route   POST /api/site-visits
// @access  Private
const createSiteVisit = async (req, res) => {
  try {
    const startTime = Date.now();
    const companyId = getEffectiveCompanyId(req.user);
    
    // 🔍 ENHANCED DEBUG LOGGING: Track creation data
    console.log(`🏗️ Creating Site Visit Debug:`.green);
    console.log(`   Company ID: ${companyId}`.green);
    console.log(`   Company Name: ${req.user.companyName || 'Unknown'}`.green);
    console.log(`   Request Body Keys: ${Object.keys(req.body).join(', ')}`.green);
    console.log(`   Customer Name: ${req.body.customerName}`.green);
    console.log(`   Project Title: ${req.body.projectTitle}`.green);
    console.log(`   Contact No: ${req.body.contactNo}`.green);
    console.log(`   Inspection Data: ${JSON.stringify(req.body.inspection)}`.green);
    
    // 🔥 ATOMIC ID GENERATION: Use model static method with retry logic
    const siteVisit = await SiteVisit.createNewWithAtomicId(companyId, req.body);

    const dbTime = Date.now() - startTime;
    console.log(`⚡ Create Site Visit: ${dbTime}ms (ID: ${siteVisit.id})`.cyan);
    
    // 🔍 ENHANCED DEBUG LOGGING: Show created data
    console.log(`✅ Created Site Visit Data:`.blue);
    console.log(`   ID: ${siteVisit.id}`.blue);
    console.log(`   Customer: ${siteVisit.customerName}`.blue);
    console.log(`   Project: ${siteVisit.projectTitle}`.blue);
    console.log(`   Contact: ${siteVisit.contactNo}`.blue);
    console.log(`   Color Code: ${siteVisit.colorCode}`.blue);
    console.log(`   Thickness: ${siteVisit.thickness}`.blue);
    console.log(`   Floor Condition: ${JSON.stringify(siteVisit.floorCondition)}`.blue);
    console.log(`   Target Area: ${JSON.stringify(siteVisit.targetArea)}`.blue);
    console.log(`   Inspection: ${JSON.stringify(siteVisit.inspection)}`.blue);

    // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
    return createApiResponse(res, 201, 'Site visit created successfully', siteVisit, null, startTime);
  } catch (error) {
    console.error('❌ createSiteVisit error:', error);
    if (error.message.includes('ID collisions')) {
      responseHandler.error(res, 'Failed to generate unique site visit ID after multiple attempts', 500);
    } else if (error.code === 11000) {
      responseHandler.error(res, 'Site visit ID already exists', 400);
    } else {
      responseHandler.error(res, 'Failed to create site visit', 500);
    }
  }
};

// @desc    Update site visit - LEAN with middleware handling cache
// @route   PUT /api/site-visits/:id
// @access  Private
const updateSiteVisit = async (req, res) => {
  try {
    const startTime = Date.now();
    const companyId = getEffectiveCompanyId(req.user);
    
    // 🔥 VALIDATION: Ensure required fields are not empty
    const updateData = { ...req.body, updatedAt: Date.now() };
    
    // Handle siteType validation - provide default if empty
    if (!updateData.siteType || updateData.siteType.trim() === '') {
      updateData.siteType = 'Residential'; // Default value
      console.log('⚠️  Empty siteType provided, using default: Residential'.yellow);
    }
    
    // 🔥 LEAN VIRTUALS: Use atomic findOneAndUpdate with lean virtuals
    // 🔥 MIDDLEWARE HANDLES: Cache invalidation automatically
    const siteVisit = await SiteVisit.findOneAndUpdate(
      { id: req.params.id, companyId: companyId },
      updateData,
      { new: true, runValidators: true }
    ).lean({ virtuals: true });

    if (!siteVisit) {
      return responseHandler.error(res, 'Site visit not found', 404);
    }

    const dbTime = Date.now() - startTime;
    console.log(`⚡ Update Site Visit: ${dbTime}ms (ID: ${req.params.id})`.cyan);

    // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
    return createApiResponse(res, 200, 'Site visit updated successfully', siteVisit, null, startTime);
  } catch (error) {
    console.error('❌ updateSiteVisit error:', error);
    responseHandler.error(res, 'Failed to update site visit', 500);
  }
};

// @desc    Delete site visit - LEAN with middleware handling sync and cache
// @route   DELETE /api/site-visits/:id
// @access  Private
const deleteSiteVisit = async (req, res) => {
  try {
    const startTime = Date.now();
    const companyId = getEffectiveCompanyId(req.user);
    
    // 🔥 MIDDLEWARE HANDLES: Dashboard counter decrement + cache invalidation
    const siteVisit = await SiteVisit.findOneAndDelete({
      id: req.params.id,
      companyId: companyId
    });

    if (!siteVisit) {
      return responseHandler.error(res, 'Site visit not found', 404);
    }

    const dbTime = Date.now() - startTime;
    console.log(`⚡ Delete Site Visit: ${dbTime}ms (ID: ${req.params.id})`.cyan);

    responseHandler.success(res, 'Site visit deleted successfully');
  } catch (error) {
    console.error('❌ deleteSiteVisit error:', error);
    responseHandler.error(res, 'Failed to delete site visit', 500);
  }
};

// @desc    Get site visit statistics - LEAN using model static method
// @route   GET /api/site-visits/stats/summary
// @access  Private
const getSiteVisitStats = async (req, res) => {
  try {
    const startTime = Date.now();
    const companyId = getEffectiveCompanyId(req.user);
    const { fromDate, toDate } = req.query;
    
    // 🔥 LEAN APPROACH: Use model static method with built-in caching
    const result = await SiteVisit.getStats(companyId, fromDate, toDate);

    const totalTime = Date.now() - startTime;
    
    if (result._cached) {
      console.log(`💾 Site Visit Stats: Cache hit - ${totalTime}ms`.green);
    } else {
      console.log(`⚡ Site Visit Stats: DB fetch - ${totalTime}ms`.cyan);
    }

    responseHandler.success(res, 'Site visit statistics retrieved successfully', {
      ...result,
      _performance: {
        cached: result._cached,
        totalTimeMs: totalTime
      }
    });
  } catch (error) {
    console.error('❌ getSiteVisitStats error:', error);
    responseHandler.error(res, 'Failed to retrieve statistics', 500);
  }
};

// @desc    Get site visits grouped by customer - LEAN using model static method
// @route   GET /api/site-visits/grouped-by-customer
// @access  Private
const getSiteVisitsGroupedByCustomer = async (req, res) => {
  try {
    const startTime = Date.now();
    const companyId = getEffectiveCompanyId(req.user);
    const { search, fromDate, toDate } = req.query;

    // 🔥 LEAN APPROACH: Use model static method with built-in caching
    const result = await SiteVisit.getGroupedByCustomer(companyId, { search, fromDate, toDate });

    const totalTime = Date.now() - startTime;
    
    if (result._cached) {
      console.log(`💾 Grouped Site Visits: Cache hit - ${totalTime}ms`.green);
    } else {
      console.log(`⚡ Grouped Site Visits: DB fetch - ${totalTime}ms`.cyan);
    }

    responseHandler.success(res, 'Grouped site visits retrieved successfully', {
      data: result.data,
      _performance: {
        cached: result._cached,
        totalTimeMs: totalTime
      }
    });
  } catch (error) {
    console.error('❌ getSiteVisitsGroupedByCustomer error:', error);
    responseHandler.error(res, 'Failed to retrieve grouped site visits', 500);
  }
};

// @desc    Update site visit status - LEAN with middleware handling cache
// @route   PATCH /api/site-visits/:id/status
// @access  Private
const updateSiteVisitStatus = async (req, res) => {
  try {
    const startTime = Date.now();
    const { status } = req.body;
    const companyId = getEffectiveCompanyId(req.user);

    // 🔥 STATUS VALIDATION: Ensure valid status
    if (!['pending', 'invoiced', 'paid', 'converted'].includes(status)) {
      return responseHandler.error(res, 'Invalid status', 400);
    }

    // 🔥 LEAN VIRTUALS: Use atomic $set operation with lean virtuals
    // 🔥 OPTIMIZED CACHE INVALIDATION: Only stats cache cleared by middleware
    const siteVisit = await SiteVisit.findOneAndUpdate(
      { id: req.params.id, companyId: companyId },
      { $set: { status: status, updatedAt: Date.now() } },
      { new: true }
    ).lean({ virtuals: true });

    if (!siteVisit) {
      return responseHandler.error(res, 'Site visit not found', 404);
    }

    const dbTime = Date.now() - startTime;
    console.log(`⚡ Update Site Visit Status: ${dbTime}ms (SiteVisit: ${req.params.id})`.cyan);

    // 🔥 CONSISTENT API RESPONSE: Use createApiResponse helper
    return createApiResponse(res, 200, 'Site visit status updated successfully', siteVisit, null, startTime);
  } catch (error) {
    console.error('❌ updateSiteVisitStatus error:', error);
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

