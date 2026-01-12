// const mongoose = require('mongoose');

// const connectDB = async () => {
//     try {
//         const conn = await mongoose.connect(process.env.MONGODB_URI, {
//             // Remove deprecated options - Mongoose 6+ handles these automatically
//         });

//         console.log(`✅ MongoDB Connected: ${conn.connection.host}`.cyan.bold);

//         // Handle connection events
//         mongoose.connection.on('error', (err) => {
//             console.error(`❌ MongoDB connection error: ${err}`.red);
//         });

//         mongoose.connection.on('disconnected', () => {
//             console.log('⚠️  MongoDB disconnected'.yellow);
//         });

//         // Graceful shutdown
//         process.on('SIGINT', async () => {
//             await mongoose.connection.close();
//             console.log('MongoDB connection closed through app termination');
//             process.exit(0);
//         });

//     } catch (error) {
//         console.error(`❌ Error connecting to MongoDB: ${error.message}`.red.bold);
//         // Do not exit the process during development — allow the server to start
//         // so frontend work (and mock routes) can continue without a DB.
//         // Note: Production deployments should fail-fast; adjust behavior via env var if needed.
//         if (process.env.NODE_ENV === 'production') {
//             process.exit(1);
//         }
//         return;
//     }
// };

// module.exports = connectDB;
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`.cyan.bold);

        // 🚨 පරණ කරදරකාරී Index එක බලහත්කාරයෙන් අයින් කිරීමේ කොටස
        mongoose.connection.once('open', async () => {
            try {
                // JobCosts collection එක තියෙනවද බලනවා
                const collections = await mongoose.connection.db.listCollections({ name: 'jobcosts' }).toArray();
                if (collections.length > 0) {
                    // invoiceId_1 කියන වැරදි index එක අයින් කරනවා
                    await mongoose.connection.db.collection('jobcosts').dropIndex('invoiceId_1');
                    console.log('🧹 DB CLEANUP: Successfully dropped old invoiceId_1 index'.magenta.bold);
                }
            } catch (err) {
                // Index එක නැත්නම් Error එකක් එයි, ඒක ගණන් ගන්න එපා
                if (err.codeName === 'IndexNotFound') {
                    console.log('ℹ️  DB CLEANUP: Old index not found, system is clean.'.grey);
                }
            }
        });

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error(`❌ MongoDB connection error: ${err}`.red);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('⚠️  MongoDB disconnected'.yellow);
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            await mongoose.connection.close();
            console.log('MongoDB connection closed through app termination');
            process.exit(0);
        });

    } catch (error) {
        console.error(`❌ Error connecting to MongoDB: ${error.message}`.red.bold);
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
        return;
    }
};

module.exports = connectDB;