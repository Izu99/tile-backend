require('dotenv').config();
const mongoose = require('mongoose');

async function createMissingInvoiceJobCosts() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const JobCost = require('../models/JobCost');
    const QuotationDocument = require('../models/QuotationDocument');
    
    // Find all invoices
    const invoices = await QuotationDocument.find({
        type: 'invoice',
        status: { $in: ['approved', 'paid', 'partial', 'converted', 'invoiced'] }
    }).lean();
    
    console.log(`Found ${invoices.length} invoices to process`);
    
    let created = 0;
    let skipped = 0;
    
    for (const inv of invoices) {
        // Check if job cost already exists for this invoice
        const existing = await JobCost.findOne({
            $or: [
                { invoiceId: `INV-${inv.documentNumber}`, user: inv.user },
                { documentId: inv.documentNumber, user: inv.user, type: 'invoice' }
            ]
        });
        
        if (existing) {
            skipped++;
            continue;
        }
        
        try {
            const jobCostData = {
                documentId: inv.documentNumber,
                type: 'invoice',
                quotationId: null,
                invoiceId: `INV-${inv.documentNumber}`,
                customerName: inv.customerName,
                customerPhone: inv.customerPhone || '',
                projectTitle: inv.projectTitle || '',
                invoiceDate: inv.invoiceDate,
                customerInvoiceStatus: inv.status,
                invoiceItems: (inv.lineItems || []).map(item => ({
                    category: (item.item && item.item.category) || 'General',
                    name: (item.item && item.item.name) || item.displayName || 'Unknown Item',
                    quantity: item.quantity || 0,
                    unit: (item.item && item.item.unit) || '',
                    costPrice: (item.item && item.item.costPrice) || 0,
                    sellingPrice: (item.item && item.item.sellingPrice) || 0,
                })),
                purchaseOrderItems: [],
                otherExpenses: [],
                completed: inv.status === 'paid',
                user: inv.user,
            };
            
            await JobCost.create(jobCostData);
            console.log(`Created job cost for INV-${inv.documentNumber} (${inv.status}) - ${inv.customerName}`);
            created++;
        } catch (e) {
            console.log(`Failed INV-${inv.documentNumber}: ${e.message}`);
        }
    }
    
    console.log(`\nDone! Created: ${created}, Skipped (already exists): ${skipped}`);
    await mongoose.disconnect();
}

createMissingInvoiceJobCosts().catch(console.error);
