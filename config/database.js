const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    const startTime = Date.now();

    // 🔥 OPTIMIZED CONNECTION OPTIONS for ultra-fast login performance
    const options = {
      // 🚀 ENHANCED CONNECTION POOL for high-performance login
      maxPoolSize: 20, // Increased from 10 for better concurrency
      minPoolSize: 5,  // Increased from 2 for faster response
      maxIdleTimeMS: 30000,

      // 🔥 REDUCED TIMEOUT SETTINGS for faster failure detection
      serverSelectionTimeoutMS: 5000,  // 5s - fail fast on network issues
      socketTimeoutMS: 10000,          // 10s socket timeout
      connectTimeoutMS: 5000,          // 5s connect timeout

      // 🚀 OPTIMIZED HEARTBEAT for better connection health
      heartbeatFrequencyMS: 5000, // More frequent heartbeats

      // 🔥 ENHANCED RETRY SETTINGS for connection stability
      retryWrites: true,
      retryReads: true,

      // Additional stability options
      family: 4,
      
      // � REPLICA SET SPECIFIC OPTIONS - TRANSACTION COMPATIBLE
      readPreference: 'primary', // Required for transactions
      readConcern: { level: 'majority' },

      // 🚀 COMPRESSION for faster data transfer
      compressors: ['zlib'],
      zlibCompressionLevel: 1, // Faster compression (less CPU)

      // 🔥 ADDITIONAL PERFORMANCE OPTIONS
      directConnection: false,
      authSource: 'admin',
      
      // 🚀 CONNECTION MONITORING
      monitorCommands: process.env.NODE_ENV === 'development',
    };

    const conn = await mongoose.connect(process.env.MONGODB_URI, options);
    const connectionTime = Date.now() - startTime;

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`⏱️  MongoDB Connection Time: ${connectionTime}ms`);
    console.log(`🔗 Connection Pool Size: ${options.maxPoolSize} (min: ${options.minPoolSize})`);

    // Test a simple query to measure latency
    const pingStart = Date.now();
    await mongoose.connection.db.admin().ping();
    const pingTime = Date.now() - pingStart;
    console.log(`🏓 MongoDB Ping Latency: ${pingTime}ms`);

    // Performance warnings
    if (connectionTime > 5000) {
      console.log('⚠️  WARNING: MongoDB connection took longer than 5 seconds!');
    }
    if (pingTime > 1000) {
      console.log('⚠️  WARNING: MongoDB ping latency is high (>1s)!');
    }

    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error(`❌ MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  MongoDB disconnected - attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected successfully');
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down MongoDB connection...`);
      try {
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during MongoDB shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    console.error(`❌ Error connecting to MongoDB: ${error.message}`);
    console.error(`❌ Full error details:`, error);

    // Enhanced error handling
    if (error.name === 'MongoServerSelectionError') {
      console.error('💡 Suggestion: Check if MongoDB is running and accessible');
      console.error('💡 Suggestion: Verify MONGODB_URI in environment variables');
      
      if (error.message.includes('ReplicaSetNoPrimary')) {
        console.error('🔥 REPLICA SET ISSUE: No primary server available');
        console.error('� Suggestion: Check replica set status and network connectivity');
      }
    }

    if (error.name === 'MongoTimeoutError') {
      console.error('💡 Suggestion: Network latency is high - timeouts increased to 30s');
    }

    if (error.name === 'MongoNetworkError') {
      console.error('💡 Suggestion: Network connectivity issue detected');
    }

    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Production environment - exiting process');
      process.exit(1);
    } else {
      console.log('🔄 Development environment - continuing without database');
    }
  }
};

module.exports = connectDB;