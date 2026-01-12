const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
        },
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            // Dynamic reference depending on context, stored as ObjectId
        },
        metadata: {
            type: Map,
            of: String,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
