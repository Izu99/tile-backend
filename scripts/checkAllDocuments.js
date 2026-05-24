const mongoose = require('mongoose');
require('colors');

const MONGODB_URI = 'mongodb+srv://lms:lms123@cluster0.siobua7.mongodb.net/tile-management?retryWrites=true&w=majority&appName=Cluster0';

async function checkDocuments() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected'.green);

        const User = require('../models/User');
        const QuotationDocument = require('../models/QuotationDocument');

        const users = await User.find().select('_id email quotationCounter invoiceCounter');
        
        for (const user of users) {
            console.log(`\n📧 ${user.email}`.cyan.bold);

            // Get last 3 quotations
            const quotations = await QuotationDocument.find({
                user: user._id,
                type: 'quotation'
            })
                .select('documentNumber status')
                .sort({ documentNumber: -1 })
                .limit(3)
                .lean();

            // Get last 3 invoices
            const invoices = await QuotationDocument.find({
                user: user._id,
                type: 'invoice'
            })
                .select('documentNumber status')
                .sort({ documentNumber: -1 })
                .limit(3)
                .lean();

            console.log(`   Quotations (latest 3):`);
            if (quotations.length === 0) {
                console.log(`     (none)`.gray);
            } else {
                quotations.forEach(q => console.log(`     QUO-${q.documentNumber} [${q.status}]`));
            }

            console.log(`   Invoices (latest 3):`);
            if (invoices.length === 0) {
                console.log(`     (none)`.gray);
            } else {
                invoices.forEach(inv => console.log(`     INV-${inv.documentNumber} [${inv.status}]`));
            }

            // Count totals
            const quoCount = await QuotationDocument.countDocuments({ user: user._id, type: 'quotation' });
            const invCount = await QuotationDocument.countDocuments({ user: user._id, type: 'invoice' });

            console.log(`   Totals: ${quoCount} quotations, ${invCount} invoices`);
            console.log(`   Counters: quotationCounter=${user.quotationCounter}, invoiceCounter=${user.invoiceCounter}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

checkDocuments();
