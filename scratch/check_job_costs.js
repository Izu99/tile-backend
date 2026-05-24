const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://lms:lms123@cluster0.siobua7.mongodb.net/tile-management?retryWrites=true&w=majority&appName=Cluster0';

async function checkJobCosts() {
    try {
        console.log('Connecting to DB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        // Simple schemas for Quotation and JobCost to avoid full app initialization overhead
        const Quotation = mongoose.model('QuotationDocument', new mongoose.Schema({
            documentNumber: String,
            status: String,
            customerName: String,
            user: mongoose.Schema.Types.ObjectId
        }, { collection: 'quotationdocuments' }));

        const JobCost = mongoose.model('JobCost', new mongoose.Schema({
            quotationId: String,
            type: String,
            user: mongoose.Schema.Types.ObjectId
        }, { collection: 'jobcosts' }));

        // Only approved quotations should guarantee job cost creation
        console.log('Fetching quotations with status approved...');
        const approvedQuotations = await Quotation.find({ status: 'approved', type: 'quotation' }).lean();
        
        console.log(`Found ${approvedQuotations.length} approved quotations.`);

        let missingCount = 0;
        let missingList = [];

        for (const quo of approvedQuotations) {
            // Check if job cost exists for the actual stored quotationId format
            const jobCost = await JobCost.findOne({ 
                quotationId: `QUO-${quo.documentNumber}`,
                type: 'quotation',
                user: quo.user
            }).lean();

            if (!jobCost) {
                missingCount++;
                missingList.push({
                    documentNumber: quo.documentNumber,
                    customer: quo.customerName,
                    status: quo.status,
                    userId: quo.user
                });
            }
        }

        if (missingCount === 0) {
            console.log('\n✅ ALL approved quotations have corresponding Job Costs!');
        } else {
            console.log(`\n❌ Found ${missingCount} approved quotations WITHOUT Job Costs:`);
            console.table(missingList);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

checkJobCosts();
