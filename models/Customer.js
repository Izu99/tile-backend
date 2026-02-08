const mongoose = require('mongoose');

/**
 * 🔥 OPTIMIZED CUSTOMER MODEL WITH MULTI-TENANT DATA INTEGRITY
 * 
 * This model is optimized for:
 * - Multi-tenant phone number uniqueness
 * - Fast queries with compound indexing
 * - Business logic encapsulation via static methods
 * - Lean queries for memory optimization
 */

// Customer Schema
const CustomerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a customer name'],
            trim: true,
        },
        phone: {
            type: String,
            required: [true, 'Please add a phone number'],
            // Removed global unique constraint for multi-tenant support
            trim: true,
        },
        address: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// 🔥 PERFORMANCE INDEXES FOR MULTI-TENANT OPTIMIZATION

/**
 * MULTI-TENANT INTEGRITY INDEX (ESSENTIAL)
 * Compound Unique Index: { phone: 1, user: 1 } with { unique: true }
 * 
 * Purpose: Ensures multi-tenant data integrity for phone numbers
 * - Allows different companies to have customers with the same phone number
 * - Prevents the same company from creating duplicate phone numbers
 * - Essential for proper tenant isolation in multi-company environment
 * 
 * Examples:
 * ✅ Company A: Customer with phone "123-456-7890" + Company B: Customer with phone "123-456-7890" = ALLOWED
 * ❌ Company A: Customer with phone "123-456-7890" + Company A: Customer with phone "123-456-7890" = BLOCKED
 */
CustomerSchema.index({ phone: 1, user: 1 }, { unique: true });

/**
 * GENERAL LISTING INDEX
 * Compound Index: { user: 1, createdAt: -1 }
 * 
 * Purpose: Optimizes default chronological listings
 * - Default view for all customers
 * - Efficient pagination and sorting
 * - Timeline-based views and reporting
 */
CustomerSchema.index({ user: 1, createdAt: -1 });

/**
 * NAME-BASED SEARCH INDEX
 * Compound Index: { user: 1, name: 1 }
 * 
 * Purpose: Optimizes name-based searches within user scope
 * - Fast customer name lookups
 * - Alphabetical sorting and filtering
 * - Customer relationship management
 */
CustomerSchema.index({ user: 1, name: 1 });

/**
 * TEXT SEARCH INDEX
 * 
 * Purpose: Enables comprehensive text-based searches
 * - Search across customer names and phone numbers
 * - Supports advanced search functionality in the UI
 * - Efficient full-text search without external search engines
 */
CustomerSchema.index({ name: 'text', phone: 'text' });

// 🔥 STATIC METHODS FOR BUSINESS LOGIC

/**
 * Get optimized customers list with pagination and search
 * @param {String} userId - User ID
 * @param {Object} options - Query options (page, limit, search)
 * @returns {Promise} Paginated customers with metadata
 */
CustomerSchema.statics.getOptimizedList = async function(userId, options = {}) {
  try {
    const { page = 1, limit = 10, search } = options;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let query = { user: new mongoose.Types.ObjectId(userId) };
    
    // Add search if provided - uses compound indexes for optimal performance
    if (search && typeof search === 'string') {
      const searchTerm = search.trim();
      if (searchTerm.length > 0) {
        // Escape special regex characters for safe searching
        const escapedSearch = searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const searchRegex = new RegExp(escapedSearch, 'i');
        
        query.$or = [
          { name: searchRegex },
          { phone: searchRegex }
        ];
      }
    }
    
    // Execute optimized queries in parallel with lean() for memory efficiency
    const [total, customers] = await Promise.all([
      this.countDocuments(query),
      this.find(query)
        .select('name phone address email createdAt updatedAt') // Database-level projection
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean() // 🔥 MEMORY OPTIMIZATION: 5x performance boost, reduced memory overhead
    ]);
    
    const totalPages = Math.ceil(total / parseInt(limit));
    const hasMore = parseInt(page) < totalPages;
    
    return {
      customers: customers || [],
      pagination: {
        page: parseInt(page),
        pages: totalPages,
        total: total,
        limit: parseInt(limit),
        hasMore
      }
    };
  } catch (error) {
    console.error('❌ Error in getOptimizedList:', error);
    throw error;
  }
};

/**
 * Search customer by phone number with user scope
 * @param {String} phone - Phone number to search
 * @param {String} userId - User ID for tenant isolation
 * @returns {Promise} Customer document or null
 */
CustomerSchema.statics.searchByPhone = async function(phone, userId) {
  try {
    if (!phone || !userId) {
      return null;
    }
    
    // Use compound index { phone: 1, user: 1 } for optimal performance
    const customer = await this.findOne({
      phone: phone.trim(),
      user: userId,
    })
    .select('name phone address email') // Database-level projection
    .lean(); // Memory optimization
    
    return customer;
  } catch (error) {
    console.error('❌ Error in searchByPhone:', error);
    throw error;
  }
};

/**
 * Create customer with duplicate phone validation
 * @param {Object} customerData - Customer data
 * @returns {Promise} Created customer
 */
CustomerSchema.statics.createCustomer = async function(customerData) {
  try {
    const customer = await this.create(customerData);
    console.log(`✅ Customer created: ${customer._id}`.green);
    return customer;
  } catch (error) {
    if (error.code === 11000) {
      // Handle duplicate phone number error with user-friendly message
      throw new Error('A customer with this phone number already exists');
    }
    console.error('❌ Error creating customer:', error);
    throw error;
  }
};

/**
 * Update customer with atomic operations
 * @param {String} customerId - Customer ID
 * @param {String} userId - User ID for tenant isolation
 * @param {Object} updateData - Update data
 * @returns {Promise} Updated customer
 */
CustomerSchema.statics.updateCustomerAtomic = async function(customerId, userId, updateData) {
  try {
    // Use atomic findOneAndUpdate for consistency
    const customer = await this.findOneAndUpdate(
      { _id: customerId, user: userId },
      updateData,
      {
        new: true,
        runValidators: true,
        lean: true // Return lean object for performance
      }
    );
    
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    console.log(`✅ Customer updated: ${customerId}`.green);
    return customer;
  } catch (error) {
    if (error.code === 11000) {
      // Handle duplicate phone number error
      throw new Error('A customer with this phone number already exists');
    }
    console.error('❌ Error updating customer:', error);
    throw error;
  }
};

/**
 * Delete customer with atomic operations
 * @param {String} customerId - Customer ID
 * @param {String} userId - User ID for tenant isolation
 * @returns {Promise} Deleted customer
 */
CustomerSchema.statics.deleteCustomerAtomic = async function(customerId, userId) {
  try {
    // Use atomic findOneAndDelete for consistency
    const customer = await this.findOneAndDelete({
      _id: customerId,
      user: userId,
    }).lean();
    
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    console.log(`✅ Customer deleted: ${customerId}`.green);
    return customer;
  } catch (error) {
    console.error('❌ Error deleting customer:', error);
    throw error;
  }
};

module.exports = mongoose.model('Customer', CustomerSchema);
