require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const QuotationDocument = require('../models/QuotationDocument');
    const JobCost = require('../models/JobCost');
    
    // Find a recent approved quotation
    const approvedQ = await QuotationDocument.findOne({
        type: 'quotation',
        status: 'approved'
    }).sort({ createdAt: -1 }).lean();
    
    if (!approvedQ) {
        console.log('No approved quotations found');
        await mongoose.disconnect();
        return;
    }
    
    console.log(`\nLatest approved quotation: QUO-${approvedQ.documentNumber}`);
    console.log(`Customer: ${approvedQ.customerName}`);
    console.log(`Status: ${approvedQ.status}`);
    
    // Check if job cost exists
    const jc = await JobCost.findOne({
        quotationId: `QUO-${approvedQ.documentNumber}`,
        user: approvedQ.user
    }).lean();
    
    if (jc) {
        console.log(`\n✅ Job cost EXISTS: ${jc._id}`);
        console.log(`   customerInvoiceStatus: ${jc.customerInvoiceStatus}`);
        console.log(`   type: ${jc.type}`);
    } else {
        console.log(`\n❌ Job cost MISSING for QUO-${approvedQ.documentNumber}`);
    }
    
    // Check post-save hook by simulating status change
    console.log('\n--- Testing syncJobCostDocument directly ---');
    
    // Find a pending quotation to test with
    const pendingQ = await QuotationDocument.findOne({
        type: 'quotation',
        status: 'pending'
    }).sort({ createdAt: -1 });
    
    if (pendingQ) {
        console.log(`\nFound pending quotation: QUO-${pendingQ.documentNumber}`);
        console.log('Simulating approve...');
        
        // Check if job cost exists before
        const beforeJC = await JobCost.findOne({
            quotationId: `QUO-${pendingQ.documentNumber}`,
            user: pendingQ.user
        });
        console.log(`Job cost before approve: ${beforeJC ? 'EXISTS' : 'MISSING'}`);
        
        // Approve it
        pendingQ.status = 'approved';
        await pendingQ.save();
        
        // Wait a moment for hooks
        await new Promise(r => setTimeout(r, 500));
        
        // Check if job cost was created
        const afterJC = await JobCost.findOne({
            quotationId: `QUO-${pendingQ.documentNumber}`,
            user: pendingQ.user
        });
        
        if (afterJC) {
            console.log(`✅ Job cost CREATED after approve: ${afterJC._id}`);
            console.log(`   customerInvoiceStatus: ${afterJC.customerInvoiceStatus}`);
        } else {
            console.log(`❌ Job cost NOT created after approve`);
        }
        
        // Revert back to pending
        pendingQ.status = 'pending';
        await pendingQ.save();
        console.log('Reverted back to pending');
        
        // Clean up test job cost if created
        if (afterJC && !beforeJC) {
            await JobCost.deleteOne({ _id: afterJC._id });
            console.log('Cleaned up test job cost');
        }
    } else {
        console.log('No pending quotations found to test with');
    }
    
    await mongoose.disconnect();
}

test().catch(console.error);
