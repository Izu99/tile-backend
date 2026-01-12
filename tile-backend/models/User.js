const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a name'],
            trim: true,
        },
        email: {
            type: String,
            required: [true, 'Please add an email'],
            unique: true,
            lowercase: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please add a valid email',
            ],
        },
        password: {
            type: String,
            required: [true, 'Please add a password'],
            minlength: 6,
            select: false, // Don't return password by default
        },
        phone: {
            type: String,
            default: '',
        },
        companyName: {
            type: String,
            default: '',
        },
        companyAddress: {
            type: String,
            default: '',
        },
        companyPhone: {
            type: String,
            default: '',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        role: {
            type: String,
            enum: ['super-admin', 'company', 'customer'],
            default: 'company',
        },
        mustChangePassword: {
            type: Boolean,
            default: false,
        },
        lastLoginAt: {
            type: Date,
        },
        avatar: {
            type: String, // URL or base64
            default: '',
        },
        termsAndConditions: {
            type: String,
            default: '',
        },
        bankDetails: {
            bankName: {
                type: String,
                default: '',
            },
            accountName: {
                type: String,
                default: '',
            },
            accountNumber: {
                type: String,
                default: '',
            },
            branchCode: {
                type: String,
                default: '',
            },
        },
        signature: {
            type: String, // base64 encoded image
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

// Encrypt password before saving
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
    return jwt.sign(
        {
            id: this._id,
            role: this.role,
            companyId: this._id // For company users, the user IS the company tenant
        },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRE,
        }
    );
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
