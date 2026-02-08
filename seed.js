require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Category = require('./models/Category');
const MaterialSale = require('./models/MaterialSale');
const Supplier = require('./models/Supplier');
const PurchaseOrder = require('./models/PurchaseOrder');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/business_management');
        console.log('MongoDB Connected for seeding');
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

const seedUsers = async () => {
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ email: 'immensehomeprivatelimited@gmail.com' });
        if (existingUser) {
            console.log('User already exists, updating password');
            existingUser.password = 'Immuse@432';
            await existingUser.save();
            console.log('User password updated successfully'); 
            return existingUser;
        }

        // Create the user
        const user = await User.create({
            name: 'Admin User',
            email: 'immensehomeprivatelimited@gmail.com',
            password: 'Immuse@4321',
            phone: '+94 11 234 5678',
            companyName: 'Immense Home Pvt Ltd',
            companyAddress: '123 Main Street, Colombo 07, Sri Lanka',
            companyPhone: '+94 11 234 5678',
            isActive: true,
            role: 'super-admin'
        });

        console.log('User created successfully:', user.email);
        return user;
    } catch (error) {
        console.error('Error seeding user:', error);
        return null;
    }
};

const seedCategories = async (user) => {
    try {
        // Clear existing categories first
        await Category.deleteMany({});
        console.log('Cleared existing categories');

        // Create sample categories with items
        const categoriesData = [
            {
                name: 'LVT Flooring',
                companyId: user._id,
                items: [
                    { itemName: '2mm Luxury Vinyl Tile & Installation', baseUnit: 'sqft', sqftPerUnit: 1.0 },
                    { itemName: '3mm Luxury Vinyl Tile & Installation', baseUnit: 'sqft', sqftPerUnit: 1.0 },
                    { itemName: '5mm Luxury Vinyl Tile & Installation', baseUnit: 'sqft', sqftPerUnit: 1.0 },
                ]
            },
            {
                name: 'Skirting',
                companyId: user._id,
                items: [
                    { itemName: 'PVC Skirting 3" inch', baseUnit: 'linear ft', sqftPerUnit: 0.25 },
                    { itemName: 'PVC Skirting 4" inch', baseUnit: 'linear ft', sqftPerUnit: 0.33 },
                    { itemName: 'PVC Skirting 5" inch', baseUnit: 'linear ft', sqftPerUnit: 0.42 },
                ]
            },
            {
                name: 'Preparation',
                companyId: user._id,
                items: [
                    { itemName: 'Floor Preparation Service', baseUnit: 'Lump Sum', sqftPerUnit: 0.0 },
                    { itemName: 'Surface Cleaning', baseUnit: 'Lump Sum', sqftPerUnit: 0.0 },
                ]
            },
            {
                name: 'Services',
                companyId: user._id,
                items: [
                    { itemName: 'Transportation Service', baseUnit: 'Lump Sum', sqftPerUnit: 0.0 },
                    { itemName: 'Installation Labor', baseUnit: 'sqft', sqftPerUnit: 1.0 },
                ]
            },
            {
                name: 'Custom',
                companyId: user._id,
                items: [
                    { itemName: 'Custom Item', baseUnit: 'units', sqftPerUnit: 1.0 },
                ]
            }
        ];

        for (const categoryData of categoriesData) {
            await Category.create(categoryData);
            console.log(`Created category: ${categoryData.name} with ${categoryData.items.length} items`);
        }

        console.log('Categories seeded successfully');
    } catch (error) {
        console.error('Error seeding categories:', error);
    }
};

const seedMaterialSales = async (user) => {
    try {
        // Check if material sales already exist
        const existingSales = await MaterialSale.find({ user: user._id });
        if (existingSales.length > 0) {
            console.log('Material sales already exist for this user');
            return;
        }

        // Create sample material sales
        const materialSalesData = [
            {
                invoiceNumber: 'MS001',
                saleDate: new Date('2025-12-10'),
                customerName: 'John Smith',
                customerPhone: '0771234567',
                customerAddress: '456 Oak Street, Colombo 05',
                paymentTerms: 30,
                dueDate: new Date('2025-12-25'),
                items: [
                    {
                        category: 'LVT Flooring',
                        colorCode: 'Brown',
                        productName: '3mm Luxury Vinyl Tile & Installation',
                        plank: 10,
                        sqftPerPlank: 2.5,
                        totalSqft: 25.0,
                        unitPrice: 1500.0,
                        amount: 37500.0,
                        costPerSqft: 1200.0,
                        totalCost: 30000.0,
                    }
                ],
                paymentHistory: [
                    {
                        amount: 20000.0,
                        date: new Date('2025-12-12'),
                        description: 'Initial Payment'
                    }
                ],
                status: 'partial',
                notes: 'Sample material sale for demonstration',
                user: user._id,
            },
            {
                invoiceNumber: 'MS002',
                saleDate: new Date('2025-12-08'),
                customerName: 'Sarah Johnson',
                customerPhone: '0772345678',
                customerAddress: '789 Pine Avenue, Colombo 03',
                paymentTerms: 30,
                dueDate: new Date('2025-12-23'),
                items: [
                    {
                        category: 'LVT Flooring',
                        colorCode: 'Gray',
                        productName: '5mm Luxury Vinyl Tile & Installation',
                        plank: 15,
                        sqftPerPlank: 2.0,
                        totalSqft: 30.0,
                        unitPrice: 2000.0,
                        amount: 60000.0,
                        costPerSqft: 1600.0,
                        totalCost: 48000.0,
                    },
                    {
                        category: 'Skirting',
                        colorCode: 'White',
                        productName: 'PVC Skirting 4" inch',
                        plank: 40,
                        sqftPerPlank: 0.33,
                        totalSqft: 13.2,
                        unitPrice: 800.0,
                        amount: 10560.0,
                        costPerSqft: 600.0,
                        totalCost: 7920.0,
                    }
                ],
                paymentHistory: [
                    {
                        amount: 50000.0,
                        date: new Date('2025-12-10'),
                        description: 'Full Payment'
                    }
                ],
                status: 'paid',
                notes: 'Flooring and skirting installation',
                user: user._id,
            },
            {
                invoiceNumber: 'MS003',
                saleDate: new Date('2025-12-05'),
                customerName: 'Mike Wilson',
                customerPhone: '0773456789',
                customerAddress: '321 Elm Road, Colombo 07',
                paymentTerms: 30,
                dueDate: new Date('2025-12-20'),
                items: [
                    {
                        category: 'Preparation',
                        colorCode: '',
                        productName: 'Floor Preparation Service',
                        plank: 1,
                        sqftPerPlank: 0,
                        totalSqft: 150.0,
                        unitPrice: 5000.0,
                        amount: 5000.0,
                        costPerSqft: 4000.0,
                        totalCost: 4000.0,
                    }
                ],
                paymentHistory: [],
                status: 'pending',
                notes: 'Floor preparation service only',
                user: user._id,
            }
        ];

        for (const saleData of materialSalesData) {
            await MaterialSale.create(saleData);
            console.log(`Created material sale: ${saleData.invoiceNumber} for ${saleData.customerName}`);
        }

        console.log('Material sales seeded successfully');
    } catch (error) {
        console.error('Error seeding material sales:', error);
    }
};

const seedSuppliers = async (user) => {
    try {
        // Check if suppliers already exist
        const existingSuppliers = await Supplier.find({ user: user._id });
        if (existingSuppliers.length > 0) {
            console.log('Suppliers already exist for this user');
            return existingSuppliers;
        }

        // Create sample suppliers
        const suppliersData = [
            {
                name: 'ABC Suppliers Pvt Ltd',
                phone: '+94 11 234 5678',
                email: 'contact@abcsuppliers.com',
                address: '123 Industrial Road, Colombo 10',
                categories: ['LVT Flooring', 'Skirting'],
                user: user._id,
            },
            {
                name: 'XYZ Materials Co.',
                phone: '+94 11 345 6789',
                email: 'sales@xyzmaterials.com',
                address: '456 Business Park, Colombo 05',
                categories: ['Preparation', 'Services'],
                user: user._id,
            },
            {
                name: 'Premium Flooring Distributors',
                phone: '+94 11 456 7890',
                email: 'info@premiumflooring.com',
                address: '789 Trade Center, Colombo 03',
                categories: ['LVT Flooring', 'Custom'],
                user: user._id,
            }
        ];

        const createdSuppliers = [];
        for (const supplierData of suppliersData) {
            const supplier = await Supplier.create(supplierData);
            createdSuppliers.push(supplier);
            console.log(`Created supplier: ${supplierData.name}`);
        }

        console.log('Suppliers seeded successfully');
        return createdSuppliers;
    } catch (error) {
        console.error('Error seeding suppliers:', error);
        return [];
    }
};

const seedPurchaseOrders = async (user, suppliers) => {
    try {
        // Check if purchase orders already exist
        const existingPOs = await PurchaseOrder.find({ user: user._id });
        if (existingPOs.length > 0) {
            console.log('Purchase orders already exist for this user');
            return;
        }

        // Create sample purchase orders
        const purchaseOrdersData = [
            {
                poId: 'PO001',
                quotationId: 'QT001',
                customerName: 'John Smith',
                supplier: suppliers[0]._id, // ABC Suppliers
                orderDate: new Date('2025-12-10'),
                expectedDelivery: new Date('2025-12-20'),
                status: 'Ordered',
                items: [
                    {
                        name: '3mm Luxury Vinyl Tile',
                        quantity: 100,
                        unit: 'sqft',
                        unitPrice: 1200.0,
                    },
                    {
                        name: 'PVC Skirting 4" inch',
                        quantity: 200,
                        unit: 'linear ft',
                        unitPrice: 600.0,
                    }
                ],
                notes: 'Urgent delivery required',
                user: user._id,
            },
            {
                poId: 'PO002',
                quotationId: 'QT002',
                customerName: 'Sarah Johnson',
                supplier: suppliers[1]._id, // XYZ Materials
                orderDate: new Date('2025-12-08'),
                expectedDelivery: new Date('2025-12-18'),
                status: 'Delivered',
                items: [
                    {
                        name: 'Floor Preparation Materials',
                        quantity: 50,
                        unit: 'kg',
                        unitPrice: 800.0,
                    }
                ],
                notes: 'Standard delivery',
                user: user._id,
            },
            {
                poId: 'PO003',
                quotationId: 'QT003',
                customerName: 'Mike Wilson',
                supplier: suppliers[2]._id, // Premium Flooring
                orderDate: new Date('2025-12-05'),
                expectedDelivery: new Date('2025-12-15'),
                status: 'Draft',
                items: [
                    {
                        name: '5mm Luxury Vinyl Tile',
                        quantity: 150,
                        unit: 'sqft',
                        unitPrice: 1600.0,
                    }
                ],
                notes: 'Awaiting approval',
                user: user._id,
            }
        ];

        for (const poData of purchaseOrdersData) {
            await PurchaseOrder.create(poData);
            console.log(`Created purchase order: ${poData.poId} for ${poData.customerName}`);
        }

        console.log('Purchase orders seeded successfully');
    } catch (error) {
        console.error('Error seeding purchase orders:', error);
    }
};

const runSeed = async () => {
    await connectDB();
    const user = await seedUsers();
    if (user) {
        await seedCategories(user);
        await seedMaterialSales(user);
        const suppliers = await seedSuppliers(user);
        await seedPurchaseOrders(user, suppliers);
    }
    console.log('Seeding completed');
    process.exit(0);
};

runSeed();
