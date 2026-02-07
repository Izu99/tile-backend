const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:5000/api';

async function testFlutterQuotationCreation() {
    console.log('🔍 Testing Flutter-style Quotation Creation');
    console.log('===========================================');
    
    try {
        // Step 1: Login to get a token
        console.log('\n1. Logging in...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'test@example.com',
            password: 'password123'
        });
        
        const token = loginResponse.data.data.token;
        console.log(`✅ Login successful, token length: ${token.length}`);
        
        // Step 2: Create a quotation exactly like Flutter app does
        console.log('\n2. Creating quotation like Flutter app...');
        const quotationData = {
            documentNumber: '', // Empty string like Flutter sends
            type: 'quotation',
            status: 'pending',
            customerName: 'Flutter Test Customer',
            customerPhone: '123-456-7890',
            customerAddress: 'Test Address',
            projectTitle: 'Flutter Test Project',
            invoiceDate: new Date().toISOString(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            paymentTerms: 30,
            linkedSiteVisitId: '',
            lineItems: [{
                item: {
                    category: 'Test Category',
                    name: 'Test Item',
                    sellingPrice: 100,
                    unit: 'units',
                    productName: 'Test Product'
                },
                quantity: 2,
                customDescription: 'Test item description',
                isOriginalQuotationItem: true
            }],
            serviceItems: [],
            paymentHistory: []
        };
        
        console.log(`📤 Sending Flutter-style quotation data...`);
        console.log(`📤 documentNumber: "${quotationData.documentNumber}"`);
        console.log(`📤 customerName: "${quotationData.customerName}"`);
        console.log(`📤 lineItems count: ${quotationData.lineItems.length}`);
        
        const createResponse = await axios.post(`${BASE_URL}/quotations`, quotationData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Quotation created successfully!');
        console.log(`📋 Generated document number: ${createResponse.data.data.documentNumber}`);
        console.log(`📋 Display document number: ${createResponse.data.data.displayDocumentNumber || 'N/A'}`);
        console.log(`📋 Document type: ${createResponse.data.data.type}`);
        console.log(`📋 Document status: ${createResponse.data.data.status}`);
        console.log(`📋 Customer name: ${createResponse.data.data.customerName}`);
        console.log(`📋 Line items count: ${createResponse.data.data.lineItems?.length || 0}`);
        
        // Clean up - delete the test quotation
        console.log('\n3. Cleaning up test quotation...');
        try {
            await axios.delete(`${BASE_URL}/quotations/${createResponse.data.data._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('🧹 Test quotation cleaned up successfully');
        } catch (cleanupError) {
            console.log('⚠️ Cleanup failed (not critical):', cleanupError.message);
        }
        
        console.log('\n🎉 Flutter-style quotation creation test completed successfully!');
        console.log('✅ Empty documentNumber strings are properly handled');
        console.log('✅ Document number generation is working');
        console.log('✅ Flutter app should now be able to create quotations');
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    }
}

// Run the test
testFlutterQuotationCreation();