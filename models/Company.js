// models/Company.js

const mongoose = require('mongoose');

/**
 * 🔥 ENHANCED COMPANY MODEL WITH ATOMIC SEQUENCING
 * 
 * This model is optimized for:
 * - Atomic document number generation to prevent duplicates
 * - Fast lookups with optimized indexing
 * - Multi-tenant document numbering consistency
 * - Performance-optimized queries
 */

const CompanySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Company name is required'],
        trim: true,
        minlength: [2, 'Company name must be at least 2 characters long'],
    },
    email: {
        type: String,
        required: [true, 'Company email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: {
            validator: function(email) {
                // RFC 5322 compliant email regex
                return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(email);
            },
            message: 'Please provide a valid email address'
        }
    },
    phone: {
        type: String,
        trim: true,
    },
    address: {
        type: String,
        trim: true,
    },

    // Each company tracks its own last number
    lastDocumentNumber: {
        type: Number,
        default: 0,
    },

    // Settings
    documentSettings: {
        numberPadding: {
            type: Number,
            default: 3,  // 001, 002, etc.
            min: [1, 'Number padding must be at least 1'],
            max: [10, 'Number padding cannot exceed 10'],
        },
    },

    isActive: {
        type: Boolean,
        default: true,
    },

    // 🔥 SOFT DELETE SUPPORT
    isDeleted: {
        type: Boolean,
        default: false,
        // Removed index: true to avoid duplicate with explicit index below
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// 🔥 PERFORMANCE INDEXES FOR OPTIMIZED LOOKUPS

/**
 * CREATED BY INDEX
 * Index: { createdBy: 1 }
 * 
 * Purpose: Optimizes queries for companies managed by specific users
 * - Fast lookup of companies created by a specific user
 * - Supports admin and management interfaces
 * - Essential for user-based company filtering
 */
CompanySchema.index({ createdBy: 1 });

/**
 * ACTIVE COMPANY LOOKUP INDEX
 * Compound Index: { isActive: 1, isDeleted: 1, _id: 1 }
 * 
 * Purpose: Optimizes active and non-deleted company lookups
 * - Fast filtering of active vs inactive companies
 * - Efficient soft delete filtering
 * - Efficient pagination of available companies
 * - Supports administrative dashboards and reports
 */
CompanySchema.index({ isActive: 1, isDeleted: 1, _id: 1 });

/**
 * COMPANY NAME INDEX
 * Index: { name: 1 }
 * 
 * Purpose: Optimizes name-based searches and sorting
 * - Fast company name lookups
 * - Alphabetical sorting and filtering
 * - Search functionality support
 */
CompanySchema.index({ name: 1 });

/**
 * SOFT DELETE INDEX
 * Index: { isDeleted: 1 }
 * 
 * Purpose: Optimizes soft delete filtering
 * - Fast filtering of deleted vs non-deleted companies
 * - Supports data recovery operations
 * - Administrative cleanup queries
 */
CompanySchema.index({ isDeleted: 1 });

// 🔥 OPTIMIZED VIRTUAL FIELDS FOR ENHANCED FUNCTIONALITY

/**
 * Display info virtual - combines display name and contact information
 * Optimized to reduce overhead by combining multiple virtuals
 */
CompanySchema.virtual('displayInfo').get(function() {
    const displayName = this.name ? this.name.trim() : 'Unnamed Company';
    
    const contact = [];
    if (this.email) contact.push(`Email: ${this.email}`);
    if (this.phone) contact.push(`Phone: ${this.phone}`);
    
    const contactInfo = contact.length > 0 ? contact.join(' | ') : 'No contact information';
    
    return {
        displayName,
        contactInfo,
        summary: `${displayName} - ${contactInfo}`
    };
});

/**
 * Formatted address virtual - returns standardized address format
 */
CompanySchema.virtual('formattedAddress').get(function() {
    if (!this.address) return 'No address provided';
    
    // Clean and format the address
    const cleanAddress = this.address.trim();
    
    // If address is already well-formatted, return as is
    if (cleanAddress.includes('\n') || cleanAddress.includes(',')) {
        return cleanAddress;
    }
    
    // For simple addresses, return as is
    return cleanAddress;
});

/**
 * Status info virtual - returns comprehensive status information
 */
CompanySchema.virtual('statusInfo').get(function() {
    return {
        isActive: this.isActive,
        isDeleted: this.isDeleted,
        status: this.isDeleted ? 'deleted' : (this.isActive ? 'active' : 'inactive'),
        canOperate: this.isActive && !this.isDeleted
    };
});

// 🔥 ATOMIC STATIC METHODS FOR DOCUMENT SEQUENCING

/**
 * 🔥 ATOMIC DOCUMENT NUMBER GENERATION
 * Get next document number with atomic increment to prevent duplicates
 * @param {String} companyId - Company ID
 * @returns {Promise} Object with raw number and formatted string
 */
CompanySchema.statics.getNextDocumentNumber = async function(companyId) {
    try {
        // 🔥 ATOMIC OPERATION: Use findOneAndUpdate with $inc for race-condition safety
        const company = await this.findOneAndUpdate(
            { _id: companyId },
            { $inc: { lastDocumentNumber: 1 } },
            { 
                new: true, 
                select: 'lastDocumentNumber documentSettings',
                lean: true // Performance optimization
            }
        );

        if (!company) {
            throw new Error('Company not found');
        }

        // Get padding setting with fallback
        const padding = company.documentSettings?.numberPadding || 3;
        
        // Format the number with proper padding
        const paddedNumber = company.lastDocumentNumber.toString().padStart(padding, '0');

        console.log(`✅ Generated document number: ${paddedNumber} for company ${companyId}`.green);

        return {
            raw: company.lastDocumentNumber,
            formatted: paddedNumber
        };
    } catch (error) {
        console.error('❌ Error generating document number:', error);
        throw error;
    }
};

/**
 * Get current document number without incrementing
 * @param {String} companyId - Company ID
 * @returns {Promise} Object with current raw number and formatted string
 */
CompanySchema.statics.getCurrentDocumentNumber = async function(companyId) {
    try {
        if (!companyId) {
            throw new Error('Company ID is required');
        }

        const company = await this.findById(companyId)
            .select('lastDocumentNumber documentSettings')
            .lean();

        if (!company) {
            throw new Error('Company not found');
        }

        // Get padding setting with fallback
        const padding = company.documentSettings?.numberPadding || 3;
        
        // Format the current number with proper padding
        const paddedNumber = company.lastDocumentNumber.toString().padStart(padding, '0');

        return {
            success: true,
            data: {
                raw: company.lastDocumentNumber,
                formatted: paddedNumber
            },
            message: 'Current document number retrieved successfully'
        };
    } catch (error) {
        console.error('❌ Error getting current document number:', error);
        return {
            success: false,
            data: null,
            message: error.message || 'Failed to get current document number'
        };
    }
};

/**
 * Reset document number counter (admin function)
 * @param {String} companyId - Company ID
 * @param {Number} newNumber - New starting number (default: 0)
 * @returns {Promise} Standardized response object
 */
CompanySchema.statics.resetDocumentNumber = async function(companyId, newNumber = 0) {
    try {
        if (!companyId) {
            throw new Error('Company ID is required');
        }

        if (newNumber < 0) {
            throw new Error('Document number cannot be negative');
        }

        const company = await this.findOneAndUpdate(
            { _id: companyId, isDeleted: false },
            { $set: { lastDocumentNumber: newNumber } },
            { 
                new: true, 
                select: 'lastDocumentNumber documentSettings name',
                lean: true
            }
        );

        if (!company) {
            throw new Error('Company not found or has been deleted');
        }

        console.log(`✅ Reset document number to ${newNumber} for company ${company.name}`.yellow);

        return {
            success: true,
            data: company,
            message: `Document number reset to ${newNumber} successfully`
        };
    } catch (error) {
        console.error('❌ Error resetting document number:', error);
        return {
            success: false,
            data: null,
            message: error.message || 'Failed to reset document number'
        };
    }
};

/**
 * Update document settings
 * @param {String} companyId - Company ID
 * @param {Object} settings - New document settings
 * @returns {Promise} Standardized response object
 */
CompanySchema.statics.updateDocumentSettings = async function(companyId, settings) {
    try {
        if (!companyId) {
            throw new Error('Company ID is required');
        }

        if (!settings || typeof settings !== 'object') {
            throw new Error('Settings object is required');
        }

        const updateFields = {};
        
        if (settings.numberPadding !== undefined) {
            const padding = parseInt(settings.numberPadding);
            if (isNaN(padding) || padding < 1 || padding > 10) {
                throw new Error('Number padding must be between 1 and 10');
            }
            updateFields['documentSettings.numberPadding'] = padding;
        }

        if (Object.keys(updateFields).length === 0) {
            throw new Error('No valid settings provided for update');
        }

        const company = await this.findOneAndUpdate(
            { _id: companyId, isDeleted: false },
            { $set: updateFields },
            { 
                new: true, 
                select: 'documentSettings name',
                lean: true
            }
        );

        if (!company) {
            throw new Error('Company not found or has been deleted');
        }

        console.log(`✅ Updated document settings for company ${company.name}`.green);

        return {
            success: true,
            data: company,
            message: 'Document settings updated successfully'
        };
    } catch (error) {
        console.error('❌ Error updating document settings:', error);
        return {
            success: false,
            data: null,
            message: error.message || 'Failed to update document settings'
        };
    }
};

/**
 * Get active companies with optimized query (updated to exclude deleted companies)
 * @param {Object} options - Query options (limit, skip, search)
 * @returns {Promise} Standardized response with array of active companies
 */
CompanySchema.statics.getActiveCompanies = async function(options = {}) {
    try {
        const { limit = 50, skip = 0, search } = options;
        
        if (limit < 1 || limit > 100) {
            throw new Error('Limit must be between 1 and 100');
        }

        if (skip < 0) {
            throw new Error('Skip cannot be negative');
        }
        
        // 🔥 SOFT DELETE SUPPORT: Filter out deleted companies
        let query = { isActive: true, isDeleted: false };
        
        // Add search if provided
        if (search && typeof search === 'string') {
            const searchTerm = search.trim();
            if (searchTerm.length > 0) {
                const escapedSearch = searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                const searchRegex = new RegExp(escapedSearch, 'i');
                
                query.$or = [
                    { name: searchRegex },
                    { email: searchRegex }
                ];
            }
        }
        
        // Use compound index { isActive: 1, isDeleted: 1, _id: 1 } for optimal performance
        const companies = await this.find(query)
            .select('name email phone address documentSettings createdAt')
            .sort({ _id: 1 }) // Leverage compound index
            .skip(skip)
            .limit(limit)
            .lean(); // Memory optimization
        
        return {
            success: true,
            data: companies,
            message: `Retrieved ${companies.length} active companies successfully`
        };
    } catch (error) {
        console.error('❌ Error getting active companies:', error);
        return {
            success: false,
            data: [],
            message: error.message || 'Failed to get active companies'
        };
    }
};

/**
 * Get companies by creator with optimized query (updated to exclude deleted companies)
 * @param {String} creatorId - Creator user ID
 * @param {Object} options - Query options (limit, skip, includeDeleted)
 * @returns {Promise} Standardized response with array of companies
 */
CompanySchema.statics.getCompaniesByCreator = async function(creatorId, options = {}) {
    try {
        if (!creatorId) {
            throw new Error('Creator ID is required');
        }

        const { limit = 50, skip = 0, includeDeleted = false } = options;
        
        if (limit < 1 || limit > 100) {
            throw new Error('Limit must be between 1 and 100');
        }

        if (skip < 0) {
            throw new Error('Skip cannot be negative');
        }

        // Base query with creator filter
        let query = { createdBy: creatorId };
        
        // 🔥 SOFT DELETE SUPPORT: Optionally exclude deleted companies
        if (!includeDeleted) {
            query.isDeleted = false;
        }
        
        // Use createdBy index for optimal performance
        const companies = await this.find(query)
            .select('name email phone address isActive isDeleted documentSettings createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(); // Memory optimization
        
        return {
            success: true,
            data: companies,
            message: `Retrieved ${companies.length} companies for creator successfully`
        };
    } catch (error) {
        console.error('❌ Error getting companies by creator:', error);
        return {
            success: false,
            data: [],
            message: error.message || 'Failed to get companies by creator'
        };
    }
};

/**
 * 🔥 SOFT DELETE METHODS
 */

/**
 * Soft delete a company
 * @param {String} companyId - Company ID
 * @returns {Promise} Standardized response object
 */
CompanySchema.statics.softDelete = async function(companyId) {
    try {
        if (!companyId) {
            throw new Error('Company ID is required');
        }

        const company = await this.findOneAndUpdate(
            { _id: companyId, isDeleted: false },
            { 
                $set: { 
                    isDeleted: true,
                    isActive: false, // Also deactivate when deleting
                    deletedAt: new Date()
                }
            },
            { 
                new: true, 
                select: 'name email isDeleted isActive',
                lean: true
            }
        );

        if (!company) {
            throw new Error('Company not found or already deleted');
        }

        console.log(`✅ Soft deleted company: ${company.name}`.yellow);

        return {
            success: true,
            data: company,
            message: 'Company deleted successfully'
        };
    } catch (error) {
        console.error('❌ Error soft deleting company:', error);
        return {
            success: false,
            data: null,
            message: error.message || 'Failed to delete company'
        };
    }
};

/**
 * Restore a soft deleted company
 * @param {String} companyId - Company ID
 * @returns {Promise} Standardized response object
 */
CompanySchema.statics.restore = async function(companyId) {
    try {
        if (!companyId) {
            throw new Error('Company ID is required');
        }

        const company = await this.findOneAndUpdate(
            { _id: companyId, isDeleted: true },
            { 
                $set: { 
                    isDeleted: false,
                    isActive: true // Reactivate when restoring
                },
                $unset: { deletedAt: 1 }
            },
            { 
                new: true, 
                select: 'name email isDeleted isActive',
                lean: true
            }
        );

        if (!company) {
            throw new Error('Company not found or not deleted');
        }

        console.log(`✅ Restored company: ${company.name}`.green);

        return {
            success: true,
            data: company,
            message: 'Company restored successfully'
        };
    } catch (error) {
        console.error('❌ Error restoring company:', error);
        return {
            success: false,
            data: null,
            message: error.message || 'Failed to restore company'
        };
    }
};

module.exports = mongoose.model('Company', CompanySchema);
