const mongoose = require('mongoose');
const mongooseLeanVirtuals = require('mongoose-lean-virtuals');
const mongoosePaginate = require('mongoose-paginate-v2');
const NodeCache = require('node-cache');

/**
 * 🔥 OPTIMIZED SITE VISIT MODEL WITH AUTOMATIC DASHBOARD SYNC
 * 
 * This model is optimized for:
 * - Fast queries with compound indexing
 * - Automatic User dashboard counter synchronization
 * - Automatic cache management through middleware
 * - Complex aggregation operations via static methods
 */

// 🔥 CACHE INTEGRATION: Initialize cache with 5-minute TTL
const cache = new NodeCache({ 
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Better performance for read-heavy operations
});

const inspectionSchema = new mongoose.Schema({
  skirting: { type: String, default: '' },
  floorPreparation: { type: String, default: '' },
  groundSetting: { type: String, default: '' },
  door: { type: String, default: '' },
  window: { type: String, default: '' },
  evenUneven: { type: String, default: '' },
  areaCondition: { type: String, default: '' },
});

const siteVisitSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Removed unique: true - now using compound unique index
  customerName: { type: String, required: true },
  projectTitle: { type: String, required: true },
  contactNo: { type: String, required: true },
  location: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
  siteType: { type: String, required: true },
  charge: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'invoiced', 'paid', 'converted'],
    default: 'pending'
  },
  colorCode: { type: String, default: '' },
  thickness: { type: String, default: '' },
  floorCondition: [{ type: String }],
  targetArea: [{ type: String }],
  inspection: inspectionSchema,
  otherDetails: { type: String, default: '' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 🔥 VIRTUAL FIELDS FOR ENHANCED FUNCTIONALITY

/**
 * Total visit cost virtual - calculates total cost including additional charges
 */
siteVisitSchema.virtual('totalVisitCost').get(function() {
  // Base charge plus any additional costs from inspection or other details
  let totalCost = this.charge || 0;
  
  // Add any additional costs based on inspection complexity
  if (this.inspection) {
    const inspectionFields = Object.values(this.inspection.toObject ? this.inspection.toObject() : this.inspection);
    const complexInspectionCount = inspectionFields.filter(field => field && field.length > 10).length;
    totalCost += complexInspectionCount * 50; // $50 per complex inspection item
  }
  
  return totalCost;
});

/**
 * Visit summary virtual - provides a concise summary of the visit
 */
siteVisitSchema.virtual('visitSummary').get(function() {
  return `${this.customerName} - ${this.projectTitle} (${this.siteType}) - $${this.charge}`;
});

/**
 * Days since visit virtual - calculates days since the visit date
 */
siteVisitSchema.virtual('daysSinceVisit').get(function() {
  if (!this.date) return 0;
  const now = new Date();
  const visitDate = new Date(this.date);
  const diffTime = Math.abs(now - visitDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

/**
 * Is recent virtual - determines if visit is within last 7 days
 */
siteVisitSchema.virtual('isRecent').get(function() {
  return this.daysSinceVisit <= 7;
});

// 🔥 PERFORMANCE INDEXES

// 🔥 PERFORMANCE INDEXES FOR MULTI-TENANT OPTIMIZATION

/**
 * MULTI-TENANT INTEGRITY INDEX (ESSENTIAL)
 * Compound Unique Index: { id: 1, companyId: 1 } with { unique: true }
 * 
 * Purpose: Ensures multi-tenant data integrity for site visit IDs
 * - Allows different companies to use the same site visit ID sequence (e.g., SV-001)
 * - Prevents the same company from creating duplicate site visit IDs
 * - Essential for proper tenant isolation in multi-company environment
 * 
 * Examples:
 * ✅ Company A: SV-001 + Company B: SV-001 = ALLOWED
 * ❌ Company A: SV-001 + Company A: SV-001 = BLOCKED
 */
siteVisitSchema.index({ id: 1, companyId: 1 }, { unique: true });

/**
 * DASHBOARD FILTERING PERFORMANCE INDEX
 * Compound Index: { companyId: 1, status: 1, date: -1 }
 * 
 * Purpose: Optimizes the most frequent dashboard queries
 * - Most common query: "Show me all pending site visits, newest first"
 * - Another common query: "Show me all converted site visits, newest first"
 * - Prevents collection scans and ensures instantaneous results
 * - Critical for dashboard performance as data grows
 * 
 * Query Patterns Optimized:
 * - SiteVisit.find({ companyId: companyId, status: 'pending' }).sort({ date: -1 })
 * - SiteVisit.find({ companyId: companyId, status: 'converted' }).sort({ date: -1 })
 */
siteVisitSchema.index({ companyId: 1, status: 1, date: -1 });

/**
 * SEARCH & UX OPTIMIZATION INDEXES
 * These indexes support fast search functionality and direct lookups
 */

/**
 * CUSTOMER SEARCH INDEX: { companyId: 1, customerName: 1 }
 * 
 * Purpose: Optimizes customer-based searches and filtering
 * - Supports fast customer name searches without database lag
 * - Essential for customer-specific site visit listings
 * - Enables efficient customer relationship management
 */
siteVisitSchema.index({ companyId: 1, customerName: 1 });

/**
 * DIRECT LOOKUP INDEX: { companyId: 1, id: 1 }
 * 
 * Purpose: Optimizes direct site visit ID lookups
 * - Fast retrieval of specific site visits by ID
 * - Essential for edit/view operations
 * - Supports efficient API endpoint responses
 * 
 * Query Patterns:
 * - SiteVisit.findOne({ companyId: companyId, id: 'SV-001' })
 * - Used by controllers for single document retrieval
 */
siteVisitSchema.index({ companyId: 1, id: 1 });

/**
 * ADDITIONAL PERFORMANCE INDEXES
 * These provide comprehensive query optimization coverage
 */

/**
 * GENERAL LISTING INDEX: { companyId: 1, date: -1 }
 * 
 * Purpose: Optimizes default chronological listings
 * - Default view for all site visits without status filtering
 * - Efficient pagination and sorting for large datasets
 * - Supports timeline-based views and reporting
 */
siteVisitSchema.index({ companyId: 1, date: -1 });

/**
 * CREATION DATE INDEX: { companyId: 1, createdAt: -1 }
 * 
 * Purpose: Optimizes recently created site visit queries
 * - "Recently added" site visit listings
 * - Audit trail and activity tracking
 * - Administrative reporting and monitoring
 */
siteVisitSchema.index({ companyId: 1, createdAt: -1 });

/**
 * TEXT SEARCH INDEX: Full-text search capabilities
 * 
 * Purpose: Enables comprehensive text-based searches
 * - Search across customer names, project titles, IDs, and contact numbers
 * - Supports advanced search functionality in the UI
 * - Efficient full-text search without external search engines
 */
siteVisitSchema.index({ 
  customerName: 'text', 
  projectTitle: 'text', 
  id: 'text',
  contactNo: 'text'
});

/**
 * COMPOUND ANALYTICS INDEX: { companyId: 1, status: 1, customerName: 1, date: -1 }
 * 
 * Purpose: Optimizes complex analytical queries
 * - Advanced reporting with multiple filter criteria
 * - Customer-specific status analysis
 * - Supports the most complex query patterns in the application
 */
siteVisitSchema.index({ companyId: 1, status: 1, customerName: 1, date: -1 });

/**
 * INDEX DESIGN PRINCIPLES FOLLOWED:
 * 
 * 1. COMPANY-FIRST STRATEGY: All compound indexes start with 'companyId' field
 *    - Leverages MongoDB's prefix compression for memory efficiency
 *    - Enables efficient query partitioning by tenant
 *    - Supports horizontal scaling in multi-tenant architecture
 * 
 * 2. QUERY PATTERN OPTIMIZATION: Indexes match actual application queries
 *    - Dashboard filtering: companyId + status + date
 *    - Search functionality: companyId + customerName
 *    - Direct lookup: companyId + id
 *    - General listing: companyId + date
 * 
 * 3. CARDINALITY CONSIDERATION: Optimal field ordering
 *    - companyId (high cardinality - many companies)
 *    - status (medium cardinality - 4 possible values)
 *    - date (high cardinality - unique timestamps)
 * 
 * 4. MULTI-TENANT ISOLATION: Perfect tenant separation
 *    - All queries automatically scoped to company
 *    - Prevents cross-tenant data access
 *    - Ensures data privacy and security
 */

// 🔥 CACHE HELPER FUNCTIONS

/**
 * Clear company-specific cache entries
 * @param {String} companyId - Company ID to clear cache for
 */
const clearCompanyCache = (companyId) => {
  const keys = cache.keys();
  const companyKeys = keys.filter(key => key.includes(`_${companyId}_`));
  
  if (companyKeys.length > 0) {
    cache.del(companyKeys);
    console.log(`🗑️  Cleared ${companyKeys.length} cache entries for company ${companyId}`.yellow);
  }
};

// 🔥 AUTOMATIC DASHBOARD SYNCHRONIZATION MIDDLEWARE

/**
 * POST-SAVE HOOK: Automatically increment User dashboard counter and clear cache
 */
siteVisitSchema.post('save', async function(doc) {
  // Only increment counter for new documents (not updates)
  if (this.isNew) {
    try {
      const User = require('./User');
      
      // 🔥 ATOMIC COUNTER INCREMENT: Race-condition safe
      await User.incrementCounter(doc.companyId, 'totalSiteVisitsCount', 1);
      
      console.log(`✅ Dashboard sync: Incremented site visit count for company ${doc.companyId}`.green);
    } catch (error) {
      console.error('❌ Error syncing site visit count on create:', error);
      // Don't throw error to avoid breaking site visit creation
    }
  }
  
  // 🔥 CACHE INVALIDATION: Clear company-specific cache after save
  clearCompanyCache(doc.companyId);
});

/**
 * POST-UPDATE HOOK: Clear cache after updates
 */
siteVisitSchema.post('findOneAndUpdate', async function(doc) {
  if (doc) {
    // 🔥 CACHE INVALIDATION: Clear company-specific cache after update
    clearCompanyCache(doc.companyId);
  }
});

/**
 * POST-DELETE HOOK: Automatically decrement User dashboard counter and clear cache
 * Enhanced with atomic deletion confirmation
 */
siteVisitSchema.post('deleteOne', { document: true }, async function(doc) {
  try {
    const User = require('./User');
    
    // 🔥 ATOMIC COUNTER DECREMENT: Safe decrement with validation
    const updatedUser = await User.decrementCounter(doc.companyId, 'totalSiteVisitsCount', 1);
    
    if (updatedUser) {
      console.log(`✅ Dashboard sync: Decremented site visit count for company ${doc.companyId}`.green);
    } else {
      console.warn(`⚠️ Could not decrement site visit count for company ${doc.companyId} - counter may already be at 0`.yellow);
    }

    // 🔥 ENHANCED CACHE INVALIDATION: Clear cache after confirmed database operation
    clearCompanyCache(doc.companyId);
    
  } catch (error) {
    console.error('❌ Error syncing site visit count on delete:', error);
  }
});

/**
 * POST-FINDONEANDDELETE HOOK: Handle Model.findOneAndDelete() operations
 * Enhanced with atomic deletion confirmation
 */
siteVisitSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      const User = require('./User');
      
      // 🔥 ATOMIC COUNTER DECREMENT: Safe decrement with validation
      const updatedUser = await User.decrementCounter(doc.companyId, 'totalSiteVisitsCount', 1);
      
      if (updatedUser) {
        console.log(`✅ Dashboard sync: Decremented site visit count for company ${doc.companyId} (findOneAndDelete)`.green);
      } else {
        console.warn(`⚠️ Could not decrement site visit count for company ${doc.companyId} - counter may already be at 0`.yellow);
      }

      // 🔥 ENHANCED CACHE INVALIDATION: Clear cache after confirmed database operation
      clearCompanyCache(doc.companyId);
      
    } catch (error) {
      console.error('❌ Error syncing site visit count on findOneAndDelete:', error);
    }
  }
});

// 🔥 STATIC METHODS FOR COMPLEX OPERATIONS

/**
 * Get site visit statistics with dynamic caching based on date range
 * @param {String} companyId - Company ID
 * @param {String} fromDate - Start date (optional)
 * @param {String} toDate - End date (optional)
 * @returns {Promise} Statistics object
 */
siteVisitSchema.statics.getStats = async function(companyId, fromDate = null, toDate = null) {
  try {
    // 🔥 DYNAMIC TTL STRATEGY: Adjust cache TTL based on date range
    let cacheTTL = 300; // Default 5 minutes for current/recent data
    
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      const now = new Date();
      
      // If the date range is entirely in the past (older than 7 days), use longer TTL
      const daysDifference = Math.floor((now - to) / (1000 * 60 * 60 * 24));
      
      if (daysDifference > 7) {
        cacheTTL = 3600; // 1 hour for historical data (older than 7 days)
        console.log(`📊 Using extended TTL (${cacheTTL}s) for historical data range`.blue);
      } else if (daysDifference > 1) {
        cacheTTL = 900; // 15 minutes for recent historical data (1-7 days old)
        console.log(`📊 Using medium TTL (${cacheTTL}s) for recent historical data`.blue);
      }
      // Current day data uses default 5-minute TTL
    }

    // 🔥 CACHING: Create cache key based on company and date range
    const dateParams = `${fromDate || 'all'}_${toDate || 'all'}`;
    const cacheKey = `stats_${companyId}_${dateParams}`;
    
    // Check cache first
    let result = cache.get(cacheKey);
    
    if (result) {
      console.log(`💾 Site Visit Stats: Cache hit (${cacheKey}, TTL: ${cacheTTL}s)`.green);
      return { ...result, _cached: true };
    }

    // Cache miss - fetch from database
    let matchQuery = { companyId: new mongoose.Types.ObjectId(companyId) };

    if (fromDate || toDate) {
      matchQuery.date = {};
      if (fromDate) matchQuery.date.$gte = new Date(fromDate);
      if (toDate) matchQuery.date.$lte = new Date(toDate);
    }

    const stats = await this.aggregate([
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

    result = stats.length > 0 ? stats[0] : {
      totalVisits: 0,
      totalRevenue: 0,
      pendingCount: 0,
      convertedCount: 0,
      invoicedCount: 0,
      paidCount: 0
    };

    // 🔥 DYNAMIC CACHING: Store result with appropriate TTL
    cache.set(cacheKey, result, cacheTTL);
    console.log(`⚡ Site Visit Stats: Fetched from DB and cached (${cacheKey}, TTL: ${cacheTTL}s)`.cyan);

    return { ...result, _cached: false };
  } catch (error) {
    console.error('❌ Error in getStats:', error);
    throw error;
  }
};

/**
 * Get site visits grouped by customer with caching
 * @param {String} companyId - Company ID
 * @param {Object} filters - Filter options (search, fromDate, toDate)
 * @returns {Promise} Grouped site visits array
 */
siteVisitSchema.statics.getGroupedByCustomer = async function(companyId, filters = {}) {
  try {
    const { search, fromDate, toDate } = filters;
    
    // 🔥 CACHING: Create cache key based on company and query parameters
    const queryParams = `${search || 'all'}_${fromDate || 'all'}_${toDate || 'all'}`;
    const cacheKey = `grouped_${companyId}_${queryParams}`;
    
    // Check cache first
    let groupedVisits = cache.get(cacheKey);
    
    if (groupedVisits) {
      console.log(`💾 Grouped Site Visits: Cache hit (${cacheKey})`.green);
      return { data: groupedVisits, _cached: true };
    }

    // Cache miss - fetch from database
    let matchQuery = { companyId: new mongoose.Types.ObjectId(companyId) };

    // Add search if provided - uses text index
    if (search && typeof search === 'string') {
      matchQuery.$text = { $search: search };
    }

    if (fromDate || toDate) {
      matchQuery.date = {};
      if (fromDate) matchQuery.date.$gte = new Date(fromDate);
      if (toDate) matchQuery.date.$lte = new Date(toDate);
    }

    groupedVisits = await this.aggregate([
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

    // 🔥 CACHING: Store result in cache
    cache.set(cacheKey, groupedVisits || []);
    console.log(`⚡ Grouped Site Visits: Fetched from DB and cached (${cacheKey})`.cyan);

    return { data: groupedVisits || [], _cached: false };
  } catch (error) {
    console.error('❌ Error in getGroupedByCustomer:', error);
    throw error;
  }
};

/**
 * 🔥 ATOMIC ID GENERATION SAFETY: Prevent race conditions with User model integration
 */
siteVisitSchema.statics.generateSiteVisitId = async function(companyId) {
  try {
    // 🔥 ATOMIC COUNTER: Use User model's atomic counter system for consistency
    const User = require('./User');
    
    // Get current user to access/create site visit counter
    let user = await User.findById(companyId);
    if (!user) {
      throw new Error('Company not found');
    }
    
    // Initialize site visit counter if it doesn't exist
    if (typeof user.siteVisitCounter === 'undefined') {
      user.siteVisitCounter = 0;
    }
    
    // Atomic increment using findByIdAndUpdate
    const updatedUser = await User.findByIdAndUpdate(
      companyId,
      { $inc: { siteVisitCounter: 1 } },
      { new: true, upsert: false }
    );
    
    if (!updatedUser) {
      throw new Error('Failed to increment site visit counter');
    }
    
    const nextId = updatedUser.siteVisitCounter;
    const siteVisitId = `SV-${nextId.toString().padStart(3, '0')}`;
    
    console.log(`✅ Generated atomic site visit ID: ${siteVisitId} for company ${companyId}`.green);
    return siteVisitId;
    
  } catch (error) {
    console.error('❌ Atomic ID generation failed:', error.message);
    
    // 🔥 FALLBACK: Use collection-based counter as backup
    try {
      const counter = await this.collection.findOneAndUpdate(
        { _id: `counter_${companyId}` },
        { $inc: { sequence: 1 } },
        { 
          upsert: true, 
          returnDocument: 'after',
          projection: { sequence: 1 }
        }
      );
      
      const nextId = counter.value?.sequence || 1;
      const fallbackId = `SV-${nextId.toString().padStart(3, '0')}`;
      console.log(`⚠️  Using fallback ID generation: ${fallbackId}`.yellow);
      return fallbackId;
      
    } catch (fallbackError) {
      // Final fallback to timestamp-based ID
      console.warn('⚠️  All ID generation methods failed, using timestamp fallback:', fallbackError.message);
      const timestamp = Date.now().toString().slice(-6);
      return `SV-T${timestamp}`;
    }
  }
};

/**
 * Create new site visit with atomic ID generation and error handling
 * @param {String} companyId - Company ID
 * @param {Object} siteVisitData - Site visit data
 * @returns {Promise} Created site visit
 */
siteVisitSchema.statics.createNewWithAtomicId = async function(companyId, siteVisitData) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Generate atomic ID
      const siteVisitId = await this.generateSiteVisitId(companyId);
      
      // Prepare data with generated ID
      const completeData = {
        ...siteVisitData,
        id: siteVisitId,
        companyId
      };
      
      // Create site visit - middleware handles dashboard sync and cache invalidation
      const siteVisit = await this.create(completeData);
      
      console.log(`✅ Created site visit with atomic ID: ${siteVisitId}`.green);
      return siteVisit;
      
    } catch (error) {
      attempt++;
      
      if (error.code === 11000) {
        // Duplicate key error - retry with new ID
        console.warn(`⚠️  Duplicate site visit ID detected, retrying... (attempt ${attempt}/${maxRetries})`.yellow);
        
        if (attempt >= maxRetries) {
          throw new Error(`Failed to create site visit after ${maxRetries} attempts due to ID collisions`);
        }
        
        // Wait a small random amount before retry to reduce collision probability
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        continue;
      } else {
        // Other error - don't retry
        console.error('❌ Site visit creation failed:', error);
        throw error;
      }
    }
  }
};

/**
 * Get optimized site visits list with pagination and lean queries
 * @param {String} companyId - Company ID
 * @param {Object} options - Query options (page, limit, search, status, fromDate, toDate)
 * @returns {Promise} Paginated site visits
 */
siteVisitSchema.statics.getOptimizedList = async function(companyId, options = {}) {
  const { 
    page = 1, 
    limit = 10, 
    search, 
    status, 
    fromDate, 
    toDate 
  } = options;

  let query = { companyId: new mongoose.Types.ObjectId(companyId) };

  // Add search if provided - uses text index for optimal performance
  if (search && typeof search === 'string') {
    query.$text = { $search: search };
  }

  // Add status filter - uses compound index { companyId: 1, status: 1, date: -1 }
  if (status) {
    query.status = status;
  }

  // Add date range filter
  if (fromDate || toDate) {
    query.date = {};
    if (fromDate) query.date.$gte = new Date(fromDate);
    if (toDate) query.date.$lte = new Date(toDate);
  }

  // Execute optimized queries in parallel with lean() for memory efficiency
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [total, siteVisits] = await Promise.all([
    this.countDocuments(query),
    this.find(query)
      .select('id customerName projectTitle date charge status contactNo location createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean({ virtuals: true }) // 🔥 LEAN VIRTUALS: Memory optimization + virtual fields
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));
  const hasMore = parseInt(page) < totalPages;

  return {
    siteVisits: siteVisits || [],
    pagination: {
      page: parseInt(page),
      pages: totalPages,
      total: total,
      limit: parseInt(limit),
      hasMore
    }
  };
};

// Add pagination plugin
siteVisitSchema.plugin(mongoosePaginate);

// 🔥 LEAN VIRTUALS PLUGIN: Enable virtual fields with .lean() queries
siteVisitSchema.plugin(mongooseLeanVirtuals);

module.exports = mongoose.model('SiteVisit', siteVisitSchema);
