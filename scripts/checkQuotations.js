require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const QuotationDocument = require('../models/QuotationDocument');
    const JobCost = require('../models/JobCost');
    
    const quotations = await QuotationDocument.find({
        type: 'quotation',
        status: { $in: ['approved', 'paid', 'partial', 'converted', 'invoiced'] }
    }).limit(5).lean();
    
    console.log('Sample quotations:');
    quotations.forEach(q => {
        console.log('  documentNumber:', q.documentNumber, '| status:', q.status, '| customer:', q.customerName);
    });
    
    const totalQ = await QuotationDocument.countDocuments({
        type: 'quotation',
        status: { $in: ['approved', 'paid', 'partial', 'converted', 'invoiced'] }
    });
    const totalJC = await JobCost.countDocuments({});
    
    // Find quotations WITHOUT matching job costs
    const allQuotations = await QuotationDocument.find({
        type: 'quotation',
        status: { $in: ['approved', 'paid', 'partial', 'converted', 'invoiced'] }
    }).lean();
    
    let missingCount = 0;
    for (const q of allQuotations) {
        const jc = await JobCost.findOne({
            $or: [
                { quotationId: `QUO-${q.documentNumber}` },
                { quotationId: q.documentNumber },
                { documentId: q.documentNumber }
            ],
            user: q.user
        });
        if (!jc) {
            missingCount++;
            if (missingCount <= 5) {
                console.log('  MISSING job cost for:', q.documentNumber, '| status:', q.status, '| customer:', q.customerName);
            }
        }
    }
    
    console.log('\nTotal matching quotations:', totalQ);
    console.log('Total job costs:', totalJC);
    console.log('Missing job costs:', missingCount);
    
    await mongoose.disconnect();
}
check().catch(console.error);
