const { validationResult } = require('express-validator');
const { errorResponse } = require('../utils/responseHandler');

// Middleware to handle validation results
const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => ({
            field: err.path,
            message: err.msg,
        }));

        return errorResponse(res, 400, 'Validation failed', errorMessages);
    }

    next();
};

module.exports = validate;
