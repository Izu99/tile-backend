/**
 * 🔥 PERFORMANCE MONITORING MIDDLEWARE
 * 
 * This middleware tracks request performance and identifies bottlenecks
 * specifically for login API optimization.
 */

const performanceMonitor = (req, res, next) => {
    // Start timing
    req.startTime = Date.now();
    req.performanceLog = {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        contentLength: req.get('Content-Length') || 0,
        middlewareTimings: []
    };

    // Log middleware entry
    console.log(`🚀 REQUEST START: ${req.method} ${req.url} at ${new Date().toISOString()}`);
    
    // Override res.json to capture response timing
    const originalJson = res.json;
    res.json = function(data) {
        const totalTime = Date.now() - req.startTime;
        
        // Log performance summary
        console.log(`\n📊 REQUEST PERFORMANCE SUMMARY:`);
        console.log(`   🎯 Endpoint: ${req.method} ${req.url}`);
        console.log(`   ⏱️  Total Time: ${totalTime}ms`);
        console.log(`   📦 Response Size: ${JSON.stringify(data).length} bytes`);
        
        // Performance classification
        if (totalTime > 10000) {
            console.log(`🚨 CRITICAL: Request took ${totalTime}ms (>10s) - MAJOR BOTTLENECK!`);
        } else if (totalTime > 5000) {
            console.log(`⚠️  WARNING: Request took ${totalTime}ms (>5s) - needs optimization`);
        } else if (totalTime > 1000) {
            console.log(`⚡ ACCEPTABLE: Request took ${totalTime}ms (>1s) - could be faster`);
        } else {
            console.log(`🚀 EXCELLENT: Request took ${totalTime}ms - very fast!`);
        }
        
        // Middleware timing breakdown
        if (req.performanceLog.middlewareTimings.length > 0) {
            console.log(`   🔧 Middleware Breakdown:`);
            req.performanceLog.middlewareTimings.forEach((timing, index) => {
                console.log(`      ${index + 1}. ${timing.name}: ${timing.duration}ms`);
            });
        }
        
        console.log(`\n`);
        
        // Call original json method
        return originalJson.call(this, data);
    };

    // Track middleware timing
    const middlewareStart = Date.now();
    
    // Continue to next middleware
    next();
    
    // Log this middleware's timing
    const middlewareDuration = Date.now() - middlewareStart;
    req.performanceLog.middlewareTimings.push({
        name: 'performanceMonitor',
        duration: middlewareDuration
    });
};

// Middleware timing wrapper
const timeMiddleware = (name, middleware) => {
    return (req, res, next) => {
        const start = Date.now();
        
        middleware(req, res, (err) => {
            const duration = Date.now() - start;
            
            if (req.performanceLog) {
                req.performanceLog.middlewareTimings.push({
                    name: name,
                    duration: duration
                });
                
                // Log slow middleware
                if (duration > 1000) {
                    console.log(`⚠️  SLOW MIDDLEWARE: ${name} took ${duration}ms`);
                } else if (duration > 100) {
                    console.log(`⚡ MIDDLEWARE: ${name} took ${duration}ms`);
                }
            }
            
            next(err);
        });
    };
};

module.exports = {
    performanceMonitor,
    timeMiddleware
};