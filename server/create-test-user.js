     const mongoose = require('mongoose');
require('dotenv').config();

// Connect to database
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('Database connection failed:', error);
        process.exit(1);
    }
};

const createTestUser = async () => {
    await connectDB();
    
    const User = require('./models/User');
    
    try {
        // Check if test user already exists
        const existingUser = await User.findOne({ email: 'test@example.com' });
        
        if (existingUser) {
            console.log('✅ Test user already exists');
            console.log(`   Email: ${existingUser.email}`);
            console.log(`   Name: ${existingUser.name}`);
            console.log(`   Company: ${existingUser.companyName}`);
            
            // Test login with this user (only if password field is available)
            if (existingUser.password) {
                const isMatch = await existingUser.matchPassword('password123');
                console.log(`   Password 'password123' matches: ${isMatch}`);
                
                if (!isMatch) {
                    console.log('🔄 Updating password to match test credentials...');
                    existingUser.password = 'password123';
                    await existingUser.save();
                    console.log('✅ Password updated successfully');
                }
            } else {
                console.log('🔄 Password field not available, updating...');
                existingUser.password = 'password123';
                await existingUser.save();
                console.log('✅ Password updated successfully');
            }
        } else {
            console.log('🔄 Creating new test user...');
            const testUser = await User.create({
                name: 'Test User',
                email: 'test@example.com',
                password: 'password123',
                companyName: 'Test Company',
                companyAddress: 'Test Address',
                companyPhone: '123-456-7890'
            });
            
            console.log('✅ Test user created successfully');
            console.log(`   ID: ${testUser._id}`);
            console.log(`   Email: ${testUser.email}`);
            console.log(`   Name: ${testUser.name}`);
        }
        
        // Test JWT token generation
        const user = await User.findOne({ email: 'test@example.com' }).select('+password');
        const token = user.getSignedJwtToken();
        console.log(`\n🔑 JWT Token generated: ${token.substring(0, 50)}...`);
        console.log(`   Token length: ${token.length}`);
        
        console.log('\n✅ Test user is ready for Flutter app testing');
        console.log('   Email: test@example.com');
        console.log('   Password: password123');
        
    } catch (error) {
        console.error('❌ Error creating test user:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
    }
};

createTestUser();