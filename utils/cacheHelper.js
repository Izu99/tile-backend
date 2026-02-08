/**
 * 🔥 CACHE HELPER UTILITY
 * 
 * Centralized caching logic to avoid repetition across controllers
 */

const NodeCache = require('node-cache');

// Activity cache instance
const activityCache = new NodeCache({ 
    stdTTL: 300, // 5 minutes default
    checkperiod: 60,
    useClones: false 
});

/**
 * Generic cache helper class
 */
class CacheHelper {
    constructor(cacheInstance, defaultTTL = 300) {
        this.cache = cacheInstance;
        this.defaultTTL = defaultTTL;
    }

    /**
     * Get data from cache or execute function if not cached
     * @param {string} key - Cache key
     * @param {Function} fetchFunction - Function to execute if cache miss
     * @param {number} ttl - Time to live in seconds (optional)
     * @returns {Promise<{data: any, cached: boolean, cacheTime?: number}>}
     */
    async getOrSet(key, fetchFunction, ttl = null) {
        const startTime = Date.now();
        
        // Try to get from cache
        const cachedData = this.cache.get(key);
        
        if (cachedData !== undefined) {
            const cacheTime = Date.now() - startTime;
            console.log(`💾 Cache Hit [${key}]: ${cacheTime}ms`.green);
            return {
                data: cachedData,
                cached: true,
                cacheTime
            };
        }

        // Cache miss - execute function
        console.log(`🔍 Cache Miss [${key}] - Fetching data...`.yellow);
        const data = await fetchFunction();
        
        // Store in cache
        const finalTTL = ttl || this.defaultTTL;
        this.cache.set(key, data, finalTTL);
        
        return {
            data,
            cached: false
        };
    }

    /**
     * Set data in cache
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     * @param {number} ttl - Time to live in seconds (optional)
     */
    set(key, data, ttl = null) {
        const finalTTL = ttl || this.defaultTTL;
        this.cache.set(key, data, finalTTL);
    }

    /**
     * Get data from cache
     * @param {string} key - Cache key
     * @returns {any} - Cached data or undefined
     */
    get(key) {
        return this.cache.get(key);
    }

    /**
     * Delete specific cache entries
     * @param {string|string[]} keys - Cache key(s) to delete
     */
    delete(keys) {
        if (Array.isArray(keys)) {
            this.cache.del(keys);
        } else {
            this.cache.del(keys);
        }
    }

    /**
     * Clear cache entries matching a pattern
     * @param {string} pattern - Pattern to match (e.g., 'user_123_')
     * @returns {number} - Number of cleared entries
     */
    clearPattern(pattern) {
        const keys = this.cache.keys();
        const matchingKeys = keys.filter(key => key.includes(pattern));
        
        if (matchingKeys.length > 0) {
            this.cache.del(matchingKeys);
            console.log(`🗑️  Cleared ${matchingKeys.length} cache entries matching pattern: ${pattern}`.yellow);
        }
        
        return matchingKeys.length;
    }

    /**
     * Clear all cache entries
     * @returns {number} - Number of cleared entries
     */
    clearAll() {
        const keys = this.cache.keys();
        this.cache.flushAll();
        console.log(`🗑️  Cleared all cache entries (${keys.length} total)`.yellow);
        return keys.length;
    }

    /**
     * Get cache statistics
     * @returns {object} - Cache statistics
     */
    getStats() {
        return {
            keys: this.cache.keys().length,
            hits: this.cache.getStats().hits,
            misses: this.cache.getStats().misses,
            ksize: this.cache.getStats().ksize,
            vsize: this.cache.getStats().vsize
        };
    }
}

// Create activity cache helper instance
const activityCacheHelper = new CacheHelper(activityCache, 300);

module.exports = {
    CacheHelper,
    activityCacheHelper,
    activityCache // Export raw cache for backward compatibility
};