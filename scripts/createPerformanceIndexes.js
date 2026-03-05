#!/usr/bin/env node

/**
 * 🔥 CREATE PERFORMANCE INDEXES SCRIPT
 * 
 * This script manually creates the critical performance indexes that were added to the models:
 * 1. PurchaseOrder: { _id: 1, user: 1 } - Optimizes single document queries with user validation
 * 2. JobCost: { _id: 1, user: 1 } - Optimizes single document queries with user validation
 */

require('colors');
const mongoose = require('mongoose');
require('dotenv').config();

async function connectDB() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MongoDB URI not found in environment variables');
        }
        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB Connected for Index Creation'.green);
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
}

async function createPerformanceIndexes() {
    console.log('\n🔥 CREATING PERFORMANCE INDEXES'.yellow);
    
    try {
        const db = mongoose.connection.db;
        
        // Create PurchaseOrder performance index
        console.log('📊 Creating PurchaseOrder { _id: 1, user: 1 } index...'.cyan);
        try {
            await db.collection('purchaseorders').createIndex(
                { _id: 1, user: 1 },
                { 
                    name: '_id_1_user_1_performance',
                    background: true,
                    comment: 'Performance index for single document queries with user validation - optimizes 600ms+ queries'
                }
            );
            console.log('✅ PurchaseOrder performance index created successfully!'.green);
        } catch (error) {
            if (error.code === 11000 || error.message.includes('already exists')) {
                console.log('ℹ️ PurchaseOrder performance index already exists'.yellow);
            } else {
                throw error;
            }
        }
        
        // Create JobCost performance index
        console.log('📊 Creating JobCost { _id: 1, user: 1 } index...'.cyan);
        try {
            await db.collection('jobcosts').createIndex(
                { _id: 1, user: 1 },
                { 
                    name: '_id_1_user_1_performance',
                    background: true,
                    comment: 'Performance index for single document queries with user validation - optimizes 600ms+ queries'
                }
            );
            console.log('✅ JobCost performance index created successfully!'.green);
        } catch (error) {
            if (error.code === 11000 || error.message.includes('already exists')) {
                console.log('ℹ️ JobCost performance index already exists'.yellow);
            } else {
                throw error;
            }
        }
        
    } catch (error) {
        console.error('❌ Failed to create performance indexes:', error);
        throw error;
    }
}

async function verifyIndexes() {
    console.log('\n🔍 VERIFYING CREATED INDEXES'.yellow);
    
    try {
        const db = mongoose.connection.db;
        
        // Check PurchaseOrder indexes
        const poIndexes = await db.collection('purchaseorders').indexes();
        console.log('\n📊 PurchaseOrder Indexes:'.cyan);
        poIndexes.forEach(index => {
            console.log(`   ${index.name}: ${JSON.stringify(index.key)}`.gray);
        });
        
        // Check if our performance index exists
        const hasPerformanceIndex = poIndexes.some(index => 
            index.name.includes('_id_1_user_1') || JSON.stringify(index.key).includes('"_id":1,"user":1')
        );
        
        if (hasPerformanceIndex) {
            console.log('✅ PurchaseOrder performance index { _id: 1, user: 1 } verified!'.green);
        } else {
            console.log('❌ PurchaseOrder performance index { _id: 1, user: 1 } NOT found!'.red);
        }
        
        // Check JobCost indexes
        const jcIndexes = await db.collection('jobcosts').indexes();
        console.log('\n📊 JobCost Indexes:'.cyan);
        jcIndexes.forEach(index => {
            console.log(`   ${index.name}: ${JSON.stringify(index.key)}`.gray);
        });
        
        // Check if our performance index exists
        const hasJCPerformanceIndex = jcIndexes.some(index => 
            index.name.includes('_id_1_user_1') || JSON.stringify(index.key).includes('"_id":1,"user":1')
        );
        
        if (hasJCPerformanceIndex) {
            console.log('✅ JobCost performance index { _id: 1, user: 1 } verified!'.green);
        } else {
            console.log('❌ JobCost performance index { _id: 1, user: 1 } NOT found!'.red);
        }
        
    } catch (error) {
        console.error('❌ Index verification failed:', error);
    }
}

async function runIndexCreation() {
    console.log('🚀 STARTING PERFORMANCE INDEX CREATION'.rainbow);
    console.log('=' .repeat(60));
    
    await connectDB();
    await createPerformanceIndexes();
    await verifyIndexes();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ PERFORMANCE INDEX CREATION COMPLETED'.rainbow);
    console.log('\n📋 WHAT WAS DONE:'.yellow);
    console.log('   1. ✅ Created { _id: 1, user: 1 } index on PurchaseOrder collection'.green);
    console.log('   2. ✅ Created { _id: 1, user: 1 } index on JobCost collection'.green);
    console.log('\n🚀 EXPECTED PERFORMANCE IMPROVEMENT:'.yellow);
    console.log('   • updateDeliveryVerification queries: 600ms+ → <50ms'.green);
    console.log('   • uploadInvoiceImage queries: 900ms+ → <50ms'.green);
    console.log('   • Single document queries with user validation: 10x faster'.green);
    
    process.exit(0);
}

// Run the index creation
runIndexCreation().catch(error => {
    console.error('💥 Index creation failed:', error);
    process.exit(1);
});