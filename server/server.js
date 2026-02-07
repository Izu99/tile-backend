require('dotenv').config();
require('colors');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Connect to database
connectDB();

// 🔥 MODEL REGISTRATION: Load all models to ensure they're registered with Mongoose
const { loadAllModels, verifyModelsRegistered } = require('./utils/modelLoader');

// Load all models immediately after database connection
try {
    loadAllModels();
    
    // Verify that all models required by CacheService are available
    const requiredModels = ['User', 'QuotationDocument', 'MaterialSale', 'JobCost', 'PurchaseOrder', 'ActivityLog'];
    verifyModelsRegistered(requiredModels);
    
} catch (error) {
    console.error('❌ Model loading failed:'.red, error.message);
    process.exit(1);
}

// 🔥 CACHE PRIMING: Initialize Super Admin dashboard cache after DB connection is ready
const initializeCaches = async () => {
    try {
        const mongoose = require('mongoose');
        
        // Check if already connected
        if (mongoose.connection.readyState === 1) {
            console.log('🔗 MongoDB already connected, initializing caches...'.green);
            const CacheService = require('./services/cacheService');
            await CacheService.initializeCaches();
        } else {
            // Wait for connection event (only once)
            let cacheInitialized = false;
            
            mongoose.connection.once('connected', async () => {
                if (!cacheInitialized) {
                    cacheInitialized = true;
                    console.log('🔗 MongoDB connection established, initializing caches...'.green);
                    
                    // Add a small delay to ensure connection is fully ready
                    setTimeout(async () => {
                        try {
                            const CacheService = require('./services/cacheService');
                            await CacheService.initializeCaches();
                        } catch (error) {
                            console.error('❌ Cache initialization failed after connection:', error.message.red);
                        }
                    }, 1000); // 1 second delay after connection
                }
            });
        }
    } catch (error) {
        console.error('❌ Cache initialization setup failed:', error.message.red);
    }
};

// Initialize caches
initializeCaches();

// Initialize express app
const app = express();

// Security middleware
app.use(helmet()); // Set security headers
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(hpp()); // Prevent HTTP parameter pollution

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'development' ? 10000 : (parseInt(process.env.RATE_LIMIT_MAX) || 100), // higher limit for dev
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Static folder for uploads - serving from uploads_storage directory (outside project)
const path = require('path');
const uploadsStoragePath = path.resolve(__dirname, '..', '..', 'uploads_storage');

// 🔍 VERIFICATION: Log the resolved upload directory path
console.log('📁 Upload Storage Configuration:'.cyan);
console.log(`   Resolved Path: ${uploadsStoragePath}`.cyan);
console.log(`   Directory Exists: ${require('fs').existsSync(uploadsStoragePath)}`.cyan);
console.log(`   Virtual Path: /uploads`.cyan);

app.use('/uploads', express.static(uploadsStoragePath));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/purchase-orders', require('./routes/purchaseOrderRoutes'));
app.use('/api/quotations', require('./routes/quotationRoutes'));
app.use('/api/material-sales', require('./routes/materialSaleRoutes'));
app.use('/api/job-costs', require('./routes/jobCostRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/site-visits', require('./routes/siteVisitRoutes'));
app.use('/api/super-admin', require('./routes/superAdminRoutes'));
app.use('/api/activities', require('./routes/activityLogRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));

// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});

// WebSocket status endpoint
app.get('/api/websocket/status', (req, res) => {
    const webSocketService = require('./services/websocketService');
    const stats = webSocketService.getConnectionStats();
    
    res.status(200).json({
        success: true,
        message: 'WebSocket service status',
        data: {
            ...stats,
            timestamp: new Date().toISOString()
        }
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Business Management API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            suppliers: '/api/suppliers',
            purchaseOrders: '/api/purchase-orders',
            quotations: '/api/quotations',
            materialSales: '/api/material-sales',
            jobCosts: '/api/job-costs',
            dashboard: '/api/dashboard',
            reports: '/api/reports',
            health: '/api/health',
        },
    });
});

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n${'='.repeat(50)}`.green);
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode`.cyan.bold);
    console.log(`📡 Port: ${PORT}`.cyan);
    console.log(`🌐 Local: http://localhost:${PORT}`.cyan);
    console.log(`🌐 Network: http://192.168.43.132:${PORT}`.cyan);
    console.log(`${'='.repeat(50)}\n`.green);
});

// 🔥 WEBSOCKET INTEGRATION: Initialize Socket.io after server starts
const webSocketService = require('./services/websocketService');
webSocketService.initialize(server);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`❌ Error: ${err.message}`.red.bold);
    // Close server & exit process
    server.close(() => process.exit(1));
});

module.exports = app;
