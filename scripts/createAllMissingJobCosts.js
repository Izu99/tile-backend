require('dotenv').config();
const mongoose = require('mongoose');

async function createAllMissingJobCosts() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const JobCost = require('../models/JobCost');
    const QuotationDocument = require('../models/QuotationDocument');
    
    // Get ALL quotations and invoices that should have job costs
    const allDocs = await QuotationDocument.find({
        $or: [
            { type: 'quotation', status: 'approved' },
            { type: 'invoice', status: { $in: ['paid', 'partial', 'converted', 'invoiced', 'approved'] } }
        ]
    }).lean();
    
    console.log(`Found ${allDocs.length} documents to check`);
    
    let created = 0, skipped = 0, failed = 0;
    
    for (const doc of allDocs) {
        try {
            const isInvoice = doc.type === 'invoice';
            const docId = doc.documentNumber;
            const displayId = isInvoice ? `INV-${docId}` : `QUO-${docId}`;
            
            // Check if job cost exists
            const query = isInvoice
                ? { $or: [{ invoiceId: displayId }, { documentId: docId, type: 'invoice' }], user: doc.user }
                : { $or: [{ quotationId: displayId }, { documentId: docId, type: 'quotation' }], user: doc.user };
            
            const existing = await JobCost.findOne(query);
            if (existing) { skipped++; continue; }
            
            // Create job cost
            const jobCostData = {
                documentId: docId,
                type: doc.type,
                quotationId: isInvoice ? null : displayId,
                invoiceId: isInvoice ? displayId : null,
                customerName: doc.customerName,
                customerPhone: doc.customerPhone || '',
                projectTitle: doc.projectTitle || doc.customerName,
                invoiceDate: doc.invoiceDate,
                customerInvoiceStatus: doc.status,
                invoiceItems: (doc.lineItems || []).map(item => ({
                    category: (item.item?.category) || 'General',
                    name: (item.item?.name) || item.displayName || 'Unknown',
                    quantity: item.quantity || 0,
                    unit: (item.item?.unit) || '',
                    costPrice: (item.item?.costPrice) || 0,
                    sellingPrice: (item.item?.sellingPrice) || 0,
                })),
                purchaseOrderItems: [],
                otherExpenses: [],
                completed: doc.status === 'paid',
                user: doc.user,
            };
            
            await JobCost.create(jobCostData);
            console.log(`✅ Created: ${displayId} (${doc.status}) - ${doc.customerName}`);
            created++;
        } catch (e) {
            console.log(`❌ Failed: ${doc.documentNumber} - ${e.message}`);
            failed++;
        }
    }
    
    console.log(`\nDone! Created: ${created}, Skipped: ${skipped}, Failed: ${failed}`);
    await mongoose.disconnect();
}

createAllMissingJobCosts().catch(console.error);
