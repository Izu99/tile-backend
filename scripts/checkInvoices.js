require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const QuotationDocument = require('../models/QuotationDocument');
    const JobCost = require('../models/JobCost');
    
    // Check invoice type documents
    const invoices = await QuotationDocument.find({
        type: 'invoice',
        status: { $in: ['approved', 'paid', 'partial', 'converted', 'invoiced'] }
    }).limit(5).lean();
    
    console.log('Sample invoices:');
    invoices.forEach(q => {
        console.log('  documentNumber:', q.documentNumber, '| status:', q.status, '| customer:', q.customerName);
    });
    
    const totalInvoices = await QuotationDocument.countDocuments({
        type: 'invoice',
        status: { $in: ['approved', 'paid', 'partial', 'converted', 'invoiced'] }
    });
    
    // Count all documents by type and status
    const allTypes = await QuotationDocument.aggregate([
        { $group: { _id: { type: '$type', status: '$status' }, count: { $sum: 1 } } },
        { $sort: { '_id.type': 1, '_id.status': 1 } }
    ]);
    
    console.log('\nAll documents by type & status:');
    allTypes.forEach(t => {
        console.log(`  ${t._id.type} | ${t._id.status}: ${t.count}`);
    });
    
    // Find invoices WITHOUT matching job costs
    const allInvoices = await QuotationDocument.find({
        type: 'invoice',
        status: { $in: ['approved', 'paid', 'partial', 'converted', 'invoiced'] }
    }).lean();
    
    let missingCount = 0;
    for (const inv of allInvoices) {
        const jc = await JobCost.findOne({
            $or: [
                { invoiceId: `INV-${inv.documentNumber}` },
                { invoiceId: inv.documentNumber },
                { documentId: inv.documentNumber }
            ],
            user: inv.user
        });
        if (!jc) {
            missingCount++;
            if (missingCount <= 10) {
                console.log(`  MISSING job cost for INV-${inv.documentNumber} | ${inv.status} | ${inv.customerName}`);
            }
        }
    }
    
    console.log(`\nTotal invoices: ${totalInvoices}`);
    console.log(`Missing job costs for invoices: ${missingCount}`);
    
    await mongoose.disconnect();
}
check().catch(console.error);
