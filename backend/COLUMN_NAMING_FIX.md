# Column Naming Issue Fix

## Problem Description

The application was failing to start with the error:
```
column "created_at" does not exist
```

This occurred because there was a mismatch between:
- **Database schema**: Using snake_case column names (`created_at`, `updated_at`, `health_score`, etc.)
- **Sequelize models**: Expecting camelCase field names without proper field mapping

## Root Cause

The database configuration had `underscored: true` which automatically converts camelCase field names to snake_case column names, but the models didn't have explicit `field` mappings for fields that needed snake_case conversion.

## Solution

### 1. Migration Fix (`011-fix-column-naming-final.js`)

Created a comprehensive migration that:
- Renames all camelCase columns to snake_case across all tables
- Adds missing columns (like `last_modified_by`, `last_modified_at`, `deleted_at`)
- Handles all tables: `operators`, `subscriptions`, `transactions`, `webhooks`, `users`, `sessions`, `audit_logs`

### 2. Model Updates

Updated all Sequelize models with:
- Explicit `field` mapping for camelCase attributes → snake_case columns
- Proper `underscored: true` configuration
- Correct timestamp field mapping (`createdAt: 'created_at'`, etc.)
- Fixed model hooks and methods

**Fixed Models:**
- ✅ `Operator.js` - Added field mappings for `healthScore`, `lastHealthCheck`, etc.
- ✅ `Subscription.js` - Added field mappings for `operatorId`, `nextPaymentAt`, etc.
- ✅ `Transaction.js` - Added field mappings for `subscriptionId`, `processedAt`, etc.
- ✅ `User.js` - Added field mappings for `firstName`, `lastName`, `isActive`, etc.
- ✅ `Session.js` - Added field mappings for `userId`, `expiresAt`, etc.
- ✅ `Webhook.js` - Added field mappings for `eventType`, `targetUrl`, etc.
- ✅ `AuditLog.js` - Added field mappings for `entityType`, `operationStatus`, etc.

### 3. Database Reset Script

Added `scripts/reset-database.js` for complete database reset if needed:
```bash
node scripts/reset-database.js
```

## How to Apply the Fix

### Option 1: Run Migration (Recommended)

```bash
# Navigate to backend directory
cd backend

# Run the new migration
npx sequelize-cli db:migrate

# Start the application
npm run dev
```

### Option 2: Complete Database Reset (If migration fails)

```bash
# Navigate to backend directory
cd backend

# Run the reset script
node scripts/reset-database.js

# Start the application
npm run dev
```

### Option 3: Manual Reset

```bash
# Undo all migrations
npx sequelize-cli db:migrate:undo:all

# Re-run all migrations
npx sequelize-cli db:migrate

# Start the application
npm run dev
```

## Verification

After applying the fix:

1. **Application should start without errors**:
   ```
   ✅ Database connected successfully
   ✅ Database models initialized successfully
   🎉 All critical dependencies are satisfied!
   ```

2. **All models should load properly**:
   ```
   Database models initialized successfully {
     "modelCount": 7,
     "models": ["Operator", "Subscription", "Transaction", "Webhook", "AuditLog", "User", "Session"]
   }
   ```

3. **No more column naming errors** in the application logs

## Technical Details

### Before (Broken)
```javascript
// Model definition
healthScore: {
  type: DataTypes.DECIMAL(3, 2),
  // No field mapping - Sequelize assumes column name is 'healthScore'
}

// Database schema
CREATE TABLE operators (
  health_score DECIMAL(3,2)  -- snake_case column
);
```

### After (Fixed)
```javascript
// Model definition with explicit field mapping
healthScore: {
  type: DataTypes.DECIMAL(3, 2),
  field: 'health_score',  // ✅ Explicit mapping to snake_case column
}

// Database schema (unchanged)
CREATE TABLE operators (
  health_score DECIMAL(3,2)  -- snake_case column
);
```

## Files Changed

### New Files
- `backend/database/migrations/011-fix-column-naming-final.js` - Comprehensive migration
- `backend/scripts/reset-database.js` - Database reset utility

### Updated Files
- `backend/src/models/Operator.js` - Added field mappings
- `backend/src/models/Subscription.js` - Added field mappings  
- `backend/src/models/Transaction.js` - Added field mappings
- `backend/src/models/User.js` - Added field mappings
- `backend/src/models/Session.js` - Added field mappings
- `backend/src/models/Webhook.js` - Added field mappings and fixed structure
- `backend/src/models/AuditLog.js` - Added field mappings

## Testing

After applying the fix, the application should:
1. ✅ Start without database errors
2. ✅ Load all 7 models successfully
3. ✅ Connect to database without column naming issues
4. ✅ Support all CRUD operations on operators, subscriptions, etc.

## Future Prevention

To prevent similar issues:
1. Always use explicit `field` mappings when database columns use snake_case
2. Test model definitions against actual database schema
3. Use consistent naming conventions across the entire application
4. Run database migrations in staging before production

## Rollback Plan

If issues occur after applying this fix:
```bash
# Rollback to previous migration state
npx sequelize-cli db:migrate:undo

# Or rollback to specific migration
npx sequelize-cli db:migrate:undo --to 010-rename-operators-columns.js
```
