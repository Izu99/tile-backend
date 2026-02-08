/**
 * 🔥 MODEL LOADER UTILITY
 * 
 * Ensures all Mongoose models are registered at server startup
 * This prevents MissingSchemaError when using mongoose.model() lazy loading
 */

const path = require('path');
const fs = require('fs');

/**
 * Load all model files from the models directory
 * This ensures they are registered with Mongoose before any lazy loading attempts
 */
function loadAllModels() {
    const modelsDir = path.join(__dirname, '..', 'models');
    
    try {
        // Get all .js files in the models directory
        const modelFiles = fs.readdirSync(modelsDir)
            .filter(file => file.endsWith('.js'))
            .sort(); // Sort for consistent loading order
        
        console.log('🔄 Loading Mongoose models...'.cyan);
        
        const loadedModels = [];
        
        // Require each model file to register it with Mongoose
        modelFiles.forEach(file => {
            try {
                const modelPath = path.join(modelsDir, file);
                const model = require(modelPath);
                
                if (model && model.modelName) {
                    loadedModels.push(model.modelName);
                    console.log(`  ✅ ${model.modelName} model registered`.green);
                } else {
                    console.log(`  ⚠️  ${file} loaded but no model name found`.yellow);
                }
            } catch (error) {
                console.error(`  ❌ Error loading ${file}:`.red, error.message);
            }
        });
        
        console.log(`🎯 Successfully loaded ${loadedModels.length} models:`.green, loadedModels.join(', '));
        
        return loadedModels;
        
    } catch (error) {
        console.error('❌ Error loading models directory:'.red, error.message);
        throw error;
    }
}

/**
 * Verify that all required models are registered
 * @param {string[]} requiredModels - Array of model names that must be available
 */
function verifyModelsRegistered(requiredModels = []) {
    const mongoose = require('mongoose');
    const registeredModels = Object.keys(mongoose.models);
    
    console.log('🔍 Verifying model registration...'.cyan);
    console.log('  Registered models:', registeredModels.join(', '));
    
    const missingModels = requiredModels.filter(modelName => !registeredModels.includes(modelName));
    
    if (missingModels.length > 0) {
        console.error('❌ Missing required models:'.red, missingModels.join(', '));
        throw new Error(`Missing required models: ${missingModels.join(', ')}`);
    }
    
    console.log('✅ All required models are registered'.green);
    return true;
}

/**
 * Get a model safely with error handling
 * @param {string} modelName - Name of the model to retrieve
 */
function getModel(modelName) {
    const mongoose = require('mongoose');
    
    try {
        return mongoose.model(modelName);
    } catch (error) {
        console.error(`❌ Model '${modelName}' not found. Available models:`, Object.keys(mongoose.models));
        throw error;
    }
}

module.exports = {
    loadAllModels,
    verifyModelsRegistered,
    getModel
};