# Database Migration Guide - Enhanced Annotations

## Issue Summary

When upgrading from the basic redaction database to the enhanced annotation system, existing databases won't have the new tables (`image_annotations` and `text_section_annotations`).

## Solution Implemented

### Automatic Migration (Version 2)

The database now uses **versioned migrations**:
- **Version 1**: Original tables (documents, sections, patterns, results)
- **Version 2**: Enhanced annotation tables (image_annotations, text_section_annotations)

When you upgrade, the SQLite plugin will automatically:
1. Detect the old version (1)
2. Run migration statements for version 2
3. Create the new tables

### How to Apply the Migration

#### Option 1: Clear Existing Database (Recommended for Testing)

On **Android**:
```bash
# Clear app data
adb shell pm clear <your.app.package.name>
```

Or manually:
1. Go to **Settings** → **Apps**
2. Find **your app**
3. Tap **Storage**
4. Tap **Clear Data**
5. Restart the app

#### Option 2: Automatic Migration (Should Work Automatically)

The database will automatically migrate when you:
1. Build the updated code
2. Run the app
3. Initialize any redaction service

The migration runs automatically on database open.

### Verification

Check the console for:
```
🔧 [RedactionDB] Database opened: { databaseId: "..." }
✅ [RedactionDB] Database schema verified
✅ [RedactionDB] Image annotation created: ...
```

If you see this instead:
```
❌ no such table: image_annotations
```

Then the migration failed. Use Option 1 (Clear Data).

## Migration Details

### V1 Tables (Original)
- `redaction_documents`
- `redaction_sections`  
- `redaction_patterns`
- `redaction_results`
- `user_redaction_preferences`

### V2 Tables (New - Enhanced Annotations)
- `image_annotations` - Detailed image metadata with dimensions
- `text_section_annotations` - Hierarchical text structure

### Migration SQL
```sql
CREATE TABLE IF NOT EXISTS image_annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  image_index INTEGER NOT NULL,
  width_px REAL NOT NULL,
  height_px REAL NOT NULL,
  width_cm REAL,
  height_cm REAL,
  width_inches REAL,
  height_inches REAL,
  -- ... more fields
);

CREATE TABLE IF NOT EXISTS text_section_annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  section_index INTEGER NOT NULL,
  parent_section_id TEXT,
  section_level INTEGER NOT NULL DEFAULT 1,
  content_text TEXT NOT NULL,
  content_type TEXT NOT NULL,
  -- ... more fields
);
```

## Troubleshooting

### Error: "no such table: image_annotations"

**Cause**: Old database still exists with version 1 schema

**Solution**:
1. Clear app data (Option 1 above)
2. Restart app
3. Test again

### Error: "database is locked"

**Cause**: Multiple instances trying to access database

**Solution**:
1. Close all app instances
2. Restart app
3. Wait for initialization to complete

### Migration Not Running

**Cause**: SQLite version upgrade not detected

**Solution**:
1. Delete the database file manually
2. Or increment `DB_VERSION` again
3. Restart app

## Testing the Migration

After clearing data and restarting:

```javascript
// In browser console or app
const db = RedactionDatabaseService.getInstance();
await db.initialize();

// Should see:
// ✅ [RedactionDB] Database initialization completed successfully

// Test new tables
const result = await db.createImageAnnotation({
  document_id: 'test_doc',
  section_id: 'test_section',
  page_number: 0,
  image_index: 0,
  width_px: 595,
  height_px: 842,
  width_cm: 21.0,
  height_cm: 29.7,
  width_inches: 8.27,
  height_inches: 11.69,
  bbox_x1: 0,
  bbox_y1: 0,
  bbox_x2: 595,
  bbox_y2: 842,
  is_inline: false,
  has_transparency: false,
  created_at: new Date().toISOString()
});

// Should succeed without error
```

## For Production

### Before Deploying

1. ✅ Test migration on development device
2. ✅ Verify all tables exist
3. ✅ Test annotation storage/retrieval
4. ✅ Test with sample PDFs

### User Impact

**Existing users** with old databases will automatically migrate when:
- They update the app
- The app restarts
- Database is accessed

**New users** will get version 2 database from the start.

### Rollback Plan

If migration fails:
1. Revert `DB_VERSION` to 1
2. Remove V2 migration code
3. Deploy hotfix
4. Users' data in V1 tables preserved

## Database Version History

| Version | Date | Changes |
|---------|------|---------|
| 1 | Initial | Basic redaction tables |
| 2 | Current | Enhanced annotation tables with image dimensions and text hierarchy |

## Future Migrations

To add more tables in the future:

```typescript
// 1. Increment version
private readonly DB_VERSION = 3;

// 2. Add new migration method
private getMigrationStatementsV3(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS new_table (...)`
  ];
}

// 3. Add to upgradeStatements
upgradeStatements: [
  { version: 1, statements: this.getCreateTableStatementsV1() },
  { version: 2, statements: this.getMigrationStatementsV2() },
  { version: 3, statements: this.getMigrationStatementsV3() }
]
```

## Commands Reference

### Clear App Data (Android)
```bash
# Using ADB
adb shell pm clear com.your.app.package

# Check if database exists
adb shell run-as com.your.app.package ls /data/data/com.your.app.package/databases/

# Remove specific database
adb shell run-as com.your.app.package rm /data/data/com.your.app.package/databases/redaction_management.db
```

### Check Database Version
```sql
-- In SQLite console
PRAGMA user_version;
```

### List All Tables
```sql
-- In SQLite console  
.tables

-- Should show:
-- redaction_documents
-- redaction_sections
-- redaction_patterns
-- redaction_results
-- user_redaction_preferences
-- image_annotations (NEW)
-- text_section_annotations (NEW)
```

---

**Note**: Always backup user data before running migrations in production!
