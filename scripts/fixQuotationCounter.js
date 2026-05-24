const mongoose = require('mongoose');
require('colors');

const MONGODB_URI = 'mongodb+srv://lms:lms123@cluster0.siobua7.mongodb.net/tile-management?retryWrites=true&w=majority&appName=Cluster0';

async function fixQuotationCounter() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected'.green);

        const User = require('../models/User');
        const QuotationDocument = require('../models/QuotationDocument');

        // Get all users
        const users = await User.find().select('_id email quotationCounter invoiceCounter');
        console.log(`\n📊 Found ${users.length} users`.cyan);

        for (const user of users) {
            console.log(`\n🔍 Processing user: ${user.email} (${user._id})`);

            // Find max quotation documentNumber for this user
            const maxQuotation = await QuotationDocument.findOne({
                user: user._id,
                type: 'quotation'
            })
                .select('documentNumber')
                .sort({ documentNumber: -1 })
                .lean();

            // Find max invoice documentNumber for this user
            const maxInvoice = await QuotationDocument.findOne({
                user: user._id,
                type: 'invoice'
            })
                .select('documentNumber')
                .sort({ documentNumber: -1 })
                .lean();

            const maxQuoNumber = maxQuotation ? parseInt(maxQuotation.documentNumber) : 0;
            const maxInvNumber = maxInvoice ? parseInt(maxInvoice.documentNumber) : 0;

            console.log(`   Current quotationCounter: ${user.quotationCounter}`);
            console.log(`   Max quotation documentNumber: ${maxQuoNumber}`);
            console.log(`   Current invoiceCounter: ${user.invoiceCounter}`);
            console.log(`   Max invoice documentNumber: ${maxInvNumber || '(no invoices)'}`);

            // Check if counter needs fixing
            if (user.quotationCounter !== maxQuoNumber) {
                console.log(`   ⚠️ Quotation counter mismatch! Should be ${maxQuoNumber}`.yellow);
                await User.findByIdAndUpdate(
                    user._id,
                    { quotationCounter: maxQuoNumber },
                    { new: true }
                );
                console.log(`   ✅ Fixed quotationCounter to ${maxQuoNumber}`.green);
            }

            if (maxInvNumber > 0 && user.invoiceCounter !== maxInvNumber) {
                console.log(`   ⚠️ Invoice counter mismatch! Should be ${maxInvNumber}`.yellow);
                await User.findByIdAndUpdate(
                    user._id,
                    { invoiceCounter: maxInvNumber },
                    { new: true }
                );
                console.log(`   ✅ Fixed invoiceCounter to ${maxInvNumber}`.green);
            }

            if (maxInvNumber === 0 && user.invoiceCounter !== 0) {
                console.log(`   ⚠️ Invoice counter should be 0 (no invoices exist)`.yellow);
                await User.findByIdAndUpdate(
                    user._id,
                    { invoiceCounter: 0 },
                    { new: true }
                );
                console.log(`   ✅ Fixed invoiceCounter to 0`.green);
            }

            if (user.quotationCounter === maxQuoNumber && (maxInvNumber === 0 || user.invoiceCounter === maxInvNumber)) {
                console.log('   ✅ Counters are correct'.green);
            }
        }

        console.log('\n✅ Counter fix complete!'.green);
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixQuotationCounter();
