const mongoose = require('mongoose');
require('colors');

const MONGODB_URI = 'mongodb+srv://lms:lms123@cluster0.siobua7.mongodb.net/tile-management?retryWrites=true&w=majority&appName=Cluster0';

async function findMaxValid() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);

        const QuotationDocument = require('../models/QuotationDocument');
        const User = require('../models/User');

        const user = await User.findOne({ email: 'hkasangasrinath@gmail.com' });

        // Find all quotations for this user, sorted by documentNumber
        const allQuos = await QuotationDocument.find({
            user: user._id,
            type: 'quotation'
        })
            .select('_id documentNumber status')
            .sort({ documentNumber: -1 })
            .limit(10)
            .lean();

        console.log('\n📋 Latest 10 quotations:'.cyan.bold);
        allQuos.forEach((q, i) => {
            const docNum = q.documentNumber ? `QUO-${q.documentNumber}` : '(undefined)';
            console.log(`   ${i + 1}. ${docNum} [${q.status}]`);
        });

        // Find highest valid (non-undefined) documentNumber
        const validQuos = await QuotationDocument.find({
            user: user._id,
            type: 'quotation',
            documentNumber: { $exists: true, $ne: null, $ne: '' }
        })
            .select('documentNumber')
            .sort({ documentNumber: -1 })
            .limit(1)
            .lean();

        if (validQuos.length > 0) {
            const maxNum = parseInt(validQuos[0].documentNumber);
            console.log(`\n✅ Highest valid quotation: QUO-${maxNum}`.green.bold);
            
            // Now fix the counter
            console.log(`\n🔧 Fixing counters...`);
            const updated = await User.findByIdAndUpdate(
                user._id,
                {
                    quotationCounter: maxNum,
                    invoiceCounter: 348
                },
                { new: true }
            );
            console.log(`✅ Fixed!`.green.bold);
            console.log(`   quotationCounter: 209 → ${updated.quotationCounter}`);
            console.log(`   invoiceCounter: 190 → ${updated.invoiceCounter}`);
            console.log(`\n✨ Next quotation will be: QUO-${updated.quotationCounter + 1}`.green.bold);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

findMaxValid();
