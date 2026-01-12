const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseHandler');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        const { name, email, password, phone, companyName, companyAddress, companyPhone } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return errorResponse(res, 400, 'User already exists with this email');
        }

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            phone,
            companyName,
            companyAddress,
            companyPhone,
        });

        // Get token
        const token = user.getSignedJwtToken();

        // Remove password from output
        user.password = undefined;

        return successResponse(res, 201, 'User registered successfully', {
            token,
            user,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Validate email & password
        if (!email || !password) {
            return errorResponse(res, 400, 'Please provide email and password');
        }

        // Check for user (include password)
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return errorResponse(res, 401, 'Invalid credentials');
        }

        // Check if user is active
        if (user.isActive === false) {
            return errorResponse(res, 403, 'Your account has been deactivated. Please contact support.');
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return errorResponse(res, 401, 'Invalid credentials');
        }

        // Update last login
        user.lastLoginAt = Date.now();
        await user.save();

        // Get token
        const token = user.getSignedJwtToken();

        // Remove password from output
        user.password = undefined;

        return successResponse(res, 200, 'Login successful', {
            token,
            user,
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        return successResponse(res, 200, 'User retrieved successfully', user);
    } catch (error) {
        next(error);
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
    try {
        const fieldsToUpdate = {
            name: req.body.name,
            phone: req.body.phone,
            companyAddress: req.body.companyAddress,
            companyPhone: req.body.companyPhone,
            avatar: req.body.avatar,
            termsAndConditions: req.body.termsAndConditions,
            bankDetails: req.body.bankDetails,
            signature: req.body.signature,
        };

        // Only super-admin can update company name
        if (req.user.role === 'super-admin' && req.body.companyName) {
            fieldsToUpdate.companyName = req.body.companyName;
        }

        const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
            new: true,
            runValidators: true,
        });

        return successResponse(res, 200, 'Profile updated successfully', user);
    } catch (error) {
        next(error);
    }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return errorResponse(res, 400, 'Please provide current and new password');
        }

        // Get user with password
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return errorResponse(res, 401, 'Current password is incorrect');
        }

        // Update password
        user.password = newPassword;
        await user.save();

        // Get new token
        const token = user.getSignedJwtToken();

        return successResponse(res, 200, 'Password changed successfully', { token });
    } catch (error) {
        next(error);
    }
};
