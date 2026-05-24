const mongoose = require('mongoose');
require('dotenv').config();

async function fixJobCostStatuses() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const JobCost = require('../models/JobCost');
    const QuotationDocument = require('../models/QuotationDocument');
    
    // Get all job costs linked to a quotation and sync them with the current document status
    const jobCosts = await JobCost.find({ 
        quotationId: { $exists: true, $ne: null, $ne: '' }
    });
    
    console.log(`Found ${jobCosts.length} quotation-linked job costs`);
    
    let updated = 0;
    for (const jc of jobCosts) {
        // Find matching quotation by documentNumber
        const docNumber = jc.quotationId.replace('QUO-', '');
        const quotation = await QuotationDocument.findOne({ 
            documentNumber: docNumber,
            user: jc.user
        });
        
        if (quotation) {
            const update = {
                customerInvoiceStatus: quotation.status,
                completed: quotation.status === 'paid'
            };

            if (quotation.type === 'invoice') {
                update.type = 'invoice';
                update.invoiceId = `INV-${quotation.documentNumber}`;
                update.invoiceDate = quotation.invoiceDate;
            } else {
                update.type = 'quotation';
                update.invoiceId = null;
            }

            await JobCost.updateOne(
                { _id: jc._id },
                { $set: update }
            );
            console.log(`Synced ${jc.quotationId}: ${jc.customerInvoiceStatus} -> ${quotation.status}`);
            updated++;
        } else {
            console.log(`No quotation found for ${jc.quotationId}`);
        }
    }
    
    console.log(`\nDone! Updated ${updated} job costs`);
    await mongoose.disconnect();
}

fixJobCostStatuses().catch(console.error);
