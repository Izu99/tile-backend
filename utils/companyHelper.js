/**
 * Company Helper Utilities
 * 
 * Provides helper functions for multi-user company data access
 */

const mongoose = require('mongoose');

/**
 * Get the effective company ID for data filtering
 * 
 * @param {Object} user - The authenticated user object from req.user
 * @returns {ObjectId} - The company ID to use for filtering data
 * 
 * Logic:
 * - For company owners (role='company'): returns their own _id
 * - For admin users (role='admin'): returns their companyId (parent company)
 * - For super-admin: returns their own _id (they see all companies separately)
 */
const getEffectiveCompanyId = (user) => {
    if (!user) {
        throw new Error('User object is required');
    }

    // If user already has effectiveCompanyId set by middleware, use it
    if (user.effectiveCompanyId) {
        return typeof user.effectiveCompanyId === 'string'
            ? new mongoose.Types.ObjectId(user.effectiveCompanyId)
            : user.effectiveCompanyId;
    }

    // Company owners use their own ID
    if (user.role === 'company') {
        return typeof user._id === 'string'
            ? new mongoose.Types.ObjectId(user._id)
            : user._id;
    }

    // Admin users use their parent company's ID
    if (user.role === 'admin' && user.companyId) {
        return typeof user.companyId === 'string'
            ? new mongoose.Types.ObjectId(user.companyId)
            : user.companyId;
    }

    // Fallback to user's own ID (for super-admin or edge cases)
    return typeof user._id === 'string'
        ? new mongoose.Types.ObjectId(user._id)
        : user._id;
};

/**
 * Check if a user belongs to a specific company
 * 
 * @param {Object} user - The authenticated user object
 * @param {String|ObjectId} companyId - The company ID to check against
 * @returns {Boolean} - True if user belongs to the company
 */
const userBelongsToCompany = (user, companyId) => {
    const effectiveCompanyId = getEffectiveCompanyId(user);
    const targetCompanyId = typeof companyId === 'string'
        ? new mongoose.Types.ObjectId(companyId)
        : companyId;

    return effectiveCompanyId.equals(targetCompanyId);
};

module.exports = {
    getEffectiveCompanyId,
    userBelongsToCompany,
};
