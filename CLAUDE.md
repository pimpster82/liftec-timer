# CLAUDE.md - AI Assistant Guide for LIFTEC Timer

**Last Updated:** 2025-01-14 | **Version:** 1.1.3 | **Type:** Progressive Web App (PWA)

---

## Project Essentials

**LIFTEC Timer** is an offline-first time tracking PWA for employees.

**Tech Stack:** Vanilla JavaScript (ES6+), IndexedDB, Firebase (optional), Tailwind CSS, Service Worker

**Key Principle:** Offline-first. Save to IndexedDB immediately, sync to Firebase in background (fire-and-forget, no blocking).

**Languages:** German (de), English (en), Croatian (hr)

---

## Core Architecture

### Offline-First Pattern
```javascript
// Always save locally FIRST
async saveData(data) {
  await storage.put('worklog', data);      // Immediate
  this.renderWorklog();                     // Immediate UI update
  firebaseService.syncToCloud('worklog', data);  // Background, no await
}
```

### Singleton Module Pattern
Every module exports a single instance:
```javascript
class Storage { /* ... */ }
const storage = new Storage();

class App { /* ... */ }
const app = new App();
```

---

## Codebase Structure

```
js/
├── app.js              (~106 KB) - Main controller
├── storage.js          (~12 KB)  - IndexedDB wrapper
├── ui.js               (~20 KB)  - UI/i18n/icons
├── firebase-service.js (~14 KB)  - Cloud sync (optional)
├── firebase-config.js  - Firebase credentials
├── csv.js              (~7 KB)   - CSV export
└── excel-export.js     (~9 KB)   - Excel export
```

---

## Core Modules Quick Reference

### app.js - Application Controller
- **Key Methods:** `init()`, `startSession()`, `addTask()`, `endSession()`, `showSettings()`, `showHistory()`, `exportCSV()`, `exportExcel()`
- **Important:** `APP_VERSION` must match `CACHE_VERSION` in sw.js and `version` in version.json
- **Task Types:** N=Neuanlage, D=Demontage, R=Reparatur, W=Wartung

### storage.js - Data Layer
- **Database:** `LiftecTimerDB` (IndexedDB v1)
- **Stores:** `currentSession`, `settings`, `worklog`, `sessions`
- **All methods are async** - no network waiting, returns immediately after write

### ui.js - UI Components & i18n
- **Translation:** Use `ui.t('key')` for all user text
- **Dialogs return promises** for clean async flow
- **Icons:** 20+ SVG icons available

### firebase-service.js - Cloud Sync (Optional)
- **Fire-and-forget:** Never await in main flow
- **Silent failures:** Log errors, never show user
- **Pattern:** Background sync runs on sign-in, scheduled every 1 hour
- **Note:** App works 100% without Firebase

### csv.js & excel-export.js - Exports
- **CSV Format:** Semicolon-delimited, UTF-8 BOM
- **Excel:** A4 landscape, styled header (green #92D050), weekend highlighting

⚠️ **CRITICAL: Excel Export Protection**
- **NEVER modify `js/excel-export.js` without explicit user request!**
- The export format (columns, layout, styling, structure) is exactly as required by the user
- If new features (like time tracking) need to be added to exports → **ASK USER FIRST**
- Exception: Only change if user explicitly says "please update the Excel export"
- This file is production-critical for external systems/accounting

---

## Data Storage

### IndexedDB Schema

**currentSession** (single record, id='active')
```javascript
{ id: 'active', start: ISO timestamp, tasks: [] }
```

**settings** (single record, key='app')
```javascript
{ key: 'app', data: { username, language, surchargePercent, cloudSync, ... } }
```

**worklog** (auto-increment, indexed by date/yearMonth)
```javascript
{ id, date: DD.MM.YYYY, startTime, endTime, pause, travelTime, tasks, yearMonth: YYYY-MM }
```

---

## PWA & Service Worker

### Version Synchronization (CRITICAL!)
Update all THREE when making changes:

1. **js/app.js** → `const APP_VERSION = 'X.X.X'`
2. **sw.js** → `const CACHE_VERSION = 'X.X.X'`
3. **version.json** → `{ "version": "X.X.X", "releaseDate": "...", "changelog": [...] }`

If versions don't match, caching breaks and updates fail.

### Service Worker
- **Strategy:** Cache-first with network fallback
- **Update Flow:** App posts 'SKIP_WAITING' message → Service Worker activates → User sees new version
- **Assets Cached:** index.html, CSS, all JS, icon files (192px, 512px)

---

## Coding Conventions

### Naming
- **Classes:** PascalCase (`App`, `Storage`)
- **Variables:** camelCase (`currentSession`, `surchargePercent`)
- **Constants:** UPPER_SNAKE_CASE (`APP_VERSION`, `TASK_TYPES`)
- **Private Methods:** Prefix `_` (`_syncToCloudAsync()`)

### Code Patterns

**Use Async/Await, not .then()**
```javascript
async saveWorklog(entry) {
  try {
    await storage.addWorklogEntry(entry);
    ui.showToast(ui.t('saved'), 'success');
  } catch (error) {
    console.error('Save failed:', error);
    ui.showToast(ui.t('error'), 'error');
  }
}
```

**Attach Event Listeners AFTER HTML Injection**
```javascript
showSettings() {
  const content = `<div id="settings">...</div>`;
  ui.showModal(content);

  // NOW attach listeners (element exists)
  document.getElementById('saveBtn').addEventListener('click', () => {
    this.saveSettings();
  });
}
```

**Error Handling**
- User-facing operations: Show error in toast
- Background sync: Silent failure (log to console only)

**Dialog System Returns Promises**
```javascript
async deleteEntry(id) {
  const confirmed = await this.showConfirmDialog('Delete?', 'Sure?');
  if (!confirmed) return;

  await storage.deleteWorklogEntry(id);
  ui.showToast(ui.t('deleted'), 'success');
}
```

---

## Development Workflow

### Local Development
```bash
python -m http.server 8000
# or: npx http-server -p 8000
# or: php -S localhost:8000
```
Open `http://localhost:8000`, edit files, hard refresh `Ctrl+Shift+R`

### Testing Checklist
- [ ] Test offline (DevTools → Network → Offline)
- [ ] Test on mobile (iOS Safari, Android Chrome)
- [ ] Check browser console for errors
- [ ] Test export/import functionality
- [ ] Verify Service Worker caches correctly
- [ ] Update all three version numbers
- [ ] Add changelog entry to version.json

### Before Committing
- No console.log() debug statements
- Translations added for all 3 languages
- No Firebase dependencies in core features
- All version numbers synchronized

---

## Common Tasks

### Adding a Feature
1. Update data model (storage.js)
2. Add UI (app.js)
3. Add translations (ui.js) - all 3 languages
4. Update exports (csv.js, excel-export.js) if needed
5. Update Firebase sync (if applicable)
6. **Bump all three version numbers**
7. Test offline + mobile

### Adding a Translation Key
1. Add to all 3 language objects in ui.js
2. Use `ui.t('key')` in code
3. Update all three version numbers

### Modifying Database Schema
1. Increment version in storage.js
2. Add migration logic in `onupgradeneeded`
3. Update add/update methods to include new field
4. Test migration with old data
5. Bump version numbers

---

## Alternatives to Common Mistakes

| Instead of... | Do this... |
|---|---|
| **⚠️ Modifying excel-export.js** | **NEVER change excel-export.js without explicit user request! Format is exact as needed for export.** |
| Awaiting Firebase in main flow | Fire-and-forget sync (no await, catch errors) |
| Using .then() chains | Use async/await consistently |
| Hardcoding English strings | Use ui.t('key') with translations in all 3 languages |
| Adding npm dependencies | Use vanilla JS or load from CDN |
| Forgetting version bumps | Always update app.js, sw.js, AND version.json |
| Attaching listeners before HTML | Inject HTML first, then attach listeners |
| Showing errors on failed sync | Log to console only (background operations) |
| Making Firebase required | Ensure app works 100% offline always |
| Testing desktop only | Test on iOS Safari and Android Chrome |
| Build tools/transpilers | Keep vanilla ES6+ with no bundler |

---

## Firebase Integration (Optional)

Firebase is **completely optional**. App works 100% offline.

**Sync Pattern:**
1. Save to IndexedDB immediately (blocking)
2. Update UI immediately (blocking)
3. Sync to Firebase in background (non-blocking, fire-and-forget)
4. On error: Log to console, continue normally

**Config:** `js/firebase-config.js` (can be public, security enforced by Firestore rules)

**Security Rules:** Users can only access their own data (`/users/{userId}/{document=**}`)

---

## Testing Scenarios

**Offline Mode:** DevTools → Network tab → Check "Offline" → Test all features → Verify no console errors

**Service Worker Update:**
1. Update version numbers
2. Deploy
3. Open app
4. DevTools → Application → Service Workers → Verify "waiting to activate"
5. Click "skipWaiting" or wait for update banner
6. Verify update installs and old cache deleted

**Multi-Device Sync:**
1. Device A: Sign in with email, create entry
2. Device B: Sign in with same email, trigger manual sync
3. Verify entry appears on Device B

**New User Onboarding:**
1. Clear IndexedDB: `indexedDB.deleteDatabase('LiftecTimerDB')`
2. Reload app
3. Verify walkthrough appears
4. Complete it
5. Verify settings saved

---

## Deployment

1. Test offline thoroughly
2. Update all three version numbers
3. Add changelog to version.json
4. Commit and push
5. Hosting auto-deploys (GitHub Pages ~1 min, Netlify ~30 sec)
6. Users see update banner on next visit

**GitHub Pages:** Settings → Pages → Source: main branch → HTTPS auto-enabled

---

## Troubleshooting

**Service Worker not updating?**
- Check all three version numbers match
- Hard reload: `Ctrl+Shift+R`
- DevTools → Application → Service Workers → Unregister
- Clear storage → Clear site data

**Data not persisting?**
- Check not in incognito mode
- Verify browser storage permissions
- Check console for quota errors

**Firebase sync failing?**
- Check user is signed in: `firebaseService.isSignedIn()`
- Verify Firestore rules in Firebase Console
- Check cloudSync is enabled in settings
- Verify firebase-config.js is correct

**Update banner shows every time?**
- Verify version numbers match in all three files
- Check localStorage for dismissal state
- Verify version.json is being fetched (not cached)

---

## Key Principles (Remember These)

1. **Offline-first always** - Save to IndexedDB first, network operations in background
2. **No build tools** - Vanilla JS, direct edit-refresh workflow
3. **Sync all three versions** - app.js, sw.js, version.json must match
4. **Async/await everywhere** - Use consistently, no .then() chains
5. **Translate everything** - All 3 languages (de, en, hr) required
6. **Test mobile** - iOS Safari and Android Chrome essential
7. **Silent background failures** - Log errors, never block user on sync failures

---

**For issues or questions:** daniel@liftec.at

*Last updated: 2025-11-14*
