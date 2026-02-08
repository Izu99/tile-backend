// Color codes for console output
const colors = require('colors');

// Standard success response
const successResponse = (res, statusCode, message, data = null) => {
    const response = {
        success: true,
        message,
    };

    if (data !== null) {
        response.data = data;
    }

    return res.status(statusCode).json(response);
};

// Standard error response
const errorResponse = (res, statusCode, message, errors = null) => {
    const response = {
        success: false,
        message,
    };

    if (errors !== null) {
        response.errors = errors;
    }

    return res.status(statusCode).json(response);
};

// Paginated response
const paginatedResponse = (res, statusCode, message, data, pagination) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        pagination: {
            total: pagination.total,
            page: pagination.page,
            pages: pagination.pages,
            limit: pagination.limit,
        },
    });
};

// Convenience functions with shorter names (for backward compatibility)
const success = (res, message, data = null, statusCode = 200) => {
    return successResponse(res, statusCode, message, data);
};

const error = (res, message, statusCode = 500, errors = null) => {
    return errorResponse(res, statusCode, message, errors);
};

module.exports = {
    success,
    error,
    successResponse,
    errorResponse,
    paginatedResponse,
};
