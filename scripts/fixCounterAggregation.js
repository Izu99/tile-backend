const mongoose = require('mongoose');
require('colors');

const MONGODB_URI = 'mongodb+srv://lms:lms123@cluster0.siobua7.mongodb.net/tile-management?retryWrites=true&w=majority&appName=Cluster0';

async function checkData() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);

        const QuotationDocument = require('../models/QuotationDocument');
        const User = require('../models/User');

        const user = await User.findOne({ email: 'hkasangasrinath@gmail.com' });

        // Find the highest by using aggregation to ensure numeric sort
        const result = await QuotationDocument.aggregate([
            { $match: { user: user._id, type: 'quotation' } },
            {
                $addFields: {
                    docNumInt: {
                        $convert: {
                            input: '$documentNumber',
                            to: 'int',
                            onError: 0
                        }
                    }
                }
            },
            { $sort: { docNumInt: -1 } },
            { $limit: 10 },
            { $project: { documentNumber: 1, docNumInt: 1, status: 1 } }
        ]);

        console.log('\n📋 Top 10 quotations (numeric sort):'.cyan.bold);
        result.forEach((q, i) => {
            console.log(`   ${i + 1}. docNumber="${q.documentNumber}" (int=${q.docNumInt}) [${q.status}]`);
        });

        if (result.length > 0 && result[0].docNumInt > 0) {
            const maxNum = result[0].docNumInt;
            console.log(`\n✅ Highest quotation number: ${maxNum}`.green.bold);
            
            console.log(`\n🔧 Fixing counters...`);
            const updated = await User.findByIdAndUpdate(
                user._id,
                {
                    quotationCounter: maxNum,
                    invoiceCounter: 348
                },
                { new: true }
            );
            console.log(`✅ Counters fixed!`.green.bold);
            console.log(`   quotationCounter: 209 → ${updated.quotationCounter}`);
            console.log(`   invoiceCounter: 190 → ${updated.invoiceCounter}`);
            console.log(`\n✨ Next quotation will be: QUO-${updated.quotationCounter + 1}`.green.bold);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

checkData();
