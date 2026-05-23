require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const JobCost = require('../models/JobCost');
    
    // Check what's actually in page 3 with partial filter
    const skip = 2 * 20; // page 3, limit 20
    const jobs = await JobCost.find({
        customerInvoiceStatus: 'partial'
    })
    .select('documentId quotationId invoiceId customerInvoiceStatus type customerName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(20)
    .lean();
    
    console.log(`Page 3 partial jobs (${jobs.length}):`);
    jobs.forEach(j => {
        console.log(`  ${j.quotationId || j.invoiceId} | type: ${j.type} | status: ${j.customerInvoiceStatus} | ${j.customerName}`);
    });
    
    // Check total
    const total = await JobCost.countDocuments({ customerInvoiceStatus: 'partial' });
    console.log(`\nTotal partial: ${total}`);
    
    // Check QUO-105, QUO-058, QUO-085, QUO-023
    const specific = await JobCost.find({
        quotationId: { $in: ['QUO-105', 'QUO-058', 'QUO-085', 'QUO-023'] }
    }).select('quotationId customerInvoiceStatus type').lean();
    
    console.log('\nSpecific records:');
    specific.forEach(j => console.log(`  ${j.quotationId} | ${j.type} | ${j.customerInvoiceStatus}`));
    
    await mongoose.disconnect();
}
check().catch(console.error);
