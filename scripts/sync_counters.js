const mongoose = require('mongoose');
require('dotenv').config({ path: 'd:/digihack/project/server/.env' });
const QuotationDocument = require('../models/QuotationDocument');
const MaterialSale = require('../models/MaterialSale');
const User = require('../models/User');

async function syncCounters() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        const extractMax = (docs) => {
            let max = 0;
            for (const doc of docs) {
                if (!doc) continue;
                const match = doc.match(/\d+/);
                if (match) {
                    const num = parseInt(match[0]);
                    if (num > max) max = num;
                }
            }
            return max;
        };

        // 1. Quotations
        console.log('🔍 Analyzing Quotations...');
        const quotes = await QuotationDocument.find({ type: 'quotation' }, 'user documentNumber').lean();
        const quoteGroups = quotes.reduce((acc, doc) => {
            const userId = doc.user.toString();
            if (!acc[userId]) acc[userId] = [];
            acc[userId].push(doc.documentNumber);
            return acc;
        }, {});

        // 2. Invoices
        console.log('🔍 Analyzing Invoices...');
        const invoices = await QuotationDocument.find({ type: 'invoice' }, 'user documentNumber').lean();
        const invoiceGroups = invoices.reduce((acc, doc) => {
            const userId = doc.user.toString();
            if (!acc[userId]) acc[userId] = [];
            acc[userId].push(doc.documentNumber);
            return acc;
        }, {});

        // 3. Material Sales
        console.log('🔍 Analyzing Material Sales...');
        const sales = await MaterialSale.find({}, 'user invoiceNumber').lean();
        const saleGroups = sales.reduce((acc, doc) => {
            const userId = doc.user.toString();
            if (!acc[userId]) acc[userId] = [];
            acc[userId].push(doc.invoiceNumber);
            return acc;
        }, {});

        console.log('📊 Updating user counters...');

        const allUserIds = new Set([...Object.keys(quoteGroups), ...Object.keys(invoiceGroups), ...Object.keys(saleGroups)]);

        for (const userId of allUserIds) {
            const qMax = extractMax(quoteGroups[userId] || []);
            const iMax = extractMax(invoiceGroups[userId] || []);
            const msMax = extractMax(saleGroups[userId] || []);

            console.log(`👤 User ${userId}: Q:${qMax}, I:${iMax}, MS:${msMax}`);
            
            await User.findByIdAndUpdate(userId, {
                quotationCounter: qMax,
                invoiceCounter: iMax,
                materialSaleCounter: msMax
            });
        }

        console.log('✅ Counter sync completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('💥 Sync failed:', error);
        process.exit(1);
    }
}

syncCounters();
