const mongoose = require('mongoose');

/**
 * Generate sequential ID for documents
 * @param {Model} Model - Mongoose model
 * @param {String} prefix - Prefix for the ID (e.g., 'PO', 'QUO', 'INV')
 * @param {String} fieldName - Field name to search for max value
 * @returns {String} - Generated ID (e.g., 'PO-001', 'QUO-042')
 */
const generateSequentialId = async (Model, prefix, fieldName = 'documentNumber') => {
    try {
        // Find the document with the highest number
        const lastDoc = await Model.findOne()
            .sort({ [fieldName]: -1 })
            .select(fieldName)
            .lean();

        let nextNumber = 1;

        if (lastDoc && lastDoc[fieldName]) {
            // Extract number from the field (e.g., 'PO-042' -> 42)
            const match = lastDoc[fieldName].match(/\d+$/);
            if (match) {
                nextNumber = parseInt(match[0]) + 1;
            }
        }

        // Pad with zeros (e.g., 1 -> 001, 42 -> 042)
        const paddedNumber = nextNumber.toString().padStart(3, '0');

        return `${prefix}-${paddedNumber}`;
    } catch (error) {
        console.error('Error generating sequential ID:', error);
        throw error;
    }
};

/**
 * Generate simple numeric ID without prefix
 * @param {Model} Model - Mongoose model
 * @param {String} fieldName - Field name to search for max value
 * @param {Object} filter - Additional filter criteria (e.g., { user: userId })
 * @returns {String} - Generated numeric ID (e.g., '001', '042')
 */
const generateNumericId = async (Model, fieldName = 'documentNumber', filter = {}) => {
    try {
        // Remove type from filter and use base filter for ALL documents for this user/company
        const { type, ...baseFilter } = filter;

        // Find ALL documents for this user/company
        const allDocs = await Model.find(baseFilter)
            .select(fieldName)
            .lean();

        let maxNumber = 0;

        allDocs.forEach(doc => {
            const docNumber = doc[fieldName];
            if (docNumber) {
                // Extract number from "QUO-001" or "INV-001" → 001 → 1
                const match = docNumber.match(/(\d+)$/);
                if (match) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNumber) {
                        maxNumber = num;
                    }
                }
            }
        });

        // Next number, padded with zeros
        return String(maxNumber + 1).padStart(3, '0');

    } catch (error) {
        console.error('ID Generation error:', error);
        throw error;
    }
};

module.exports = {
    generateSequentialId,
    generateNumericId,
};
