#!/usr/bin/env node

/**
 * 🔥 DATABASE INDEXING SCRIPT
 * 
 * This script creates optimized indexes for all collections to prevent
 * full collection scans and improve query performance.
 * 
 * Run with: node scripts/createIndexes.js
 */

const mongoose = require('mongoose');
const colors = require('colors');
require('dotenv').config();

// Import models to ensure schemas are loaded
const User = require('../models/User');
const Category = require('../models/Category');

async function createOptimizedIndexes() {
    try {
        console.log('🔥 DATABASE INDEXING SCRIPT'.cyan.bold);
        console.log('================================'.cyan);
        
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...'.yellow);
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB'.green);
        
        const db = mongoose.connection.db;
        
        // 🔥 USERS COLLECTION INDEXES
        console.log('\n📊 Creating Users Collection Indexes...'.cyan);
        
        const usersCollection = db.collection('users');
        
        // Drop existing indexes (except _id) to recreate optimized ones
        try {
            const existingIndexes = await usersCollection.indexes();
            console.log(`📋 Found ${existingIndexes.length} existing indexes`);
            
            for (const index of existingIndexes) {
                if (index.name !== '_id_') {
                    await usersCollection.dropIndex(index.name);
                    console.log(`🗑️  Dropped index: ${index.name}`);
                }
            }
        } catch (error) {
            console.log('⚠️  No existing indexes to drop or error dropping:', error.message);
        }
        
        // Create optimized indexes for Users collection
        const userIndexes = [
            // 🔥 AUTHENTICATION INDEX: Most critical for login performance
            { 
                keys: { email: 1, isActive: 1 }, 
                options: { 
                    name: 'auth_email_active',
                    background: true,
                    partialFilterExpression: { email: { $exists: true } }
                }
            },
            
            // 🔥 COMPANY MANAGEMENT INDEX: For getAllCompanies query
            { 
                keys: { role: 1, isActive: 1, createdAt: -1 }, 
                options: { 
                    name: 'company_management',
                    background: true,
                    partialFilterExpression: { role: 'company' }
                }
            },
            
            // 🔥 COMPANY SEARCH INDEX: For search functionality
            { 
                keys: { role: 1, companyName: 1, name: 1 }, 
                options: { 
                    name: 'company_search',
                    background: true,
                    partialFilterExpression: { role: 'company' }
                }
            },
            
            // 🔥 ROLE-BASED INDEX: For role filtering
            { 
                keys: { role: 1, createdAt: -1 }, 
                options: { 
                    name: 'role_created',
                    background: true
                }
            },
            
            // 🔥 ACTIVE COMPANIES INDEX: For dashboard stats
            { 
                keys: { role: 1, isActive: 1 }, 
                options: { 
                    name: 'role_active',
                    background: true
                }
            },
            
            // 🔥 LOGIN TRACKING INDEX: For last login queries
            { 
                keys: { lastLoginAt: -1, isActive: 1 }, 
                options: { 
                    name: 'login_tracking',
                    background: true,
                    sparse: true
                }
            }
        ];
        
        for (const indexDef of userIndexes) {
            try {
                await usersCollection.createIndex(indexDef.keys, indexDef.options);
                console.log(`✅ Created index: ${indexDef.options.name}`.green);
            } catch (error) {
                console.log(`❌ Failed to create index ${indexDef.options.name}: ${error.message}`.red);
            }
        }
        
        // 🔥 CATEGORIES COLLECTION INDEXES
        console.log('\n📊 Creating Categories Collection Indexes...'.cyan);
        
        const categoriesCollection = db.collection('categories');
        
        // Drop existing indexes (except _id)
        try {
            const existingIndexes = await categoriesCollection.indexes();
            for (const index of existingIndexes) {
                if (index.name !== '_id_') {
                    await categoriesCollection.dropIndex(index.name);
                    console.log(`🗑️  Dropped index: ${index.name}`);
                }
            }
        } catch (error) {
            console.log('⚠️  No existing indexes to drop or error dropping:', error.message);
        }
        
        const categoryIndexes = [
            // 🔥 COMPANY CATEGORIES INDEX: Most critical for category queries
            { 
                keys: { companyId: 1, createdAt: -1 }, 
                options: { 
                    name: 'company_categories',
                    background: true
                }
            },
            
            // 🔥 UNIQUE CATEGORY NAME INDEX: Prevent duplicates per company
            { 
                keys: { companyId: 1, name: 1 }, 
                options: { 
                    name: 'company_category_unique',
                    unique: true,
                    background: true
                }
            },
            
            // 🔥 CATEGORY SEARCH INDEX: For searching within company
            { 
                keys: { companyId: 1, name: 'text' }, 
                options: { 
                    name: 'category_search',
                    background: true
                }
            },
            
            // 🔥 ITEMS SEARCH INDEX: For searching items within categories
            { 
                keys: { companyId: 1, 'items.itemName': 1 }, 
                options: { 
                    name: 'items_search',
                    background: true,
                    sparse: true
                }
            }
        ];
        
        for (const indexDef of categoryIndexes) {
            try {
                await categoriesCollection.createIndex(indexDef.keys, indexDef.options);
                console.log(`✅ Created index: ${indexDef.options.name}`.green);
            } catch (error) {
                console.log(`❌ Failed to create index ${indexDef.options.name}: ${error.message}`.red);
            }
        }
        
        // 🔥 VERIFY INDEXES
        console.log('\n🔍 Verifying Created Indexes...'.cyan);
        
        const userIndexesCreated = await usersCollection.indexes();
        const categoryIndexesCreated = await categoriesCollection.indexes();
        
        console.log(`📊 Users collection indexes: ${userIndexesCreated.length}`);
        userIndexesCreated.forEach(index => {
            console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
        });
        
        console.log(`📊 Categories collection indexes: ${categoryIndexesCreated.length}`);
        categoryIndexesCreated.forEach(index => {
            console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
        });
        
        // 🔥 PERFORMANCE TEST
        console.log('\n⚡ Running Performance Tests...'.cyan);
        
        // Test company query performance
        const companyQueryStart = Date.now();
        const companyCount = await usersCollection.countDocuments({ role: 'company', isActive: true });
        const companyQueryTime = Date.now() - companyQueryStart;
        
        console.log(`📈 Company count query: ${companyQueryTime}ms (${companyCount} companies)`);
        
        if (companyQueryTime > 1000) {
            console.log('⚠️  WARNING: Company query is still slow (>1s). Check if indexes are being used.'.yellow);
        } else {
            console.log('✅ Company query performance is good (<1s)'.green);
        }
        
        // Test category query performance
        if (companyCount > 0) {
            const sampleCompany = await usersCollection.findOne({ role: 'company' });
            if (sampleCompany) {
                const categoryQueryStart = Date.now();
                const categoryCount = await categoriesCollection.countDocuments({ companyId: sampleCompany._id });
                const categoryQueryTime = Date.now() - categoryQueryStart;
                
                console.log(`📈 Category count query: ${categoryQueryTime}ms (${categoryCount} categories)`);
                
                if (categoryQueryTime > 1000) {
                    console.log('⚠️  WARNING: Category query is still slow (>1s). Check if indexes are being used.'.yellow);
                } else {
                    console.log('✅ Category query performance is good (<1s)'.green);
                }
            }
        }
        
        console.log('\n🎉 INDEX CREATION COMPLETED SUCCESSFULLY!'.green.bold);
        console.log('📋 Summary:'.cyan);
        console.log(`   - Users indexes: ${userIndexesCreated.length}`);
        console.log(`   - Categories indexes: ${categoryIndexesCreated.length}`);
        console.log('   - All indexes created with background: true for non-blocking operation');
        console.log('   - Partial filters applied where appropriate for efficiency');
        
    } catch (error) {
        console.error('\n❌ INDEX CREATION FAILED:'.red.bold);
        console.error(error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB'.yellow);
    }
}

// Run the indexing script
if (require.main === module) {
    createOptimizedIndexes().catch(console.error);
}

module.exports = { createOptimizedIndexes };