// models/Company.js

const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    phone: String,
    address: String,

    // Each company tracks its own last number
    lastDocumentNumber: {
        type: Number,
        default: 0,
    },

    // Settings
    documentSettings: {
        numberPadding: {
            type: Number,
            default: 3,  // 001, 002, etc.
        },
    },

    isActive: {
        type: Boolean,
        default: true,
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { timestamps: true });

module.exports = mongoose.model('Company', CompanySchema);
