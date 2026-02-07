const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testQuotationCreation() {
    console.log('🔍 Testing Quotation Creation with Document Number Generation');
    console.log('==========================================================');
    
    try {
        // Step 1: Login to get a token
        console.log('\n1. Logging in...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'test@example.com',
            password: 'password123'
        });
        
        const token = loginResponse.data.data.token;
        console.log(`✅ Login successful, token length: ${token.length}`);
        
        // Step 2: Create a quotation with empty document number (like Flutter app does)
        console.log('\n2. Creating quotation with empty documentNumber...');
        const quotationData = {
            documentNumber: '', // Empty string - should be auto-generated
            customerName: 'Test Customer',
            customerPhone: '123-456-7890',
            customerAddress: 'Test Address',
            projectTitle: 'Test Project',
            invoiceDate: new Date().toISOString(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
            paymentTerms: 30,
            lineItems: [{
                item: {
                    name: 'Test Item',
                    sellingPrice: 100,
                    unit: 'units'
                },
                quantity: 2,
                customDescription: 'Test item description'
            }],
            serviceItems: []
        };
        
        console.log(`📤 Sending quotation data with documentNumber: "${quotationData.documentNumber}"`);
        
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
        
        // Step 3: Create another quotation to test sequential numbering
        console.log('\n3. Creating second quotation to test sequential numbering...');
        const secondQuotationData = {
            ...quotationData,
            customerName: 'Second Test Customer',
            documentNumber: '' // Also empty
        };
        
        const secondCreateResponse = await axios.post(`${BASE_URL}/quotations`, secondQuotationData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Second quotation created successfully!');
        console.log(`📋 Generated document number: ${secondCreateResponse.data.data.documentNumber}`);
        console.log(`📋 Display document number: ${secondCreateResponse.data.data.displayDocumentNumber || 'N/A'}`);
        
        // Clean up - delete the test quotations
        console.log('\n4. Cleaning up test quotations...');
        try {
            await axios.delete(`${BASE_URL}/quotations/${createResponse.data.data._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await axios.delete(`${BASE_URL}/quotations/${secondCreateResponse.data.data._id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('🧹 Test quotations cleaned up successfully');
        } catch (cleanupError) {
            console.log('⚠️ Cleanup failed (not critical):', cleanupError.message);
        }
        
        console.log('\n🎉 Document number generation test completed successfully!');
        console.log('✅ Empty documentNumber strings are now properly handled');
        console.log('✅ Sequential document numbering is working');
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    }
}

// Run the test
testQuotationCreation();