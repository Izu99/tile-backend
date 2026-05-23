require('dotenv').config();
const mongoose = require('mongoose');

async function fixJobCostDates() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const JobCost = require('../models/JobCost');
    const QuotationDocument = require('../models/QuotationDocument');
    
    // Fix invoice type job costs - update date from actual invoice
    const invoiceJobCosts = await JobCost.find({ type: 'invoice', invoiceId: { $exists: true, $ne: null } });
    console.log(`Found ${invoiceJobCosts.length} invoice job costs to check`);
    
    let updated = 0;
    for (const jc of invoiceJobCosts) {
        const docNumber = jc.invoiceId.replace('INV-', '');
        const invoice = await QuotationDocument.findOne({
            documentNumber: docNumber,
            type: 'invoice',
            user: jc.user
        });
        
        if (invoice && invoice.invoiceDate) {
            const jcDate = new Date(jc.invoiceDate).toDateString();
            const invDate = new Date(invoice.invoiceDate).toDateString();
            
            if (jcDate !== invDate) {
                await JobCost.updateOne(
                    { _id: jc._id },
                    { $set: { invoiceDate: invoice.invoiceDate } }
                );
                console.log(`Updated ${jc.invoiceId}: ${jcDate} -> ${invDate}`);
                updated++;
            }
        }
    }
    
    // Fix quotation type job costs - update date from actual quotation
    const quotationJobCosts = await JobCost.find({ type: 'quotation', quotationId: { $exists: true, $ne: null } });
    console.log(`Found ${quotationJobCosts.length} quotation job costs to check`);
    
    for (const jc of quotationJobCosts) {
        const docNumber = jc.quotationId.replace('QUO-', '');
        const quotation = await QuotationDocument.findOne({
            documentNumber: docNumber,
            type: 'quotation',
            user: jc.user
        });
        
        if (quotation && quotation.invoiceDate) {
            const jcDate = new Date(jc.invoiceDate).toDateString();
            const qDate = new Date(quotation.invoiceDate).toDateString();
            
            if (jcDate !== qDate) {
                await JobCost.updateOne(
                    { _id: jc._id },
                    { $set: { invoiceDate: quotation.invoiceDate } }
                );
                console.log(`Updated ${jc.quotationId}: ${jcDate} -> ${qDate}`);
                updated++;
            }
        }
    }
    
    console.log(`\nDone! Updated ${updated} job cost dates`);
    await mongoose.disconnect();
}

fixJobCostDates().catch(console.error);
