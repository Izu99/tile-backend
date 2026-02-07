const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:5000/api';

async function testApprovalAndConversion() {
    console.log('🔍 Testing Quotation Approval and Conversion');
    console.log('============================================');
    
    try {
        // Step 1: Login to get a token
        console.log('\n1. Logging in...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: 'test@example.com',
            password: 'password123'
        });
        
        const token = loginResponse.data.data.token;
        console.log(`✅ Login successful, token length: ${token.length}`);
        
        // Step 2: Create a quotation
        console.log('\n2. Creating a test quotation...');
        const quotationData = {
            documentNumber: '',
            type: 'quotation',
            status: 'pending',
            customerName: 'Test Customer for Approval',
            customerPhone: '123-456-7890',
            customerAddress: 'Test Address',
            projectTitle: 'Test Project for Approval',
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
        
        const createResponse = await axios.post(`${BASE_URL}/quotations`, quotationData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const quotationId = createResponse.data.data._id;
        const documentNumber = createResponse.data.data.documentNumber;
        console.log(`✅ Quotation created: ${documentNumber} (ID: ${quotationId})`);
        console.log(`📋 Initial status: ${createResponse.data.data.status}`);
        
        // Step 3: Update quotation status to approved
        console.log('\n3. Approving the quotation...');
        const approvalData = {
            ...createResponse.data.data,
            status: 'approved'
        };
        
        const updateResponse = await axios.put(`${BASE_URL}/quotations/${quotationId}`, approvalData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`✅ Quotation approved successfully`);
        console.log(`📋 New status: ${updateResponse.data.data.status}`);
        console.log(`📋 Document number: ${updateResponse.data.data.documentNumber}`);
        
        // Step 4: Convert approved quotation to invoice
        console.log('\n4. Converting quotation to invoice...');
        const conversionData = {
            customDueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
            payments: []
        };
        
        const convertResponse = await axios.patch(`${BASE_URL}/quotations/${quotationId}/convert-to-invoice`, conversionData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`✅ Quotation converted to invoice successfully`);
        console.log(`📋 New type: ${convertResponse.data.data.type}`);
        console.log(`📋 New status: ${convertResponse.data.data.status}`);
        console.log(`📋 Document number: ${convertResponse.data.data.documentNumber}`);
        console.log(`📋 Display number: ${convertResponse.data.data.displayDocumentNumber || 'N/A'}`);
        
        // Step 5: Verify the conversion by fetching the document
        console.log('\n5. Verifying the converted document...');
        const fetchResponse = await axios.get(`${BASE_URL}/quotations/${quotationId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log(`✅ Document fetched successfully`);
        console.log(`📋 Final type: ${fetchResponse.data.data.type}`);
        console.log(`📋 Final status: ${fetchResponse.data.data.status}`);
        console.log(`📋 Final document number: ${fetchResponse.data.data.documentNumber}`);
        
        // Clean up - delete the test document
        console.log('\n6. Cleaning up test document...');
        try {
            await axios.delete(`${BASE_URL}/quotations/${quotationId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('🧹 Test document cleaned up successfully');
        } catch (cleanupError) {
            console.log('⚠️ Cleanup failed (not critical):', cleanupError.message);
        }
        
        console.log('\n🎉 Approval and conversion test completed successfully!');
        console.log('✅ Quotation approval is working');
        console.log('✅ Invoice conversion is working');
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

// Run the test
testApprovalAndConversion();