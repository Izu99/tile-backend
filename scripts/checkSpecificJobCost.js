require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const JobCost = require('../models/JobCost');
    const QuotationDocument = require('../models/QuotationDocument');
    
    // Check QUO-081
    const jc = await JobCost.findOne({ quotationId: 'QUO-081' }).lean();
    console.log('JobCost QUO-081:');
    console.log('  invoiceDate:', jc?.invoiceDate);
    console.log('  type:', jc?.type);
    console.log('  customerInvoiceStatus:', jc?.customerInvoiceStatus);
    
    const q = await QuotationDocument.findOne({ documentNumber: '081', type: 'quotation' }).lean();
    console.log('\nQuotation QUO-081:');
    console.log('  invoiceDate:', q?.invoiceDate);
    console.log('  status:', q?.status);
    console.log('  createdAt:', q?.createdAt);
    
    await mongoose.disconnect();
}
check().catch(console.error);
