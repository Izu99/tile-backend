const { errorResponse } = require('../utils/responseHandler');

// Global error handler middleware
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error for debugging
    console.error('Error:'.red, err);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        return errorResponse(res, 404, message);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        const message = `${field} already exists`;
        return errorResponse(res, 400, message);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((val) => val.message);
        return errorResponse(res, 400, 'Validation Error', errors);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return errorResponse(res, 401, 'Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 401, 'Token expired');
    }

    // Default error
    return errorResponse(
        res,
        err.statusCode || 500,
        error.message || 'Server Error'
    );
};

// Not found middleware
const notFound = (req, res, next) => {
    return errorResponse(res, 404, `Route ${req.originalUrl} not found`);
};

module.exports = {
    errorHandler,
    notFound,
};
