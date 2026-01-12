const mongoose = require('mongoose');

// Customer Schema
const CustomerSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a customer name'],
            trim: true,
        },
        phone: {
            type: String,
            required: [true, 'Please add a phone number'],
            unique: true,
            trim: true,
        },
        address: {
            type: String,
            trim: true,
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Index for efficient searching
CustomerSchema.index({ phone: 1, user: 1 }); // Compound index for phone + user
CustomerSchema.index({ name: 1 }); // For name searches

module.exports = mongoose.model('Customer', CustomerSchema);
