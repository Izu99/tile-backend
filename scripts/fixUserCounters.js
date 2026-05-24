const mongoose = require('mongoose');
require('colors');

const MONGODB_URI = 'mongodb+srv://lms:lms123@cluster0.siobua7.mongodb.net/tile-management?retryWrites=true&w=majority&appName=Cluster0';

async function fixCounters() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected'.green);

        const User = require('../models/User');
        const QuotationDocument = require('../models/QuotationDocument');

        const user = await User.findOne({ email: 'hkasangasrinath@gmail.com' });
        
        if (!user) {
            console.log('❌ User not found');
            return;
        }

        console.log(`\n📧 Processing: ${user.email}`.cyan.bold);

        // Get actual max quotation number
        const maxQuotation = await QuotationDocument.findOne({
            user: user._id,
            type: 'quotation'
        })
            .select('documentNumber')
            .sort({ documentNumber: -1 })
            .lean();

        // Get actual max invoice number
        const maxInvoice = await QuotationDocument.findOne({
            user: user._id,
            type: 'invoice'
        })
            .select('documentNumber')
            .sort({ documentNumber: -1 })
            .lean();

        const maxQuoNum = maxQuotation ? parseInt(maxQuotation.documentNumber) : 0;
        const maxInvNum = maxInvoice ? parseInt(maxInvoice.documentNumber) : 0;

        console.log(`\n📊 Current Database State:`);
        console.log(`   Highest quotation: QUO-${maxQuoNum}`);
        console.log(`   Highest invoice: INV-${maxInvNum}`);
        console.log(`\n⚙️  Current Counters:`);
        console.log(`   quotationCounter: ${user.quotationCounter}`);
        console.log(`   invoiceCounter: ${user.invoiceCounter}`);

        // Fix if needed
        const updateData = {};
        const needsQuoFix = user.quotationCounter !== maxQuoNum;
        const needsInvFix = user.invoiceCounter !== maxInvNum;

        if (needsQuoFix) {
            console.log(`\n⚠️  Quotation counter is WRONG! Should be ${maxQuoNum}, is ${user.quotationCounter}`.yellow.bold);
            updateData.quotationCounter = maxQuoNum;
        } else {
            console.log(`\n✅ Quotation counter is correct: ${maxQuoNum}`.green);
        }

        if (needsInvFix) {
            console.log(`⚠️  Invoice counter is WRONG! Should be ${maxInvNum}, is ${user.invoiceCounter}`.yellow.bold);
            updateData.invoiceCounter = maxInvNum;
        } else {
            console.log(`✅ Invoice counter is correct: ${maxInvNum}`.green);
        }

        if (needsQuoFix || needsInvFix) {
            console.log(`\n🔧 Applying fixes...`.cyan);
            const updated = await User.findByIdAndUpdate(
                user._id,
                updateData,
                { new: true }
            );
            console.log(`✅ Counters fixed!`.green.bold);
            console.log(`   quotationCounter: ${user.quotationCounter} → ${updated.quotationCounter}`);
            console.log(`   invoiceCounter: ${user.invoiceCounter} → ${updated.invoiceCounter}`);
            console.log(`\n✨ Next quotation will be: QUO-${updated.quotationCounter + 1}`.green.bold);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

fixCounters();
