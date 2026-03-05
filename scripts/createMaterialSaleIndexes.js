#!/usr/bin/env node

/**
 * 🔥 MATERIAL SALE INDEX CREATION SCRIPT
 * 
 * This script ensures all performance-critical indexes exist on the MaterialSale collection.
 * Run this script to optimize query performance and eliminate slow queries.
 * 
 * Usage: node scripts/createMaterialSaleIndexes.js
 */

require('colors');
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/business-management';

async function createMaterialSaleIndexes() {
  try {
    console.log('🚀 Starting Material Sale Index Creation...'.cyan.bold);
    console.log(`📡 Connecting to: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`.cyan);

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB'.green);

    const MaterialSale = mongoose.model('MaterialSale');
    const collection = MaterialSale.collection;

    console.log('\n📊 Current Indexes:'.yellow.bold);
    const existingIndexes = await collection.indexes();
    existingIndexes.forEach(index => {
      console.log(`   - ${JSON.stringify(index.key)}`.gray);
    });

    console.log('\n🔨 Creating/Verifying Performance Indexes...'.cyan.bold);

    // 1. Multi-tenant integrity index (CRITICAL)
    console.log('\n1️⃣  Multi-Tenant Integrity Index: { user: 1, invoiceNumber: 1 }');
    try {
      await collection.createIndex(
        { user: 1, invoiceNumber: 1 },
        { unique: true, name: 'user_1_invoiceNumber_1' }
      );
      console.log('   ✅ Created/Verified'.green);
    } catch (error) {
      if (error.code === 85) {
        console.log('   ℹ️  Index already exists with different options, skipping'.yellow);
      } else {
        throw error;
      }
    }

    // 2. Comprehensive search & filter index
    console.log('\n2️⃣  Search & Filter Index: { user: 1, customerName: 1, invoiceNumber: 1, saleDate: -1 }');
    try {
      await collection.createIndex(
        { user: 1, customerName: 1, invoiceNumber: 1, saleDate: -1 },
        { name: 'user_1_customerName_1_invoiceNumber_1_saleDate_-1' }
      );
      console.log('   ✅ Created/Verified'.green);
    } catch (error) {
      if (error.code === 85) {
        console.log('   ℹ️  Index already exists with different options, skipping'.yellow);
      } else {
        throw error;
      }
    }

    // 3. Dashboard filtering index
    console.log('\n3️⃣  Dashboard Filter Index: { user: 1, status: 1, saleDate: -1 }');
    try {
      await collection.createIndex(
        { user: 1, status: 1, saleDate: -1 },
        { name: 'user_1_status_1_saleDate_-1' }
      );
      console.log('   ✅ Created/Verified'.green);
    } catch (error) {
      if (error.code === 85) {
        console.log('   ℹ️  Index already exists with different options, skipping'.yellow);
      } else {
        throw error;
      }
    }

    // 4. General listing index
    console.log('\n4️⃣  General Listing Index: { user: 1, saleDate: -1 }');
    try {
      await collection.createIndex(
        { user: 1, saleDate: -1 },
        { name: 'user_1_saleDate_-1' }
      );
      console.log('   ✅ Created/Verified'.green);
    } catch (error) {
      if (error.code === 85) {
        console.log('   ℹ️  Index already exists with different options, skipping'.yellow);
      } else {
        throw error;
      }
    }

    // 5. Creation date index
    console.log('\n5️⃣  Creation Date Index: { user: 1, createdAt: -1 }');
    try {
      await collection.createIndex(
        { user: 1, createdAt: -1 },
        { name: 'user_1_createdAt_-1' }
      );
      console.log('   ✅ Created/Verified'.green);
    } catch (error) {
      if (error.code === 85) {
        console.log('   ℹ️  Index already exists with different options, skipping'.yellow);
      } else {
        throw error;
      }
    }

    // 6. Text search index
    console.log('\n6️⃣  Text Search Index: { customerName: "text", invoiceNumber: "text", notes: "text" }');
    try {
      await collection.createIndex(
        { customerName: 'text', invoiceNumber: 'text', notes: 'text' },
        { name: 'text_search_index' }
      );
      console.log('   ✅ Created/Verified'.green);
    } catch (error) {
      if (error.code === 85) {
        console.log('   ℹ️  Index already exists with different options, skipping'.yellow);
      } else {
        throw error;
      }
    }

    console.log('\n📊 Final Index List:'.yellow.bold);
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`   - ${JSON.stringify(index.key)}`.green);
    });

    console.log('\n✅ Material Sale Index Creation Complete!'.green.bold);
    console.log('🚀 Query performance should now be optimized (<100ms for typical queries)'.cyan);

    await mongoose.connection.close();
    console.log('📡 Database connection closed'.gray);
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error creating indexes:'.red.bold, error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
createMaterialSaleIndexes();
