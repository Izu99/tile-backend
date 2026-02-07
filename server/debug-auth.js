const jwt = require('jsonwebtoken');

// Debug script to test JWT verification
const testToken = process.argv[2];
const jwtSecret = process.env.JWT_SECRET || 'TileWork_2024_SuperSecure_JWT_Key_With_High_Entropy_9x7K2mP8qL5nR3vW6yB1cF4gH8jM';

if (!testToken) {
    console.log('Usage: node debug-auth.js <token>');
    process.exit(1);
}

console.log('🔍 JWT Debug Tool');
console.log('================');
console.log(`Token: ${testToken.substring(0, 50)}...`);
console.log(`Token Length: ${testToken.length}`);
console.log(`JWT Secret: ${jwtSecret.substring(0, 20)}...`);

try {
    // Check token structure
    const parts = testToken.split('.');
    console.log(`\n📊 Token Structure:`);
    console.log(`Parts: ${parts.length}`);
    
    if (parts.length === 3) {
        console.log(`Header Length: ${parts[0].length}`);
        console.log(`Payload Length: ${parts[1].length}`);
        console.log(`Signature Length: ${parts[2].length}`);
        
        // Try to decode without verification
        try {
            const decoded = jwt.decode(testToken, { complete: true });
            console.log(`\n📋 Decoded Header:`, decoded.header);
            console.log(`📋 Decoded Payload:`, decoded.payload);
        } catch (e) {
            console.log(`❌ Failed to decode token: ${e.message}`);
        }
        
        // Try to verify
        try {
            const verified = jwt.verify(testToken, jwtSecret);
            console.log(`\n✅ Token Verification: SUCCESS`);
            console.log(`📋 Verified Payload:`, verified);
        } catch (e) {
            console.log(`\n❌ Token Verification: FAILED`);
            console.log(`Error: ${e.message}`);
            
            if (e.message.includes('expired')) {
                console.log('🚨 Token has expired');
            } else if (e.message.includes('signature')) {
                console.log('🚨 Invalid signature - JWT_SECRET mismatch');
            } else if (e.message.includes('malformed')) {
                console.log('🚨 Malformed token');
            }
        }
    } else {
        console.log('❌ Invalid JWT structure');
    }
    
} catch (e) {
    console.log(`❌ General error: ${e.message}`);
}