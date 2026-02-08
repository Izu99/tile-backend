/**
 * 🔥 COMMON HELPER FUNCTIONS
 * 
 * This file contains reusable utility functions to reduce duplicate code
 * across all controllers.
 */

/**
 * Create a safe regex pattern for search functionality
 * @param {string} searchTerm - The search term to escape
 * @returns {RegExp} - Safe regex pattern
 */
const createSearchRegex = (searchTerm) => {
    if (!searchTerm || typeof searchTerm !== 'string') {
        return null;
    }
    
    const trimmed = searchTerm.trim();
    if (trimmed.length === 0) {
        return null;
    }
    
    // Escape special regex characters
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
};

/**
 * Create pagination parameters from query
 * @param {object} query - Request query object
 * @param {number} defaultLimit - Default limit if not provided
 * @returns {object} - Pagination parameters
 */
const createPaginationParams = (query, defaultLimit = 10) => {
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || defaultLimit;
    const skip = (page - 1) * limit;
    
    return { page, limit, skip };
};

/**
 * Calculate pagination metadata
 * @param {number} total - Total count of documents
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {object} - Pagination metadata
 */
const calculatePaginationMeta = (total, page, limit) => {
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;
    
    return {
        page,
        limit,
        total,
        pages: totalPages,
        hasMore
    };
};

/**
 * Performance monitoring helper
 * @param {string} operation - Operation name
 * @param {number} startTime - Start timestamp
 * @param {number} count - Number of items processed
 * @param {string} identifier - Additional identifier (optional)
 */
const logPerformance = (operation, startTime, count = 0, identifier = '') => {
    const dbTime = Date.now() - startTime;
    const countText = count > 0 ? ` (${count} items)` : '';
    const idText = identifier ? ` ${identifier}` : '';
    
    console.log(`⚡ ${operation}: ${dbTime}ms${countText}${idText}`.cyan);
    
    if (dbTime > 200) {
        console.log(`⚠️  Slow ${operation.toLowerCase()} query detected: ${dbTime}ms`.yellow);
    }
    
    return dbTime;
};

/**
 * Create date range filter for MongoDB queries
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {object|null} - MongoDB date filter or null
 */
const createDateRangeFilter = (startDate, endDate) => {
    if (!startDate && !endDate) {
        return null;
    }
    
    const filter = {};
    if (startDate) filter.$gte = new Date(startDate);
    if (endDate) filter.$lte = new Date(endDate);
    
    return filter;
};

/**
 * Create standard API response with performance data
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Response message
 * @param {any} data - Response data
 * @param {object} pagination - Pagination metadata (optional)
 * @param {number} startTime - Start timestamp for performance calculation
 * @returns {object} - Express response
 */
const createApiResponse = (res, statusCode, message, data, pagination = null, startTime = null) => {
    const response = {
        success: statusCode >= 200 && statusCode < 300,
        message,
        ...(pagination && { pagination }),
        ...(Array.isArray(data) && { count: data.length }),
        data
    };
    
    // Add performance data if startTime provided
    if (startTime) {
        response._performance = {
            totalTimeMs: Date.now() - startTime
        };
    }
    
    return res.status(statusCode).json(response);
};

/**
 * Validate required fields in request body
 * @param {object} body - Request body
 * @param {string[]} requiredFields - Array of required field names
 * @returns {string|null} - Error message or null if valid
 */
const validateRequiredFields = (body, requiredFields) => {
    const missingFields = [];
    
    for (const field of requiredFields) {
        if (!body[field] || (typeof body[field] === 'string' && body[field].trim() === '')) {
            missingFields.push(field);
        }
    }
    
    if (missingFields.length > 0) {
        return `Missing required fields: ${missingFields.join(', ')}`;
    }
    
    return null;
};

/**
 * Create MongoDB aggregation pipeline for search
 * @param {object} matchQuery - Base match query
 * @param {string[]} searchFields - Fields to search in
 * @param {string} searchTerm - Search term
 * @returns {object} - Updated match query with search
 */
const addSearchToQuery = (matchQuery, searchFields, searchTerm) => {
    const searchRegex = createSearchRegex(searchTerm);
    
    if (searchRegex && searchFields.length > 0) {
        matchQuery.$or = searchFields.map(field => ({
            [field]: searchRegex
        }));
    }
    
    return matchQuery;
};

/**
 * Standard lean query with performance monitoring
 * @param {object} Model - Mongoose model
 * @param {object} query - Query object
 * @param {object} options - Query options
 * @returns {Promise} - Query result with performance logging
 */
const performLeanQuery = async (Model, query, options = {}) => {
    const startTime = Date.now();
    const {
        select = '',
        populate = null,
        sort = { createdAt: -1 },
        skip = 0,
        limit = 10,
        operationName = 'Query'
    } = options;
    
    let mongoQuery = Model.find(query);
    
    if (select) mongoQuery = mongoQuery.select(select);
    if (populate) mongoQuery = mongoQuery.populate(populate);
    if (sort) mongoQuery = mongoQuery.sort(sort);
    if (skip > 0) mongoQuery = mongoQuery.skip(skip);
    if (limit > 0) mongoQuery = mongoQuery.limit(limit);
    
    mongoQuery = mongoQuery.lean();
    
    const result = await mongoQuery;
    logPerformance(operationName, startTime, result.length);
    
    return result;
};

module.exports = {
    createSearchRegex,
    createPaginationParams,
    calculatePaginationMeta,
    logPerformance,
    createDateRangeFilter,
    createApiResponse,
    validateRequiredFields,
    addSearchToQuery,
    performLeanQuery
};