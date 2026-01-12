require('dotenv').config({ path: './server/.env' });
require('colors');
const connectDB = require('./config/database');
const QuotationDocument = require('./models/QuotationDocument');

async function printQuotations() {
    try {
        await connectDB();

        const quotations = await QuotationDocument.find({}).populate('user', 'name email').sort({ createdAt: -1 });

        console.log('\n=== QUOTATION DATA FROM DATABASE ===');
        console.log(`Total quotations found: ${quotations.length}\n`);

        if (quotations.length === 0) {
            console.log('No quotations found in the database.');
        } else {
            quotations.forEach((quotation, index) => {
                console.log(`${index + 1}. Document Number: ${quotation.documentNumber}`);
                console.log(`   Type: ${quotation.type}`);
                console.log(`   Status: ${quotation.status}`);
                console.log(`   Customer: ${quotation.customerName}`);
                console.log(`   Phone: ${quotation.customerPhone || 'N/A'}`);
                console.log(`   Address: ${quotation.customerAddress || 'N/A'}`);
                console.log(`   Project Title: ${quotation.projectTitle || 'N/A'}`);
                console.log(`   Invoice Date: ${quotation.invoiceDate}`);
                console.log(`   Due Date: ${quotation.dueDate}`);
                console.log(`   Subtotal: Rs ${quotation.subtotal?.toFixed(2) || '0.00'}`);
                console.log(`   Total Payments: Rs ${quotation.totalPayments?.toFixed(2) || '0.00'}`);
                console.log(`   Amount Due: Rs ${quotation.amountDue?.toFixed(2) || '0.00'}`);
                console.log(`   Total Direct Costs: Rs ${quotation.totalDirectCosts?.toFixed(2) || '0.00'}`);
                console.log(`   Net Profit: Rs ${quotation.netProfit?.toFixed(2) || '0.00'}`);
                console.log(`   Profit Margin: ${quotation.profitMargin?.toFixed(2) || '0.00'}%`);
                console.log(`   Project Status: ${quotation.projectStatus}`);
                console.log(`   User: ${quotation.user?.name || 'N/A'} (${quotation.user?.email || 'N/A'})`);
                console.log(`   Created: ${quotation.createdAt}`);
                console.log(`   Updated: ${quotation.updatedAt}`);
                console.log(`   Line Items: ${quotation.lineItems?.length || 0}`);
                if (quotation.lineItems && quotation.lineItems.length > 0) {
                    quotation.lineItems.forEach((item, i) => {
                        console.log(`     ${i+1}. ${item.item.name} (${item.quantity} ${item.item.unit}) @ Rs ${item.item.sellingPrice} = Rs ${(item.quantity * item.item.sellingPrice).toFixed(2)}`);
                    });
                }
                console.log(`   Payment History: ${quotation.paymentHistory?.length || 0}`);
                if (quotation.paymentHistory && quotation.paymentHistory.length > 0) {
                    quotation.paymentHistory.forEach((payment, i) => {
                        console.log(`     ${i+1}. Rs ${payment.amount.toFixed(2)} on ${payment.date} - ${payment.description || 'No description'}`);
                    });
                }
                console.log(`   Direct Costs: ${quotation.directCosts?.length || 0}`);
                if (quotation.directCosts && quotation.directCosts.length > 0) {
                    quotation.directCosts.forEach((cost, i) => {
                        console.log(`     ${i+1}. ${cost.category}: Rs ${cost.amount.toFixed(2)} - ${cost.description}`);
                    });
                }
                console.log('   ---');
            });
        }

        console.log('=== END QUOTATION DATA ===\n');

    } catch (error) {
        console.error('Error connecting to database. Please ensure MongoDB is running.');
        console.log('\n=== QUOTATION DATA FROM DATABASE ===');
        console.log('Total quotations found: 0');
        console.log('No quotations found in the database (database not connected).');
        console.log('=== END QUOTATION DATA ===\n');
    } finally {
        process.exit(0);
    }
}

printQuotations();
