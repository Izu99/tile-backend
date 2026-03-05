/**
 * 🚀 SUPER ADMIN PERFORMANCE OPTIMIZATION SCRIPT
 * 
 * This script optimizes all Super Admin backend operations:
 * 1. Database Indexing
 * 2. Query Optimization
 * 3. Caching Strategy
 * 4. Response Time Monitoring
 */

const mongoose = require('mongoose');
const Company = require('../models/Company');
const Category = require('../models/Category');
const User = require('../models/User');
require('dotenv').config();
require('colors');

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected'.green.bold);
  } catch (error) {
    console.error('❌ MongoDB Connection Error:'.red.bold, error);
    process.exit(1);
  }
}

// 1. CREATE OPTIMIZED INDEXES
async function createOptimizedIndexes() {
  console.log('\n📊 Creating Optimized Indexes...'.cyan.bold);

  try {
    // Company Indexes
    console.log('\n🏢 Company Indexes:'.yellow);
    await Company.collection.createIndex({ createdBy: 1 });
    console.log('  ✓ createdBy index');
    
    await Company.collection.createIndex({ isActive: 1, isDeleted: 1, _id: 1 });
    console.log('  ✓ isActive + isDeleted + _id compound index');
    
    await Company.collection.createIndex({ name: 1 });
    console.log('  ✓ name index');
    
    await Company.collection.createIndex({ isDeleted: 1 });
    console.log('  ✓ isDeleted index');
    
    await Company.collection.createIndex({ createdAt: -1 });
    console.log('  ✓ createdAt index (for recent companies)');

    // Category Indexes
    console.log('\n📁 Category Indexes:'.yellow);
    await Category.collection.createIndex({ companyId: 1, isDeleted: 1 });
    console.log('  ✓ companyId + isDeleted compound index');
    
    await Category.collection.createIndex({ name: 1, companyId: 1 });
    console.log('  ✓ name + companyId compound index');
    
    await Category.collection.createIndex({ createdAt: -1 });
    console.log('  ✓ createdAt index');
    
    await Category.collection.createIndex({ 'items.isService': 1 });
    console.log('  ✓ items.isService index');

    // User Indexes (for Super Admin queries)
    console.log('\n👤 User Indexes:'.yellow);
    await User.collection.createIndex({ role: 1, isActive: 1 });
    console.log('  ✓ role + isActive compound index');
    
    await User.collection.createIndex({ companyId: 1, role: 1 });
    console.log('  ✓ companyId + role compound index');
    
    await User.collection.createIndex({ email: 1 }, { unique: true });
    console.log('  ✓ email unique index');

    console.log('\n✅ All indexes created successfully!'.green.bold);
  } catch (error) {
    console.error('❌ Error creating indexes:'.red.bold, error);
  }
}

// 2. ANALYZE QUERY PERFORMANCE
async function analyzeQueryPerformance() {
  console.log('\n🔍 Analyzing Query Performance...'.cyan.bold);

  try {
    // Test Company Queries
    console.log('\n🏢 Company Query Performance:'.yellow);
    
    const companyStart = Date.now();
    const companies = await Company.find({ isActive: true, isDeleted: false })
      .select('name email isActive')
      .limit(50)
      .lean();
    const companyTime = Date.now() - companyStart;
    console.log(`  ✓ Active companies query: ${companyTime}ms (${companies.length} results)`);
    
    if (companyTime > 300) {
      console.log('  ⚠️  WARNING: Query exceeds 300ms target'.yellow);
    }

    // Test Category Queries
    console.log('\n📁 Category Query Performance:'.yellow);
    
    if (companies.length > 0) {
      const categoryStart = Date.now();
      const categories = await Category.find({ 
        companyId: companies[0]._id,
        isDeleted: false 
      })
        .select('name items')
        .lean();
      const categoryTime = Date.now() - categoryStart;
      console.log(`  ✓ Categories by company query: ${categoryTime}ms (${categories.length} results)`);
      
      if (categoryTime > 300) {
        console.log('  ⚠️  WARNING: Query exceeds 300ms target'.yellow);
      }
    }

    // Test Dashboard Stats Query
    console.log('\n📊 Dashboard Stats Performance:'.yellow);
    
    const statsStart = Date.now();
    const [totalCompanies, activeCompanies, totalCategories] = await Promise.all([
      Company.countDocuments({ isDeleted: false }),
      Company.countDocuments({ isActive: true, isDeleted: false }),
      Category.countDocuments({ isDeleted: false })
    ]);
    const statsTime = Date.now() - statsStart;
    console.log(`  ✓ Dashboard stats query: ${statsTime}ms`);
    console.log(`    - Total Companies: ${totalCompanies}`);
    console.log(`    - Active Companies: ${activeCompanies}`);
    console.log(`    - Total Categories: ${totalCategories}`);
    
    if (statsTime > 500) {
      console.log('  ⚠️  WARNING: Stats query exceeds 500ms target'.yellow);
    }

    console.log('\n✅ Query performance analysis complete!'.green.bold);
  } catch (error) {
    console.error('❌ Error analyzing queries:'.red.bold, error);
  }
}

// 3. GENERATE OPTIMIZATION REPORT
async function generateOptimizationReport() {
  console.log('\n📋 Generating Optimization Report...'.cyan.bold);

  try {
    // Get collection stats
    const companyStats = await Company.collection.stats();
    const categoryStats = await Category.collection.stats();
    const userStats = await User.collection.stats();

    console.log('\n📊 Collection Statistics:'.yellow);
    console.log(`  Companies: ${companyStats.count} documents, ${(companyStats.size / 1024).toFixed(2)} KB`);
    console.log(`  Categories: ${categoryStats.count} documents, ${(categoryStats.size / 1024).toFixed(2)} KB`);
    console.log(`  Users: ${userStats.count} documents, ${(userStats.size / 1024).toFixed(2)} KB`);

    // Get index information
    console.log('\n🔍 Index Information:'.yellow);
    
    const companyIndexes = await Company.collection.indexes();
    console.log(`  Company Indexes: ${companyIndexes.length}`);
    companyIndexes.forEach(idx => {
      console.log(`    - ${JSON.stringify(idx.key)}`);
    });

    const categoryIndexes = await Category.collection.indexes();
    console.log(`  Category Indexes: ${categoryIndexes.length}`);
    categoryIndexes.forEach(idx => {
      console.log(`    - ${JSON.stringify(idx.key)}`);
    });

    console.log('\n✅ Optimization report generated!'.green.bold);
  } catch (error) {
    console.error('❌ Error generating report:'.red.bold, error);
  }
}

// 4. RECOMMENDATIONS
function printRecommendations() {
  console.log('\n💡 Performance Recommendations:'.cyan.bold);
  console.log('\n  Backend Optimizations:'.yellow);
  console.log('    ✓ Use .lean() for read-only queries (30-50% faster)');
  console.log('    ✓ Use .select() to fetch only required fields');
  console.log('    ✓ Use Promise.all() for parallel queries');
  console.log('    ✓ Implement Redis caching for dashboard stats');
  console.log('    ✓ Use aggregation pipelines for complex queries');
  
  console.log('\n  Frontend Optimizations:'.yellow);
  console.log('    ✓ Implement cache-first data loading');
  console.log('    ✓ Use custom shimmers matching exact layouts');
  console.log('    ✓ Split large screens into independent widgets');
  console.log('    ✓ Use ListView.builder for all lists');
  console.log('    ✓ Avoid setState at root of complex screens');
  
  console.log('\n  Target Metrics:'.yellow);
  console.log('    ✓ API Response Time: < 300ms (simple queries)');
  console.log('    ✓ API Response Time: < 800ms (complex queries)');
  console.log('    ✓ UI First Paint: < 100ms (show shimmer)');
  console.log('    ✓ UI Data Display: < 1000ms (show actual data)');
}

// MAIN EXECUTION
async function main() {
  console.log('🚀 SUPER ADMIN PERFORMANCE OPTIMIZATION'.cyan.bold);
  console.log('==========================================\n'.cyan);

  await connectDB();
  
  await createOptimizedIndexes();
  await analyzeQueryPerformance();
  await generateOptimizationReport();
  printRecommendations();

  console.log('\n✅ Optimization Complete!'.green.bold);
  console.log('==========================================\n'.green);

  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('❌ Script Error:'.red.bold, error);
  process.exit(1);
});
