require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const JobCost = require('../models/JobCost');
    
    const jc = await JobCost.findOne({ quotationId: 'QUO-081' }).lean({ virtuals: true });
    console.log('Raw invoiceDate value:', jc?.invoiceDate);
    console.log('Type:', typeof jc?.invoiceDate);
    console.log('JSON.stringify:', JSON.stringify(jc?.invoiceDate));
    
    // Simulate what API sends
    const apiResponse = JSON.parse(JSON.stringify(jc));
    console.log('\nAPI response invoiceDate:', apiResponse?.invoiceDate);
    console.log('API response type:', typeof apiResponse?.invoiceDate);
    
    await mongoose.disconnect();
}
check().catch(console.error);
