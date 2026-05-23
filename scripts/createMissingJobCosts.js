const mongoose = require('mongoose');
require('dotenv').config();

async function createMissingJobCosts() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const JobCost = require('../models/JobCost');
    const QuotationDocument = require('../models/QuotationDocument');
    
    // Find all approved/paid/partial/converted quotations
    const quotations = await QuotationDocument.find({
        type: 'quotation',
        status: { $in: ['approved', 'paid', 'partial', 'converted', 'invoiced'] }
    });
    
    console.log(`Found ${quotations.length} quotations to process`);
    
    let created = 0;
    let skipped = 0;
    
    for (const doc of quotations) {
        // Check if job cost already exists
        const existing = await JobCost.findOne({
            quotationId: `QUO-${doc.documentNumber}`,
            user: doc.user
        });
        
        if (existing) {
            skipped++;
            continue;
        }
        
        // Create job cost
        try {
            const numericId = doc.documentNumber.replace('QUO-', '');
            const jobCostData = {
                documentId: numericId,
                type: 'quotation',
                quotationId: `QUO-${doc.documentNumber}`,
                invoiceId: null,
                customerName: doc.customerName,
                customerPhone: doc.customerPhone || '',
                projectTitle: doc.projectTitle,
                invoiceDate: doc.invoiceDate,
                customerInvoiceStatus: doc.status,
                invoiceItems: (doc.lineItems || []).map(item => ({
                    category: (item.item && item.item.category) || 'General',
                    name: (item.item && item.item.name) || item.displayName || 'Unknown Item',
                    quantity: item.quantity || 0,
                    unit: (item.item && item.item.unit) || '',
                    costPrice: (item.item && item.item.costPrice) || 0,
                    sellingPrice: (item.item && item.item.sellingPrice) || 0,
                })),
                purchaseOrderItems: [],
                otherExpenses: [],
                completed: doc.status === 'paid',
                user: doc.user,
            };
            
            await JobCost.findOneAndUpdate(
                { documentId: numericId, user: doc.user },
                jobCostData,
                { upsert: true, new: true, runValidators: false }
            );
            
            console.log(`Created job cost for QUO-${doc.documentNumber} (${doc.status}) - ${doc.customerName}`);
            created++;
        } catch (e) {
            console.log(`Failed QUO-${doc.documentNumber}: ${e.message}`);
        }
    }
    
    console.log(`\nDone! Created: ${created}, Skipped (already exists): ${skipped}`);
    await mongoose.disconnect();
}

createMissingJobCosts().catch(console.error);
