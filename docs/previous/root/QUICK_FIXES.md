# Quick Fixes & Implementation Guide

## 1. IMMEDIATE FIX: Update package.json

Replace the scripts section in `/home/user/FGD/package.json`:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "test": "jest",
    "test:unit": "jest --testPathPattern='test/unit' --coverage=false",
    "test:integration": "jest --testPathPattern='test/(integration|.*integration)' --coverage=false",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "policy:heal": "node scripts/policy_self_heal.js",
    "build": "npm run policy:heal && npm run test:coverage",
    "build:docker": "docker build -t fgd-app:latest .",
    "start:docker": "docker-compose up -d",
    "stop:docker": "docker-compose down"
  }
}
```

## 2. IMMEDIATE FIX: Install DevDependencies

```bash
npm install --save-dev jest@^29.7.0 babel-jest@^29.7.0 @babel/core@^7.23.0 @babel/preset-env@^7.23.0 eslint@^8.50.0 eslint-config-airbnb-base@^15.0.0 eslint-plugin-import@^2.28.1 prettier@^3.0.0
```

Or add to package.json devDependencies section:

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "babel-jest": "^29.7.0",
    "@babel/core": "^7.23.0",
    "@babel/preset-env": "^7.23.0",
    "eslint": "^8.50.0",
    "eslint-config-airbnb-base": "^15.0.0",
    "eslint-plugin-import": "^2.28.1",
    "prettier": "^3.0.0"
  }
}
```

Then run: `npm install`

## 3. Create .eslintrc.json

Create `/home/user/FGD/.eslintrc.json`:

```json
{
  "extends": "airbnb-base",
  "env": {
    "node": true,
    "es2021": true
  },
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-console": "warn",
    "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "consistent-return": "warn"
  }
}
```

## 4. Create .prettierrc.json

Create `/home/user/FGD/.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "es5",
  "tabWidth": 2,
  "useTabs": false,
  "printWidth": 100,
  "arrowParens": "always"
}
```

## 5. Create babel.config.js

Create `/home/user/FGD/babel.config.js`:

```javascript
module.exports = {
  presets: [['@babel/preset-env', { targets: { node: '18' } }]],
};
```

## 6. Update .env.example - Remove Default Secrets

Replace sensitive defaults in `/home/user/FGD/.env.example`:

```bash
# BEFORE (insecure):
ADMIN_API_KEY=folks123
LLM_API_KEY=llm-key-change-me

# AFTER (secure):
# ADMIN_API_KEY=   # Generate: openssl rand -base64 32
# LLM_API_KEY=     # Generate: openssl rand -base64 32
```

## 7. Add Environment Variable Validation to server.js

Add to the top of `/home/user/FGD/server.js`:

```javascript
/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const required = [
    'NODE_ENV',
    'PORT',
    'JWT_SECRET',
  ];
  
  const optional = [
    'LLM_PROVIDER',
    'OPENAI_API_KEY',
    'GROK_API_KEY',
    'DATABASE_URL',
    'REDIS_URL',
  ];

  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    logger.error('JWT_SECRET must be at least 32 characters long');
    process.exit(1);
  }

  logger.info('Environment variables validated successfully');
}

validateEnvironment();
```

## 8. Fix CI/CD Pipeline - Update ci-cd.yml

Update `.github/workflows/ci-cd.yml` line 131-147:

```yaml
- name: Run unit tests
  run: npm run test:unit
  env:
    DATABASE_URL: postgresql://test_user:test_password@localhost:5432/fgd_test
    REDIS_URL: redis://localhost:6379
    JWT_SECRET: test_jwt_secret_minimum_32_characters_long
    NODE_ENV: test

- name: Run integration tests
  run: npm run test:integration
  env:
    DATABASE_URL: postgresql://test_user:test_password@localhost:5432/fgd_test
    REDIS_URL: redis://localhost:6379
    JWT_SECRET: test_jwt_secret_minimum_32_characters_long
    NODE_ENV: test

- name: Generate coverage report
  run: npm run test:coverage
  env:
    NODE_ENV: test
```

## 9. Create .gitignore Updates

Add to `.gitignore`:

```bash
# Coverage
coverage/
.nyc_output/

# Build
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Testing
.jest_cache/
.mocha_cache/
```

## 10. Add Engines Field to package.json

```json
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

## 11. Add npm cache to .gitignore

Update `.gitignore`:

```bash
# npm
.npm/
npm-debug.log*
package-lock.json*

# Node
node_modules/
```

## 12. Create BUILD.md Documentation

Create `/home/user/FGD/BUILD.md`:

```markdown
# Build & Deployment Guide

## Development Setup

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Run tests with coverage
npm run test:coverage

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Production Build

```bash
# Install production dependencies only
npm ci --only=production

# Build Docker image
npm run build:docker

# Run with docker-compose
npm run start:docker
```

## Docker Deployment

```bash
# Build image
docker build -t fgd-app:latest .

# Run standalone
docker run -d -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=your-secret-here \
  -e DATABASE_URL=postgresql://... \
  fgd-app:latest

# Or with docker-compose
docker-compose up -d
docker-compose logs -f app
```

## Testing

```bash
# All tests with coverage
npm run test:coverage

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode for development
npm run test:watch
```

## CI/CD

The project uses GitHub Actions for CI/CD:
- Code quality checks on every PR
- Automated testing
- Docker image building
- Security scanning (Trivy, Snyk)
- Automated deployment to staging/production

See `.github/workflows/` for pipeline details.
```

## 13. Create env-schema.json (Optional but Recommended)

Create `/home/user/FGD/env.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["PORT", "NODE_ENV", "JWT_SECRET"],
  "properties": {
    "PORT": {
      "type": "string",
      "pattern": "^[0-9]{4,5}$",
      "default": "3000"
    },
    "NODE_ENV": {
      "type": "string",
      "enum": ["development", "production", "test"],
      "default": "development"
    },
    "JWT_SECRET": {
      "type": "string",
      "minLength": 32
    },
    "LLM_PROVIDER": {
      "type": "string",
      "enum": ["openai", "grok"],
      "default": "openai"
    },
    "DATABASE_URL": {
      "type": "string",
      "pattern": "^postgresql://.*"
    },
    "REDIS_URL": {
      "type": "string",
      "pattern": "^redis://.*"
    }
  }
}
```

## Verification Checklist

After applying fixes:

```bash
# 1. Install dependencies
npm install

# 2. Run linting
npm run lint

# 3. Format code
npm run format

# 4. Run all tests
npm run test:coverage

# 5. Build Docker image
docker build -t fgd-app:latest .

# 6. Verify npm scripts
npm run | grep -E "test|lint|build|start"

# 7. Check environment validation
cp .env.example .env
npm start  # Should validate and run

# 8. Check git status
git status  # Should show updated files
```

## Expected Output After Fixes

```
npm run test:coverage

 PASS  test/npc_system.test.js
 PASS  test/phase3_quick.test.js
 PASS  test/adapters.mineflayer.test.js
 ...

Test Suites: 11 passed, 11 total
Tests:       150 passed, 150 total
Coverage: Lines 75.5% | Functions 78.2% | Branches 72.1%
```

## Common Issues & Solutions

### Issue: jest not found
**Solution:** `npm install --save-dev jest`

### Issue: eslint not found
**Solution:** `npm install --save-dev eslint eslint-config-airbnb-base`

### Issue: Tests fail with "Cannot find module @babel/core"
**Solution:** `npm install --save-dev @babel/core @babel/preset-env babel-jest`

### Issue: CI/CD still fails
**Solution:** Verify npm scripts match CI/CD expectations in `.github/workflows/ci-cd.yml`

---

## Support & References

- Jest Documentation: https://jestjs.io/
- ESLint Documentation: https://eslint.org/
- Prettier Documentation: https://prettier.io/
- GitHub Actions: https://github.com/features/actions

