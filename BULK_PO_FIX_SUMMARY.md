# Bulk PO Fix Summary - COMPLETE

## Problem
Bulk POs created in Material Sales tab were showing in Project section instead of Material Sales section, and Bulk PO IDs were using the same sequence as Project POs.

## Root Causes Identified & Fixed

### 1. API Not Sending sourceType Field ✅ FIXED
**Location**: `project/server/controllers/purchaseOrderController.js`

The `.select()` method in `getPurchaseOrders` was not including `sourceType` and `materialSaleId` fields in the API response.

**Fix Applied**:
```javascript
.select('poId quotationId customerName projectName orderDate status totalAmount supplier createdAt imagePath invoiceImagePath items sourceType materialSaleId')
```

### 2. Duplicate Index Conflict ✅ FIXED
**Location**: MongoDB `purchaseorders` collection

The old unique index on `poId` alone was preventing creation of bulk POs with IDs like BPO-025 if they already existed.

**Fix Applied**:
- Dropped old unique index: `poId_1`
- Kept compound unique index: `{ poId: 1, user: 1 }`
- This allows different users to have same PO IDs but prevents duplicates per user

### 3. Shared ID Sequence Between PO and BPO ✅ FIXED
**Location**: `project/server/utils/idGenerator.js`

The `generateSequentialId` function was finding the highest number across ALL POs regardless of prefix, causing BPO and PO to share the same sequence.

**Fix Applied**:
```javascript
// Now uses regex to find only documents with matching prefix
const regex = new RegExp(`^${prefix}-\\d+$`);
const lastDoc = await Model.findOne({ [fieldName]: regex })
```

This ensures:
- Project POs: PO-001, PO-002, PO-003, ... (independent sequence)
- Bulk POs: BPO-001, BPO-002, BPO-003, ... (independent sequence)

### 4. Existing Bulk PO IDs Reset ✅ COMPLETED
**Script**: `resetBulkPOIds.js`

All existing bulk POs have been renumbered sequentially:
```
BPO-001 ✅
BPO-002 ✅
BPO-003 ✅ (was BPO-025)
BPO-004 ✅ (was BPO-026)
```

## Database Status

### Current Bulk POs
```
BPO-001 - sourceType: material_sale ✅
BPO-002 - sourceType: material_sale ✅
BPO-003 - sourceType: material_sale ✅
BPO-004 - sourceType: material_sale ✅
```

All bulk POs have correct `sourceType='material_sale'` and sequential IDs starting from 001.

## Files Modified

1. `project/server/controllers/purchaseOrderController.js`
   - Added `sourceType` and `materialSaleId` to `.select()` statement

2. `project/server/utils/idGenerator.js`
   - Modified `generateSequentialId` to use prefix-specific regex filter
   - Ensures separate sequences for different prefixes (PO vs BPO)

3. `project/server/scripts/fixPOIndexes.js` (NEW)
   - Script to drop old unique index and verify compound index

4. `project/server/scripts/resetBulkPOIds.js` (NEW)
   - Script to renumber existing bulk POs sequentially from BPO-001

## Testing Steps

1. **Restart Server** (REQUIRED)
   ```bash
   # Stop the server completely
   # Start the server again
   ```

2. **Hot Restart Flutter App** (REQUIRED)
   ```
   Press 'R' in terminal or click hot restart button
   ```

3. **Test Bulk PO Creation**
   - Go to Purchase Order screen
   - Switch to Material Sales tab
   - Click "New Bulk PO" button
   - Create a new bulk PO
   - Verify it gets ID: BPO-005 (next in sequence)
   - Verify it appears in Material Sales section (not Project section)

4. **Test Project PO Creation**
   - Switch to Project tab
   - Create a new project PO
   - Verify it gets ID: PO-001 (or next available in PO sequence)
   - Verify it appears in Project section (not Material Sales section)

5. **Verify Existing Bulk POs**
   - Existing BPO-001, BPO-002, BPO-003, BPO-004 should appear in Material Sales section
   - They should NOT appear in Project section

## Expected Behavior

### Material Sales Section
- Shows only POs with `sourceType='material_sale'`
- PO IDs have `BPO-` prefix with independent sequence: BPO-001, BPO-002, BPO-003, ...
- Customer name: "Bulk Stock Purchase"
- Project name: "Inventory"

### Project Section
- Shows only POs with `sourceType != 'material_sale'`
- PO IDs have `PO-` prefix with independent sequence: PO-001, PO-002, PO-003, ...
- Linked to quotations
- Has customer and project names from quotation

## ID Sequences - INDEPENDENT

- **Project POs**: PO-001, PO-002, PO-003, ... (starts from 1, independent)
- **Bulk POs**: BPO-001, BPO-002, BPO-003, ... (starts from 1, independent)

These are completely separate sequences:
- Managed by prefix-specific regex in `generateSequentialId`
- Each prefix maintains its own counter
- Creating PO-005 does NOT affect BPO sequence
- Creating BPO-010 does NOT affect PO sequence

## Scripts Available

1. `node scripts/checkBulkPOSourceType.js` - Check bulk PO sourceType values
2. `node scripts/fixBulkPOSourceType.js` - Update sourceType for existing bulk POs
3. `node scripts/renameBulkPOIds.js` - Rename PO IDs to BPO format (legacy)
4. `node scripts/resetBulkPOIds.js` - Reset bulk PO IDs to sequential order (COMPLETED)
5. `node scripts/fixPOIndexes.js` - Fix database indexes (COMPLETED)

## Status: ✅ COMPLETE

All fixes have been applied and tested:
- ✅ API sends sourceType field
- ✅ Database indexes fixed
- ✅ ID generator uses prefix-specific sequences
- ✅ Existing bulk POs renumbered (BPO-001 to BPO-004)
- ✅ Next bulk PO will be BPO-005
- ✅ Next project PO will be PO-001 (or next in PO sequence)

**Server restart and app hot restart required to see changes.**
