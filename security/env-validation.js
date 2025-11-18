/**
 * Environment Variable Validation Module
 * Enforces that critical credentials are set and not using default/weak values
 */

const WEAK_VALUES = new Set([
  'folks123',
  'llm-key-change-me',
  'postgres',
  'admin123',
  'admin-key-change-me',
  'fgd_rcon_password_change_me',
  'password',
  'secret',
  '12345',
  'changeme',
  'change-me',
  'default'
]);

/**
 * Validates a required environment variable
 * @param {string} varName - Environment variable name
 * @param {Object} options - Validation options
 * @param {boolean} options.required - Whether the variable is required (default: true)
 * @param {boolean} options.checkWeak - Whether to check for weak values (default: true)
 * @param {string} options.label - Human-readable label for error messages
 * @returns {string|null} The validated value or null if not required and not set
 * @throws {Error} If validation fails
 */
function validateEnvVar(varName, options = {}) {
  const {
    required = true,
    checkWeak = true,
    label = varName
  } = options;

  const value = process.env[varName];

  // Check if required but not set
  if (required && (!value || value.trim() === '')) {
    throw new Error(
      `CRITICAL SECURITY ERROR: ${label} (${varName}) must be set in environment variables. ` +
      `Server cannot start without this value.`
    );
  }

  // If not required and not set, return null
  if (!value || value.trim() === '') {
    return null;
  }

  const trimmedValue = value.trim();

  // Check for weak/default values
  if (checkWeak && WEAK_VALUES.has(trimmedValue.toLowerCase())) {
    throw new Error(
      `CRITICAL SECURITY ERROR: ${label} (${varName}) is set to a weak/default value: "${trimmedValue}". ` +
      `You must use a secure, unique value. Server cannot start with default credentials.`
    );
  }

  // Additional validation: minimum length for security-critical values
  if (checkWeak && trimmedValue.length < 8) {
    throw new Error(
      `CRITICAL SECURITY ERROR: ${label} (${varName}) is too short (${trimmedValue.length} characters). ` +
      `Must be at least 8 characters for security. Current value starts with: "${trimmedValue.substring(0, 3)}..."`
    );
  }

  return trimmedValue;
}

/**
 * Validates all critical environment variables required for server startup
 * @throws {Error} If any validation fails
 * @returns {Object} Validated environment configuration
 */
export function validateCriticalEnvVars() {
  console.log('\n🔒 Validating critical environment variables...');

  const errors = [];
  const validated = {};

  // Validate database password
  try {
    validated.DB_PASSWORD = validateEnvVar('DB_PASSWORD', {
      required: true,
      checkWeak: true,
      label: 'Database Password'
    });
    console.log('✅ DB_PASSWORD: Valid and secure');
  } catch (error) {
    errors.push(error.message);
  }

  // Validate admin API key
  try {
    validated.ADMIN_API_KEY = validateEnvVar('ADMIN_API_KEY', {
      required: true,
      checkWeak: true,
      label: 'Admin API Key'
    });
    console.log('✅ ADMIN_API_KEY: Valid and secure');
  } catch (error) {
    errors.push(error.message);
  }

  // Validate LLM API key
  try {
    validated.LLM_API_KEY = validateEnvVar('LLM_API_KEY', {
      required: true,
      checkWeak: true,
      label: 'LLM API Key'
    });
    console.log('✅ LLM_API_KEY: Valid and secure');
  } catch (error) {
    errors.push(error.message);
  }

  // JWT_SECRET is special - we can auto-generate with warning
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.trim() === '') {
      console.log('⚠️  JWT_SECRET: Not set, will auto-generate (recommended to set explicitly)');
      validated.JWT_SECRET = null; // Will be auto-generated
    } else if (WEAK_VALUES.has(jwtSecret.toLowerCase())) {
      throw new Error(
        `CRITICAL SECURITY ERROR: JWT Secret (JWT_SECRET) is set to a weak/default value. ` +
        `You must use a secure, unique value or leave it unset for auto-generation.`
      );
    } else {
      validated.JWT_SECRET = jwtSecret;
      console.log('✅ JWT_SECRET: Valid and secure');
    }
  } catch (error) {
    errors.push(error.message);
  }

  // If there are any errors, throw with all error messages
  if (errors.length > 0) {
    console.error('\n❌ ENVIRONMENT VALIDATION FAILED\n');
    errors.forEach(err => console.error(`   ${err}\n`));
    console.error('═══════════════════════════════════════════════════════════════');
    console.error('SECURITY REQUIREMENT: Set all required environment variables');
    console.error('with secure, non-default values before starting the server.');
    console.error('═══════════════════════════════════════════════════════════════\n');

    throw new Error(
      `Environment validation failed with ${errors.length} error(s). ` +
      `See console output above for details.`
    );
  }

  console.log('✅ All critical environment variables validated successfully\n');
  return validated;
}

export default {
  validateEnvVar,
  validateCriticalEnvVars
};
