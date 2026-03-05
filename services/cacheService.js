/**
 * 🔥 CACHE PRIMING SERVICE FOR SUPER ADMIN DASHBOARD
 * 
 * This service handles:
 * - Batch processing for cache priming across all active tenants
 * - Global system statistics aggregation
 * - Memory-efficient processing to avoid database limits
 * - Background cache warming and maintenance
 */

const NodeCache = require('node-cache');
const mongoose = require('mongoose');
const webSocketService = require('./websocketService');

// Remove direct model imports to avoid circular dependencies
// Models will be accessed via mongoose.model() for lazy loading

// 🔥 CACHE INSTANCES
const superAdminCache = new NodeCache({ 
    stdTTL: 300, // 5 minutes for super admin data
    checkperiod: 60,
    useClones: false 
});

const tenantDashboardCache = new NodeCache({ 
    stdTTL: 120, // 2 minutes for tenant dashboards
    checkperiod: 30,
    useClones: false 
});

// 🔥 CACHE KEYS
const CACHE_KEYS = {
    SUPER_ADMIN_GLOBAL_STATS: 'super_admin_global_stats',
    SUPER_ADMIN_RECENT_ACTIVITY: 'super_admin_recent_activity',
    SUPER_ADMIN_RECENT_COMPANIES: 'super_admin_recent_companies',
    TENANT_DASHBOARD_PREFIX: 'tenant_dashboard_',
    GLOBAL_REVENUE_TRENDS: 'global_revenue_trends'
};

class CacheService {
    /**
     * 🔥 GLOBAL STATISTICS AGGREGATION: Fetch and cache global system stats
     */
    static async fetchGlobalSystemStats() {
        const startTime = Date.now();
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔄 CacheService.fetchGlobalSystemStats() START:', new Date().toISOString());
        console.log('═══════════════════════════════════════════════════════════');
        
        try {
            console.log('📤 Step 1: Loading models...');
            const modelLoadStart = Date.now();
            
            // 🔥 SAFE MODEL ACCESS: Use utility to get models with error handling
            const { getModel } = require('../utils/modelLoader');
            
            const User = getModel('User');
            const QuotationDocument = getModel('QuotationDocument');
            const MaterialSale = getModel('MaterialSale');
            const JobCost = getModel('JobCost');
            const PurchaseOrder = getModel('PurchaseOrder');
            
            const modelLoadDuration = Date.now() - modelLoadStart;
            console.log(`✅ Step 1 Complete: Models loaded in ${modelLoadDuration}ms`);

            console.log('');
            console.log('📡 Step 2: Fetching data from all models (parallel)...');
            const fetchStart = Date.now();
            
            // Parallel execution of all global statistics
            const [
                userStats,
                quotationStats,
                materialSaleStats,
                jobCostStats,
                purchaseOrderStats,
                recentActivity,
                recentCompanies
            ] = await Promise.all([
                User.getGlobalSystemStats(),
                QuotationDocument.getGlobalSystemStats(),
                MaterialSale.getGlobalSystemStats(),
                JobCost.getGlobalSystemStats(),
                PurchaseOrder.getGlobalSystemStats(),
                this.fetchRecentActivity(),
                this.fetchRecentCompanies()
            ]);
            
            const fetchDuration = Date.now() - fetchStart;
            console.log(`✅ Step 2 Complete: All data fetched in ${fetchDuration}ms`);
            console.log(`   - User Stats: ${JSON.stringify(userStats?.stats || {})}`);
            console.log(`   - Quotation Stats: ${JSON.stringify(quotationStats?.stats || {})}`);
            console.log(`   - Material Sale Stats: ${JSON.stringify(materialSaleStats?.stats || {})}`);
            console.log(`   - Job Cost Stats: ${JSON.stringify(jobCostStats?.stats || {})}`);
            console.log(`   - Purchase Order Stats: ${JSON.stringify(purchaseOrderStats?.stats || {})}`);
            console.log(`   - Recent Activity: ${recentActivity?.data?.length || 0} items`);
            console.log(`   - Recent Companies: ${recentCompanies?.data?.length || 0} items`);

            console.log('');
            console.log('🔄 Step 3: Combining statistics...');
            const combineStart = Date.now();
            
            // Combine all statistics with fallback defaults
            const globalStats = {
                // User/Company stats with fallbacks
                ...(userStats?.stats || { totalCompanies: 0, activeCompanies: 0 }),
                
                // Revenue and project stats with fallbacks
                ...(quotationStats?.stats || { totalRevenue: 0, totalProjects: 0 }),
                
                // Material sales stats with fallbacks
                ...(materialSaleStats?.stats || { totalMaterialSales: 0 }),
                
                // Job cost stats with fallbacks
                ...(jobCostStats?.stats || { totalJobCosts: 0 }),
                
                // Purchase order stats with fallbacks
                ...(purchaseOrderStats?.stats || { totalPurchaseOrders: 0 }),
                
                // Recent data with fallbacks
                recentActivity: recentActivity?.data || [],
                recentCompanies: recentCompanies?.data || [],
                
                // Performance metrics
                _performance: {
                    dbTimeMs: Date.now() - startTime,
                    cached: false,
                    optimizationNote: 'Global stats aggregated from all models with multi-tenant security',
                    modelPerformance: {
                        userStats: userStats?._performance || { dbTimeMs: 0 },
                        quotationStats: quotationStats?._performance || { dbTimeMs: 0 },
                        materialSaleStats: materialSaleStats?._performance || { dbTimeMs: 0 },
                        jobCostStats: jobCostStats?._performance || { dbTimeMs: 0 },
                        purchaseOrderStats: purchaseOrderStats._performance
                    }
                }
            };
            
            const combineDuration = Date.now() - combineStart;
            console.log(`✅ Step 3 Complete: Statistics combined in ${combineDuration}ms`);

            console.log('');
            console.log('💾 Step 4: Caching results...');
            const cacheStart = Date.now();
            
            // Cache the results
            superAdminCache.set(CACHE_KEYS.SUPER_ADMIN_GLOBAL_STATS, globalStats);
            
            const cacheDuration = Date.now() - cacheStart;
            console.log(`✅ Step 4 Complete: Results cached in ${cacheDuration}ms`);
            
            const totalTime = Date.now() - startTime;
            console.log('');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('✅ fetchGlobalSystemStats() SUCCESS');
            console.log(`⏱️  Total Time: ${totalTime}ms`);
            console.log(`   - Model Loading: ${modelLoadDuration}ms`);
            console.log(`   - Data Fetching: ${fetchDuration}ms`);
            console.log(`   - Combining: ${combineDuration}ms`);
            console.log(`   - Caching: ${cacheDuration}ms`);
            console.log(`📊 Final Stats: Companies=${globalStats.totalCompanies}, Categories=${globalStats.totalCategories}`);
            console.log('═══════════════════════════════════════════════════════════');
            console.log('');
            
            return globalStats;
        } catch (error) {
            const totalDuration = Date.now() - startTime;
            
            console.log('');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('💥 fetchGlobalSystemStats() FAILED');
            console.log(`⏱️  Failed after: ${totalDuration}ms`);
            console.log(`❌ Error Type: ${error.constructor.name}`);
            console.log(`❌ Error Message: ${error.message}`);
            console.log('📍 Stack Trace:');
            console.error(error.stack);
            console.log('═══════════════════════════════════════════════════════════');
            console.log('');
            
            throw error;
        }
    }

    /**
     * 🔥 RECENT ACTIVITY: Fetch recent system activity
     */
    static async fetchRecentActivity() {
        try {
            const startTime = Date.now();
            
            // 🔥 SAFE MODEL ACCESS: Use utility to get ActivityLog model
            const { getModel } = require('../utils/modelLoader');
            const ActivityLog = getModel('ActivityLog');
            
            const recentActivity = await ActivityLog.find()
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('performedBy', 'name companyName')
                .lean();

            const dbTime = Date.now() - startTime;
            
            return {
                data: recentActivity || [],
                _performance: {
                    dbTimeMs: dbTime,
                    optimizationNote: 'Recent activity with lean queries'
                }
            };
        } catch (error) {
            console.error('❌ CacheService.fetchRecentActivity error:', error);
            return { data: [], _performance: { dbTimeMs: 0, error: error.message } };
        }
    }

    /**
     * 🔥 RECENT COMPANIES: Fetch recently registered companies
     */
    static async fetchRecentCompanies() {
        try {
            const startTime = Date.now();
            
            // 🔥 SAFE MODEL ACCESS: Use utility to get User model
            const { getModel } = require('../utils/modelLoader');
            const User = getModel('User');
            
            const recentCompanies = await User.find({ 
                role: 'company',
                // Multi-tenant security
                $expr: { $eq: ['$role', 'company'] }
            })
                .sort({ createdAt: -1 })
                .limit(10)
                .select('name email companyName companyPhone isActive createdAt')
                .lean();

            const dbTime = Date.now() - startTime;
            
            return {
                data: recentCompanies || [],
                _performance: {
                    dbTimeMs: dbTime,
                    optimizationNote: 'Recent companies with lean queries and multi-tenant security'
                }
            };
        } catch (error) {
            console.error('❌ CacheService.fetchRecentCompanies error:', error);
            return { data: [], _performance: { dbTimeMs: 0, error: error.message } };
        }
    }

    /**
     * 🔥 CACHE PRIMING: Prime dashboard caches for all active tenants
     * Uses batch processing to avoid memory limits
     */
    static async primeAllTenantCaches(batchSize = 10) {
        try {
            console.log('🚀 Starting tenant cache priming...'.cyan);
            const startTime = Date.now();

            // Get all active tenant IDs
            const activeTenantIds = await User.getActiveTenantIds();
            console.log(`📊 Found ${activeTenantIds.length} active tenants for cache priming`.yellow);

            if (activeTenantIds.length === 0) {
                console.log('ℹ️  No active tenants found, skipping cache priming'.yellow);
                return { primedCount: 0, totalTime: 0 };
            }

            let primedCount = 0;
            let failedCount = 0;

            // Process tenants in batches to avoid memory issues
            for (let i = 0; i < activeTenantIds.length; i += batchSize) {
                const batch = activeTenantIds.slice(i, i + batchSize);
                console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(activeTenantIds.length/batchSize)} (${batch.length} tenants)`.cyan);

                // Process batch in parallel with timeout
                const batchPromises = batch.map(async (tenantId) => {
                    try {
                        // Add timeout for each tenant
                        const tenantPromise = this.primeTenantDashboardCache(tenantId);
                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Tenant cache priming timeout')), 10000)
                        );
                        
                        await Promise.race([tenantPromise, timeoutPromise]);
                        return { tenantId, success: true };
                    } catch (error) {
                        console.error(`⚠️  Failed to prime cache for tenant ${tenantId}:`, error.message.yellow);
                        return { tenantId, success: false, error: error.message };
                    }
                });

                const batchResults = await Promise.allSettled(batchPromises);
                
                // Count results
                batchResults.forEach(result => {
                    if (result.status === 'fulfilled' && result.value.success) {
                        primedCount++;
                    } else {
                        failedCount++;
                    }
                });

                // Small delay between batches to prevent overwhelming the database
                if (i + batchSize < activeTenantIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            const totalTime = Date.now() - startTime;
            console.log(`✅ Tenant cache priming completed: ${primedCount} successful, ${failedCount} failed, ${totalTime}ms total`.green);

            return { primedCount, failedCount, totalTime };
        } catch (error) {
            console.error('❌ CacheService.primeAllTenantCaches error:', error);
            throw error;
        }
    }

    /**
     * 🔥 TENANT DASHBOARD CACHE: Prime individual tenant dashboard cache
     */
    static async primeTenantDashboardCache(tenantId) {
        try {
            const cacheKey = `${CACHE_KEYS.TENANT_DASHBOARD_PREFIX}${tenantId}`;
            
            // Check if already cached
            if (tenantDashboardCache.get(cacheKey)) {
                return; // Already cached
            }

            const startTime = Date.now();
            const dateRange = this.getDefaultDateRange();

            // Fetch tenant dashboard data in parallel
            const [quotationStats, materialSaleStats, jobCostStats, purchaseOrderStats] = await Promise.all([
                QuotationDocument.getDashboardStats(tenantId, dateRange.start, dateRange.end),
                MaterialSale.getDashboardStats(tenantId, dateRange.start, dateRange.end),
                JobCost.getDashboardStats(tenantId, dateRange.start, dateRange.end),
                PurchaseOrder.getDashboardStats(tenantId, dateRange.start, dateRange.end)
            ]);

            const dashboardData = {
                quotationStats,
                materialSaleStats,
                jobCostStats,
                purchaseOrderStats,
                _performance: {
                    dbTimeMs: Date.now() - startTime,
                    cached: false,
                    tenantId,
                    optimizationNote: 'Tenant dashboard stats with parallel model queries'
                }
            };

            // Cache the data
            tenantDashboardCache.set(cacheKey, dashboardData);
            
        } catch (error) {
            console.error(`❌ Failed to prime tenant cache for ${tenantId}:`, error);
            throw error;
        }
    }

    /**
     * 🔥 CACHE RETRIEVAL: Get cached global stats or fetch if not cached
     */
    static async getGlobalSystemStats() {
        const startTime = Date.now();
        console.log('');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🔍 CacheService.getGlobalSystemStats() START:', new Date().toISOString());
        console.log('═══════════════════════════════════════════════════════════');
        
        try {
            console.log('📤 Step 1: Checking cache...');
            console.log(`⏱️  Time: ${Date.now() - startTime}ms`);
            console.log(`🔑 Cache Key: ${CACHE_KEYS.SUPER_ADMIN_GLOBAL_STATS}`);
            
            // Try cache first
            let cachedData = superAdminCache.get(CACHE_KEYS.SUPER_ADMIN_GLOBAL_STATS);
            
            if (cachedData) {
                const cacheDuration = Date.now() - startTime;
                console.log('');
                console.log('═══════════════════════════════════════════════════════════');
                console.log('✅ CACHE HIT - Returning cached data');
                console.log(`⏱️  Total Time: ${cacheDuration}ms`);
                console.log(`📊 Data keys: ${Object.keys(cachedData).join(', ')}`);
                console.log('═══════════════════════════════════════════════════════════');
                console.log('');
                
                return {
                    ...cachedData,
                    _performance: {
                        ...cachedData._performance,
                        cached: true,
                        totalTimeMs: cacheDuration
                    }
                };
            }

            // Cache miss - fetch and cache
            const cacheMissDuration = Date.now() - startTime;
            console.log('');
            console.log('❌ CACHE MISS - Fetching fresh data...');
            console.log(`⏱️  Cache check took: ${cacheMissDuration}ms`);
            console.log('');
            console.log('📡 Step 2: Calling fetchGlobalSystemStats()...');
            
            const fetchStartTime = Date.now();
            const result = await this.fetchGlobalSystemStats();
            const fetchDuration = Date.now() - fetchStartTime;
            const totalDuration = Date.now() - startTime;
            
            console.log('');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('✅ CACHE MISS - Fresh data fetched and cached');
            console.log(`⏱️  Total Time: ${totalDuration}ms`);
            console.log(`   - Cache Check: ${cacheMissDuration}ms`);
            console.log(`   - Fetch Data: ${fetchDuration}ms`);
            console.log(`📊 Data keys: ${Object.keys(result).join(', ')}`);
            console.log('═══════════════════════════════════════════════════════════');
            console.log('');
            
            return result;
            
        } catch (error) {
            const totalDuration = Date.now() - startTime;
            
            console.log('');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('💥 CacheService.getGlobalSystemStats() FAILED');
            console.log(`⏱️  Failed after: ${totalDuration}ms`);
            console.log(`❌ Error Type: ${error.constructor.name}`);
            console.log(`❌ Error Message: ${error.message}`);
            console.log('📍 Stack Trace:');
            console.error(error.stack);
            console.log('═══════════════════════════════════════════════════════════');
            console.log('');
            
            throw error;
        }
    }

    /**
     * 🔥 CACHE INVALIDATION: Clear and reprime caches SYNCHRONOUSLY
     */
    static async clearAndPrimeGlobalCache() {
        try {
            console.log('🗑️  Clearing global stats cache and priming synchronously...'.yellow);
            
            // Clear cache first
            superAdminCache.del(CACHE_KEYS.SUPER_ADMIN_GLOBAL_STATS);
            
            // Prime cache SYNCHRONOUSLY to avoid race conditions
            const freshData = await this.fetchGlobalSystemStats();
            
            console.log('✅ Global cache cleared and reprimed synchronously'.green);
            
            // Emit WebSocket event to super admin users AFTER cache is ready
            webSocketService.emitSuperAdminUpdate({
                reason: 'cache_refresh',
                message: 'Super admin dashboard data has been updated',
                data: freshData
            });
            
            return freshData;
        } catch (error) {
            console.error('❌ Synchronous cache refresh failed:', error);
            // Fallback: clear cache and let next request fetch fresh data
            superAdminCache.del(CACHE_KEYS.SUPER_ADMIN_GLOBAL_STATS);
            throw error;
        }
    }

    /**
     * 🔥 BACKGROUND CACHE PRIMING: For non-critical updates
     */
    static clearAndPrimeGlobalCacheAsync() {
        superAdminCache.del(CACHE_KEYS.SUPER_ADMIN_GLOBAL_STATS);
        console.log('🗑️  Cleared global stats cache, starting background priming...'.yellow);
        
        // Prime cache in background
        setImmediate(async () => {
            try {
                const primingPromise = this.fetchGlobalSystemStats();
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Background priming timeout')), 30000)
                );
                
                await Promise.race([primingPromise, timeoutPromise]);
            } catch (error) {
                if (error.message.includes('timeout')) {
                    console.error('⚠️  Background global cache priming timed out (30s)'.yellow);
                } else {
                    console.error('❌ Background global cache priming failed:', error.message.red);
                }
            }
        });
    }

    /**
     * 🔥 CACHE MANAGEMENT: Clear tenant dashboard caches
     */
    static clearTenantCaches(tenantIds = null) {
        if (tenantIds) {
            // Clear specific tenant caches
            const keys = tenantIds.map(id => `${CACHE_KEYS.TENANT_DASHBOARD_PREFIX}${id}`);
            tenantDashboardCache.del(keys);
            console.log(`🗑️  Cleared ${keys.length} tenant dashboard caches`.yellow);
        } else {
            // Clear all tenant caches
            const allKeys = tenantDashboardCache.keys();
            const tenantKeys = allKeys.filter(key => key.startsWith(CACHE_KEYS.TENANT_DASHBOARD_PREFIX));
            tenantDashboardCache.del(tenantKeys);
            console.log(`🗑️  Cleared all tenant dashboard caches (${tenantKeys.length} total)`.yellow);
        }
    }

    /**
     * 🔥 UTILITY: Get default date range for dashboard queries
     */
    static getDefaultDateRange() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: startOfMonth, end: now };
    }

    /**
     * 🔥 GENERIC CACHE METHODS: For flexible caching across the application
     */
    static get(key) {
        try {
            return superAdminCache.get(key);
        } catch (error) {
            console.error(`❌ Cache get error for key ${key}:`, error);
            return null;
        }
    }

    static set(key, value, ttl = 300) {
        try {
            return superAdminCache.set(key, value, ttl);
        } catch (error) {
            console.error(`❌ Cache set error for key ${key}:`, error);
            return false;
        }
    }

    static del(key) {
        try {
            return superAdminCache.del(key);
        } catch (error) {
            console.error(`❌ Cache delete error for key ${key}:`, error);
            return false;
        }
    }

    /**
     * 🔥 CACHE STATISTICS: Get cache statistics for monitoring
     */
    static getCacheStats() {
        return {
            superAdminCache: {
                keys: superAdminCache.keys().length,
                stats: superAdminCache.getStats()
            },
            tenantDashboardCache: {
                keys: tenantDashboardCache.keys().length,
                stats: tenantDashboardCache.getStats()
            }
        };
    }

    /**
     * 🔥 INITIALIZATION: Initialize caches on server startup
     */
    static async initializeCaches() {
        try {
            console.log('🚀 Initializing Super Admin caches...'.cyan);
            
            // Check MongoDB connection
            const mongoose = require('mongoose');
            if (mongoose.connection.readyState !== 1) {
                console.log('⚠️  MongoDB not ready, skipping cache initialization'.yellow);
                return;
            }
            
            // Test connection latency
            const pingStart = Date.now();
            try {
                await mongoose.connection.db.admin().ping();
                const pingTime = Date.now() - pingStart;
                
                if (pingTime > 5000) {
                    console.log(`⚠️  MongoDB ping too slow (${pingTime}ms), skipping cache initialization`.yellow);
                    return;
                }
            } catch (pingError) {
                console.log('⚠️  MongoDB ping failed, skipping cache initialization'.yellow);
                return;
            }
            
            // Initialize global stats cache
            const initPromise = this.fetchGlobalSystemStats();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Initialization timeout')), 30000)
            );
            
            await Promise.race([initPromise, timeoutPromise]);
            console.log('✅ Super Admin caches initialized successfully'.green);
            
        } catch (error) {
            console.error('❌ Failed to initialize Super Admin caches:', error.message.red);
            if (error.message.includes('timeout')) {
                console.log('💡 Tip: Caches will be populated on first API request'.yellow);
            }
        }
    }
}

module.exports = CacheService;