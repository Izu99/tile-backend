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

// Initialize express app
const app = express();

// Security middleware
app.use(helmet()); // Set security headers
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(hpp()); // Prevent HTTP parameter pollution

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
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

// Static folder for uploads
app.use('/uploads', express.static('uploads'));

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

// Health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
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

const server = app.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`.green);
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode`.cyan.bold);
    console.log(`📡 Port: ${PORT}`.cyan);
    console.log(`🌐 URL: http://localhost:${PORT}`.cyan);
    console.log(`${'='.repeat(50)}\n`.green);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`❌ Error: ${err.message}`.red.bold);
    // Close server & exit process
    server.close(() => process.exit(1));
});

module.exports = app;
