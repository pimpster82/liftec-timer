# CLAUDE.md - AI Assistant Guide for LIFTEC Timer

> **Purpose:** This document provides comprehensive guidance for AI assistants (like Claude) working on the LIFTEC Timer codebase. It explains the architecture, conventions, and best practices to follow.

**Last Updated:** 2025-01-14
**Current Version:** 1.1.3
**Project Type:** Progressive Web App (PWA)
**Primary Language:** German (with English and Croatian support)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Philosophy](#architecture-philosophy)
3. [Codebase Structure](#codebase-structure)
4. [Core Modules](#core-modules)
5. [Data Flow & Storage](#data-flow--storage)
6. [PWA Architecture](#pwa-architecture)
7. [Firebase Integration](#firebase-integration)
8. [Coding Conventions](#coding-conventions)
9. [Development Workflows](#development-workflows)
10. [Common Tasks](#common-tasks)
11. [Testing Guidelines](#testing-guidelines)
12. [Deployment Process](#deployment-process)
13. [Do's and Don'ts](#dos-and-donts)

---

## Project Overview

### What is LIFTEC Timer?

LIFTEC Timer is an **offline-first time tracking Progressive Web App** for LIFTEC employees. It enables workers to:
- Track work sessions with start/end times
- Add categorized tasks (Neuanlage, Demontage, Reparatur, Wartung)
- Manage breaks and travel time
- Export monthly reports as CSV or Excel
- Optionally sync data to Firebase cloud storage

### Key Characteristics

- **Offline-First:** Works 100% without internet connection
- **No Build Tools:** Vanilla JavaScript (ES6+), no bundlers
- **Progressive Enhancement:** Firebase sync is optional
- **Cross-Platform:** iOS, Android, Desktop (via PWA)
- **Privacy-Focused:** All data stored locally in IndexedDB
- **OTA Updates:** Over-the-air updates with user notifications
- **Multi-Language:** German (default), English, Croatian

### Tech Stack

```
Frontend:     Vanilla JavaScript (ES6+)
Styling:      Tailwind CSS (CDN) + Custom CSS
Storage:      IndexedDB (primary) + Firebase Firestore (optional)
PWA:          Service Worker + Web Manifest
Icons:        Embedded SVG
Export:       CSV + XLSX (ExcelJS library)
Auth:         Firebase Auth (anonymous + email/password)
```

---

## Architecture Philosophy

### 1. Offline-First (Non-Negotiable)

**Golden Rule:** The app MUST work 100% offline. Every feature must function without internet.

```javascript
// ✅ CORRECT: IndexedDB first, Firebase optional
async saveData(data) {
  // 1. Save locally (synchronous from user's perspective)
  await storage.put('worklog', data);

  // 2. Update UI immediately
  this.renderWorklog();

  // 3. Sync to cloud in background (fire-and-forget)
  firebaseService.syncToCloud('worklog', data);  // No await!
}

// ❌ WRONG: Waiting for Firebase
async saveData(data) {
  await firebaseService.saveToCloud(data);  // App breaks offline!
  await storage.put('worklog', data);
}
```

### 2. Progressive Enhancement

Firebase cloud sync is a **progressive enhancement**, not a requirement:

- ✅ App works without Firebase config
- ✅ Cloud sync section only appears if Firebase is initialized
- ✅ Sync errors are logged but don't break the app
- ✅ Users can disable cloud sync anytime

### 3. No Build Step Philosophy

The project intentionally avoids build tools to maintain simplicity:

- ✅ Direct file editing and refresh workflow
- ✅ No transpilation, bundling, or minification
- ✅ Easy deployment (just push files to any static host)
- ❌ Don't introduce webpack, Vite, or other bundlers
- ❌ Don't require npm install to run locally

### 4. Module Singleton Pattern

All modules export single instances:

```javascript
// storage.js
class Storage { /* ... */ }
const storage = new Storage();  // Singleton

// app.js
class App { /* ... */ }
const app = new App();  // Singleton
```

This pattern simplifies module usage but makes unit testing harder (acceptable trade-off for this project).

---

## Codebase Structure

```
liftec-timer/
├── index.html                  # Single-page app entry point
├── manifest.json               # PWA manifest (name, icons, theme)
├── sw.js                       # Service Worker (caching, offline)
├── version.json                # OTA update metadata
├── .gitignore                  # Git ignore rules
│
├── css/
│   └── styles.css              # Custom styles (animations, PWA fixes)
│
├── js/
│   ├── app.js                  # Main controller (2717 lines)
│   ├── storage.js              # IndexedDB wrapper
│   ├── ui.js                   # UI components, i18n, icons
│   ├── firebase-service.js     # Optional cloud sync
│   ├── firebase-config.js      # Firebase credentials
│   ├── csv.js                  # CSV export/import
│   └── excel-export.js         # Excel XLSX export
│
├── icons/
│   ├── icon-72.png             # PWA icons (8 sizes total)
│   ├── icon-96.png
│   ├── ...
│   └── icon-512.png
│
├── README.md                   # User documentation
├── FIREBASE_SETUP.md           # Firebase setup guide
└── CLAUDE.md                   # This file (AI assistant guide)
```

### File Sizes (for context)

- `app.js`: ~106 KB (2717 lines) - Main application logic
- `storage.js`: ~12 KB - Data layer
- `ui.js`: ~20 KB - UI components
- `firebase-service.js`: ~14 KB - Cloud sync
- `csv.js`: ~7 KB - CSV export
- `excel-export.js`: ~9 KB - Excel export

---

## Core Modules

### 1. app.js - Application Controller

**Singleton Class:** `App`

**Key Responsibilities:**
- Session lifecycle (start → add tasks → end)
- Screen navigation (main, settings, history, about)
- Dialog system (prompts, confirmations, pickers)
- Service Worker registration and update checks
- Onboarding workflow for new users
- Export/import orchestration
- Menu handling
- Absence entry workflow

**Important Constants:**
```javascript
const APP_VERSION = '1.1.3';  // MUST match version.json and sw.js
const TASK_TYPES = {
  'N': 'Neuanlage',
  'D': 'Demontage',
  'R': 'Reparatur',
  'W': 'Wartung',
  '': 'Other'
};
```

**Initialization Flow:**
1. Initialize IndexedDB storage
2. Load user settings (language, username, etc.)
3. Initialize Firebase (if available)
4. Register Service Worker
5. Check for updates (compare version.json)
6. Setup install prompt listener
7. Run onboarding if first launch
8. Render main screen
9. Start duration updater if session active

**Key Methods:**
- `init()` - App bootstrap
- `startSession()` - Start time tracking
- `addTask()` - Add task to current session
- `endSession()` - End session and save to worklog
- `showSettings()` - Settings modal
- `showHistory()` - Worklog history modal
- `exportCSV()` - Monthly CSV export
- `exportExcel()` - Monthly Excel export
- `showOnboarding()` - Onboarding walkthrough

### 2. storage.js - Data Access Layer

**Singleton Class:** `Storage`

**Database:** `LiftecTimerDB` (IndexedDB v1)

**Object Stores:**
```javascript
sessions          // Historical sessions (unused currently)
  keyPath: 'id' (autoIncrement)
  indexes: ['date', 'start']

currentSession    // Active session (single record)
  keyPath: 'id'   // Always 'active'
  structure: { id, start, tasks: [] }

settings          // App configuration (single record)
  keyPath: 'key'  // Always 'app'
  structure: { key, data: { username, language, ... } }

worklog           // Completed work entries
  keyPath: 'id' (autoIncrement)
  indexes: ['date', 'yearMonth']
  structure: { id, date, startTime, endTime, pause, travelTime, tasks, ... }
```

**Key Methods:**
```javascript
// Generic CRUD
get(storeName, key)
put(storeName, data)
delete(storeName, key)
getAll(storeName)
clear(storeName)

// Session-specific
getCurrentSession()
saveCurrentSession(sessionData)
deleteCurrentSession()

// Settings-specific
getSettings()
saveSettings(settings)

// Worklog-specific
addWorklogEntry(entry)
getWorklogEntries()
getMonthEntries(yearMonth)
updateWorklogEntry(id, updatedEntry)
deleteWorklogEntry(id)

// Import/Export
exportAllData()
importData(data)
getDatabaseSize()
```

**Offline-First Pattern:**
All methods are async and return immediately after IndexedDB write. No network waiting.

### 3. ui.js - UI Components & Localization

**Singleton Class:** `UI`

**Key Responsibilities:**
- Internationalization (i18n) for 3 languages
- SVG icon library (20+ icons)
- Toast notifications
- Modal dialog system
- Screen navigation
- Loading states
- Date/time formatting
- Hero card rendering

**Translation System:**
```javascript
getI18N() {
  return {
    de: { appName: 'Zeiterfassung', ... },
    en: { appName: 'Time Tracking', ... },
    hr: { appName: 'Evidencija vremena', ... }
  };
}
```

**Icon Library:**
```javascript
playIcon()      - Start button
stopIcon()      - End button
settingsIcon()  - Settings gear
uploadIcon()    - Export/sync
historyIcon()   - Calendar
plusIcon()      - Add task
trashIcon()     - Delete
editIcon()      - Edit pencil
// ... and 12+ more
```

**Key Methods:**
```javascript
t(key)                    // Translate key to current language
showToast(message, type)  // Show toast (success, error, warning, info)
showModal(content)        // Show modal dialog
hideModal()               // Close modal
showLoading()             // Show loading overlay
hideLoading()             // Hide loading overlay
showScreen(screenId)      // Navigate to screen
formatDate(date)          // Format as DD.MM.YYYY
formatTime(date)          // Format as HH:MM
```

### 4. firebase-service.js - Cloud Sync Layer

**Singleton Class:** `FirebaseService`

**SDK:** Firebase v9 Compat Mode (loaded from CDN)

**Features:**
- Authentication (Anonymous + Email/Password)
- Firestore data sync
- Offline persistence (Firestore local cache)
- Scheduled sync (every 1 hour)
- Real-time listeners (for multi-device sync)
- Account linking (upgrade anonymous to email)

**Firestore Structure:**
```
users/
  {userId}/
    data/
      settings/           - User settings
    sessions/
      current/            - Active session
    worklog/
      {entryId}/          - Worklog entries
```

**Key Methods:**
```javascript
// Authentication
signInAnonymously()
signInWithEmail(email, password)
signUpWithEmail(email, password)
linkAnonymousToEmail(email, password)
signOut()

// Sync
fullSync()                      // Pull all data from cloud
syncToCloud(type, data)         // Push data to cloud
startScheduledSync()            // Auto-sync every hour
stopScheduledSync()             // Stop auto-sync

// Utilities
isInitialized()
isSignedIn()
getUserId()
```

**Error Handling:**
All sync operations use `.catch()` to silently handle errors. App never breaks due to Firebase failures.

### 5. csv.js - CSV Export/Import

**Singleton Class:** `CSVExport`

**Features:**
- Monthly CSV generation (all days, empty rows for missing dates)
- Complete worklog export
- CSV import with task parsing
- UTF-8 BOM for Excel compatibility
- Email/Share integration (Web Share API + mailto fallback)

**CSV Format:**
```csv
Datum;Start;Ende;Pause;Fahrtzeit;SZ;N;D;R;W;Taetigkeiten
15.11.2025;08:00;16:30;00:30;01:00;06:00;X;;;;"Reparatur [R], Wartung [W]"
```

**Key Methods:**
```javascript
generateMonthlyCSV(year, month, username, email)
exportCompleteWorklog()
importFromCSV(csvText)
sendMonthlyEmail()
```

### 6. excel-export.js - Excel Export

**Singleton Class:** `ExcelExport`

**Library:** ExcelJS 4.4.0 (CDN)

**Features:**
- Formatted XLSX with custom styling
- A4 landscape page setup
- Merged cells for header
- Weekend highlighting (gray background)
- Column rotation for task type flags
- Date formulas for weekday names
- Time formatting (HH:MM)

**Styling:**
- Header: Green (#92D050)
- Task flags: 45° rotation
- Weekends: Gray (#E0E0E0)
- Borders: Thin black

**Key Methods:**
```javascript
async generateMonthlyExcel(year, month, username)
```

---

## Data Flow & Storage

### Storage Architecture

```
User Action
    ↓
[App Controller (app.js)]
    ↓
[Storage Layer (storage.js)]
    ↓
[IndexedDB] ← IMMEDIATE WRITE (Sync)
    ↓
[UI Update] ← IMMEDIATE FEEDBACK
    ↓
[Firebase Sync] ← BACKGROUND (Async, Non-Blocking)
```

### IndexedDB Schema Details

#### currentSession Store
```javascript
{
  id: 'active',  // Always this value
  start: '2025-01-14T08:00:00.000Z',  // ISO timestamp
  tasks: [
    { type: 'N', description: 'Neuanlage Aufzug 3' },
    { type: 'R', description: 'Reparatur Tür' }
  ]
}
```

#### settings Store
```javascript
{
  key: 'app',  // Always this value
  data: {
    username: 'Benutzer',
    language: 'de',              // de, en, or hr
    surchargePercent: 80,
    email: 'daniel@liftec.at',
    emailSubject: 'Arbeitszeit {month} - {name}',
    emailBody: 'Hi Stefan. Anbei meine Arbeitszeit für {month}.',
    cloudSync: false,            // Firebase sync toggle
    onboardingCompleted: false   // Has user seen walkthrough?
  }
}
```

#### worklog Store
```javascript
{
  id: 42,                        // Auto-increment
  date: '15.11.2025',            // DD.MM.YYYY
  startTime: '08:00',
  endTime: '16:30',
  pause: '00:30',                // HH:MM format
  travelTime: '01:00',           // HH:MM format
  surcharge: '06:00',            // Calculated work hours
  tasks: [
    { type: 'R', description: 'Reparatur Aufzug 3' },
    { type: 'W', description: 'Wartung Tür' }
  ],
  yearMonth: '2025-11'           // For efficient monthly queries
}
```

### Sync Strategy

**Offline-First Guarantees:**
- ✅ All operations complete immediately (IndexedDB)
- ✅ No waiting for network
- ✅ App never breaks on sync errors
- ✅ Data always available offline

**Firebase Sync (Optional):**
- Fire-and-forget async calls
- Silent failures (logged to console, not shown to user)
- Scheduled sync every 1 hour (when signed in + sync enabled)
- Manual sync button in settings
- Merge strategy: Cloud data overwrites local on conflicts (last-write-wins)

---

## PWA Architecture

### Service Worker (sw.js)

**Cache Strategy:** Cache-First with Network Fallback

**Version Constant:**
```javascript
const CACHE_VERSION = '1.1.3';  // MUST match APP_VERSION in app.js
const CACHE_NAME = `liftec-timer-v${CACHE_VERSION}`;
```

**Static Assets Cached:**
- `./` (root)
- `./index.html`
- `./manifest.json`
- `./css/styles.css`
- All JS files in `/js`
- Icon files (192px, 512px)

**Lifecycle Events:**

1. **Install:** Cache all static assets
2. **Activate:** Delete old caches, activate immediately
3. **Fetch:** Return from cache, fallback to network
4. **Message:** Handle skip waiting command from app

**Update Flow:**
```javascript
// When app posts 'SKIP_WAITING' message
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();  // Activate new SW immediately
  }
});
```

### Web Manifest (manifest.json)

**Key Properties:**
```json
{
  "name": "LIFTEC Timer",
  "short_name": "LIFTEC",
  "start_url": "./index.html",
  "display": "standalone",        // Fullscreen app-like experience
  "theme_color": "#FFB300",       // Amber (LIFTEC brand color)
  "background_color": "#FFFFFF",
  "orientation": "portrait",
  "icons": [ /* 8 sizes from 72px to 512px */ ],
  "shortcuts": [
    { "name": "Sitzung starten", "url": "./index.html?action=start" }
  ]
}
```

### Offline-First Features

1. **Static Asset Caching:** All JS/CSS/HTML cached on first visit
2. **IndexedDB Storage:** All data persisted locally
3. **Service Worker:** Intercepts network requests
4. **Update Notifications:** User prompted when new version available
5. **Install Prompt:** Custom "Add to Home Screen" banner

---

## Firebase Integration

### Optional Cloud Sync Philosophy

Firebase is **completely optional**:

- ✅ App works 100% offline without Firebase
- ✅ Cloud sync section only appears if Firebase is initialized
- ✅ Users can enable/disable sync anytime
- ✅ All features work without Firebase

### Firebase Configuration

**File:** `js/firebase-config.js`

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "liftec-timer.firebaseapp.com",
  projectId: "liftec-timer",
  storageBucket: "liftec-timer.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};

const FIREBASE_FEATURES = {
  auth: true,
  firestore: true,
  offline: true,
  anonymousAuth: true
};
```

**Security Note:** This config can be public. Security is enforced by Firestore rules.

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // No other access allowed
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Sync Patterns

**On Sign-In:**
```javascript
1. User signs in (anonymous or email)
2. Check if cloudSync is enabled in settings
3. If enabled: Full sync (pull from cloud → merge with local)
4. Start scheduled sync (every 1 hour)
5. Setup real-time listeners (optional)
```

**On Data Change:**
```javascript
1. Save to IndexedDB immediately
2. Update UI immediately
3. If signed in + sync enabled: Push to Firebase (background)
4. If push fails: Log error, continue normally
```

**Conflict Resolution:**
- Last-Write-Wins strategy
- Cloud data overwrites local on conflicts
- No versioning or merge logic (intentional simplicity)

---

## Coding Conventions

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Classes | PascalCase | `App`, `Storage`, `FirebaseService` |
| Variables | camelCase | `currentSession`, `surchargePercent` |
| Constants | UPPER_SNAKE_CASE | `APP_VERSION`, `TASK_TYPES` |
| Private Methods | Prefix `_` | `_syncToCloudAsync()` |
| Event Handlers | Descriptive verb | `startSession()`, `showMenu()` |
| Database IDs | String or Number | `'active'`, `42` |

### Code Organization Pattern

```javascript
// 1. Class definition
class App {
  constructor() {
    // Initialize properties
  }

  // 2. Main initialization
  async init() { ... }

  // 3. Feature groups (with comments)
  // ===== Service Worker & Updates =====
  async registerServiceWorker() { ... }
  async checkForUpdates() { ... }

  // ===== Session Management =====
  async startSession() { ... }
  async endSession() { ... }

  // ===== Dialogs =====
  showDateTimePicker() { ... }
  showConfirmDialog() { ... }
}

// 4. Singleton export
const app = new App();
```

### Async/Await Pattern

All I/O operations use async/await:

```javascript
// ✅ CORRECT
async saveWorklog(entry) {
  try {
    await storage.addWorklogEntry(entry);
    ui.showToast(ui.t('saved'), 'success');
  } catch (error) {
    console.error('Save failed:', error);
    ui.showToast(ui.t('error'), 'error');
  }
}

// ❌ WRONG: Using .then() instead
saveWorklog(entry) {
  storage.addWorklogEntry(entry)
    .then(() => ui.showToast('Saved', 'success'))
    .catch(err => ui.showToast('Error', 'error'));
}
```

### Error Handling Pattern

```javascript
// User-facing operations: Show error
try {
  await storage.deleteWorklogEntry(id);
  ui.showToast(ui.t('deleted'), 'success');
} catch (error) {
  console.error('Delete failed:', error);
  ui.showToast(ui.t('errorDeleting'), 'error');
}

// Background sync operations: Silent failure
firebaseService.syncToCloud('worklog', data).catch(err => {
  console.log('Background sync failed:', err.message);
  // Don't show to user, app continues normally
});
```

### Promise-based Dialogs

Dialogs return promises for clean async flow:

```javascript
// ✅ CORRECT: Linear async flow
async deleteEntry(id) {
  const confirmed = await this.showConfirmDialog(
    ui.t('confirmDelete'),
    ui.t('confirmDeleteMessage')
  );

  if (!confirmed) return;

  await storage.deleteWorklogEntry(id);
  ui.showToast(ui.t('deleted'), 'success');
}

// ❌ WRONG: Callback hell
deleteEntry(id) {
  this.showConfirmDialog('Delete?', 'Are you sure?', (confirmed) => {
    if (confirmed) {
      storage.deleteWorklogEntry(id).then(() => {
        ui.showToast('Deleted', 'success');
      });
    }
  });
}
```

### Event Listener Pattern

Attach listeners AFTER HTML injection:

```javascript
// ✅ CORRECT
showSettings() {
  const content = `<div id="settings">...</div>`;
  ui.showModal(content);

  // Now attach listeners
  document.getElementById('saveBtn').addEventListener('click', () => {
    this.saveSettings();
  });
}

// ❌ WRONG: Listeners before HTML exists
showSettings() {
  document.getElementById('saveBtn').addEventListener('click', () => {
    this.saveSettings();  // Element doesn't exist yet!
  });

  const content = `<div id="settings">...</div>`;
  ui.showModal(content);
}
```

---

## Development Workflows

### Local Development

**No Build Required!** Just serve static files:

```bash
# Option 1: Python
python -m http.server 8000

# Option 2: Node.js
npx http-server -p 8000

# Option 3: PHP
php -S localhost:8000

# Option 4: VS Code Live Server extension
```

Then open `http://localhost:8000` in your browser.

### Making Changes

1. Edit files in your code editor
2. Hard refresh browser: `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac)
3. Check browser console for errors (F12)
4. Test offline: DevTools → Network → Offline checkbox

### Version Bumping (Critical!)

When making changes, update **ALL THREE** version locations:

```javascript
// 1. js/app.js
const APP_VERSION = '1.1.4';  // Update here

// 2. sw.js
const CACHE_VERSION = '1.1.4';  // Update here

// 3. version.json
{
  "version": "1.1.4",  // Update here
  "releaseDate": "2025-01-15",
  "changelog": [
    "Your changes here"
  ],
  "critical": false  // true for forced updates
}
```

**Why all three?**
- `APP_VERSION` - App knows its own version
- `CACHE_VERSION` - Service Worker creates new cache
- `version.json` - OTA update detection

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes, test locally

# 3. Update version numbers (all three places!)

# 4. Commit with descriptive message
git add .
git commit -m "Add feature: description of change"

# 5. Push to remote
git push -u origin feature/my-feature

# 6. Create pull request (if using PR workflow)
# OR merge to main if direct commit
```

### Testing Checklist

Before committing changes:

- [ ] Test offline (DevTools → Network → Offline)
- [ ] Test on mobile device (iOS Safari, Android Chrome)
- [ ] Check browser console for errors
- [ ] Test with Firebase disabled
- [ ] Test with Firebase enabled
- [ ] Test export/import functionality
- [ ] Verify Service Worker updates correctly
- [ ] Update all three version numbers
- [ ] Add changelog entry to version.json

---

## Common Tasks

### Adding a New Feature

**Example: Add a "Notes" field to worklog entries**

1. **Update Data Model** (`storage.js`):
```javascript
// No schema change needed for IndexedDB (schemaless)
// Just add field when saving:
async addWorklogEntry(entry) {
  const entryWithNotes = {
    ...entry,
    notes: entry.notes || ''  // New field
  };
  return this.put('worklog', entryWithNotes);
}
```

2. **Update UI** (`app.js`):
```javascript
async endSession() {
  // ... existing code ...

  // Add notes input
  const notes = await this.showPromptDialog(
    ui.t('addNotes'),
    ui.t('optionalNotes'),
    ''
  );

  const entry = {
    // ... existing fields ...
    notes: notes || ''
  };

  await storage.addWorklogEntry(entry);
}
```

3. **Update Translations** (`ui.js`):
```javascript
getI18N() {
  return {
    de: {
      // ... existing translations ...
      addNotes: 'Notizen hinzufügen',
      optionalNotes: 'Optionale Notizen'
    },
    en: {
      // ... existing translations ...
      addNotes: 'Add Notes',
      optionalNotes: 'Optional notes'
    },
    hr: {
      // ... existing translations ...
      addNotes: 'Dodaj bilješke',
      optionalNotes: 'Opcionalne bilješke'
    }
  };
}
```

4. **Update Export** (`csv.js`, `excel-export.js`):
```javascript
// csv.js
generateMonthlyCSV() {
  // Add "Notizen" column to CSV header
  let csv = 'Datum;Start;Ende;...;Notizen\n';

  entries.forEach(entry => {
    csv += `${entry.date};...;${entry.notes || ''}\n`;
  });
}

// excel-export.js
async generateMonthlyExcel() {
  // Add "Notizen" column to Excel
  worksheet.getCell('M1').value = 'Notizen';
  worksheet.getCell(`M${rowIndex}`).value = entry.notes || '';
}
```

5. **Update Firebase Sync** (if applicable):
```javascript
// firebase-service.js
// No code change needed - Firestore is schemaless
// New field will automatically sync
```

6. **Update Version Numbers**:
```javascript
// app.js
const APP_VERSION = '1.2.0';

// sw.js
const CACHE_VERSION = '1.2.0';

// version.json
{
  "version": "1.2.0",
  "releaseDate": "2025-01-15",
  "changelog": [
    "Neues Feld: Notizen zu Worklog-Einträgen hinzufügen"
  ]
}
```

7. **Test**:
- [ ] Create session with notes
- [ ] Export CSV → verify notes column
- [ ] Export Excel → verify notes column
- [ ] Test with Firebase sync
- [ ] Test offline
- [ ] Verify update notification appears

### Adding a New Language

**Example: Add Italian (it)**

1. **Update Translations** (`ui.js`):
```javascript
getI18N() {
  return {
    de: { /* existing */ },
    en: { /* existing */ },
    hr: { /* existing */ },
    it: {  // NEW!
      appName: 'Tracciamento Tempo',
      startSession: 'Inizia sessione',
      // ... translate ALL keys from other languages
    }
  };
}
```

2. **Update Settings Dropdown** (`app.js`):
```javascript
showSettings() {
  const languageOptions = `
    <option value="de" ${settings.language === 'de' ? 'selected' : ''}>Deutsch</option>
    <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
    <option value="hr" ${settings.language === 'hr' ? 'selected' : ''}>Hrvatski</option>
    <option value="it" ${settings.language === 'it' ? 'selected' : ''}>Italiano</option>
  `;
  // ...
}
```

3. **Test All Screens**:
- [ ] Main screen
- [ ] Settings screen
- [ ] History screen
- [ ] About screen
- [ ] All dialogs
- [ ] All toast messages
- [ ] Export emails

### Modifying Data Schema

**Example: Add version field to worklog entries**

1. **Bump Database Version** (`storage.js`):
```javascript
class Storage {
  constructor() {
    this.dbName = 'LiftecTimerDB';
    this.version = 2;  // Increment from 1 to 2
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;

        // Existing stores...

        // Migration for v2
        if (oldVersion < 2) {
          // Add version field to existing worklog entries
          const transaction = event.target.transaction;
          const worklogStore = transaction.objectStore('worklog');

          worklogStore.openCursor().onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              const entry = cursor.value;
              entry.schemaVersion = 2;  // Add field
              cursor.update(entry);
              cursor.continue();
            }
          };
        }
      };

      // ...
    });
  }
}
```

2. **Update Add/Update Methods**:
```javascript
async addWorklogEntry(entry) {
  const entryWithVersion = {
    ...entry,
    schemaVersion: 2
  };
  return this.put('worklog', entryWithVersion);
}
```

3. **Test Migration**:
- [ ] Create test entry in old schema
- [ ] Load app with new version
- [ ] Verify migration runs
- [ ] Check console for errors
- [ ] Verify old entries have new field

### Deploying an Update

1. **Make Changes** (code, features, bug fixes)

2. **Test Thoroughly**
   - Offline mode
   - Firebase sync
   - Mobile devices
   - Export/import

3. **Update Version Numbers** (all three!)
   - `app.js` → `APP_VERSION`
   - `sw.js` → `CACHE_VERSION`
   - `version.json` → `version`, `releaseDate`, `changelog`

4. **Commit and Push**
```bash
git add .
git commit -m "v1.2.0: Add notes field to worklog entries"
git push origin main
```

5. **Hosting Auto-Deploys**
   - GitHub Pages: Deploys in ~1 minute
   - Netlify/Vercel: Deploys in ~30 seconds

6. **Users See Update**
   - On next app visit, update banner appears
   - User clicks "Update Now"
   - App reloads with new version

---

## Testing Guidelines

### Manual Testing Checklist

**Core Functionality:**
- [ ] Start session
- [ ] Add multiple tasks
- [ ] Edit task
- [ ] Delete task
- [ ] End session (enter pause, travel time)
- [ ] View worklog history
- [ ] Edit worklog entry
- [ ] Delete worklog entry

**Export/Import:**
- [ ] Export monthly CSV
- [ ] Export complete worklog CSV
- [ ] Export monthly Excel
- [ ] Import CSV
- [ ] Email export (or Share API)

**Settings:**
- [ ] Change language (test all 3)
- [ ] Update username
- [ ] Update surcharge percentage
- [ ] Update email settings
- [ ] Toggle cloud sync

**Firebase (if enabled):**
- [ ] Sign in anonymously
- [ ] Sign up with email
- [ ] Sign in with email
- [ ] Manual sync
- [ ] Auto-sync (wait 1 hour or trigger manually)
- [ ] Sign out

**PWA Features:**
- [ ] Install app (Add to Home Screen)
- [ ] Works offline
- [ ] Update notification appears
- [ ] Update installs correctly
- [ ] Service Worker caches assets

**Cross-Browser:**
- [ ] Chrome (Desktop)
- [ ] Safari (iOS)
- [ ] Chrome (Android)
- [ ] Firefox (Desktop)
- [ ] Edge (Desktop)

### Testing Offline Mode

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox
4. Test all features
5. Verify no errors in console
6. Go back online
7. Verify sync works (if Firebase enabled)

### Testing Service Worker Updates

1. Deploy new version (update version numbers)
2. Open app
3. Open DevTools → Application → Service Workers
4. Verify "waiting to activate" appears
5. Click "skipWaiting" (or wait for app to show banner)
6. Verify update installs
7. Check that old cache is deleted

### Common Testing Scenarios

**Scenario 1: New User Onboarding**
1. Clear all data: `indexedDB.deleteDatabase('LiftecTimerDB')`
2. Reload app
3. Verify onboarding walkthrough appears
4. Complete walkthrough
5. Verify settings saved correctly

**Scenario 2: Multi-Device Sync**
1. Device A: Sign in with email
2. Device A: Create worklog entry
3. Device B: Sign in with same email
4. Device B: Trigger manual sync
5. Verify entry appears on Device B

**Scenario 3: Offline → Online Transition**
1. Go offline
2. Create worklog entry
3. Go online
4. Verify entry syncs to Firebase (if enabled)
5. Check Firestore console for data

---

## Deployment Process

### Hosting Options

**GitHub Pages (Recommended):**
```bash
# 1. Create repo and push code
git remote add origin https://github.com/username/liftec-timer.git
git push -u origin main

# 2. Enable GitHub Pages
# → Repo Settings → Pages → Source: main branch

# 3. Access at:
# https://username.github.io/liftec-timer/
```

**Netlify:**
```bash
# 1. Install CLI
npm install -g netlify-cli

# 2. Deploy
netlify deploy --prod

# OR use drag-and-drop at app.netlify.com/drop
```

**Vercel:**
```bash
# 1. Install CLI
npm install -g vercel

# 2. Deploy
vercel --prod
```

### Deployment Checklist

- [ ] Update version numbers (all three!)
- [ ] Test locally
- [ ] Test offline mode
- [ ] Update changelog in version.json
- [ ] Commit and push to main
- [ ] Verify hosting auto-deploys
- [ ] Test deployed version
- [ ] Check Service Worker registration
- [ ] Verify update notification works

### Custom Domain Setup

**GitHub Pages:**
1. Add `CNAME` file with domain
2. Configure DNS: `CNAME` → `username.github.io`
3. Enable HTTPS in repo settings

**Netlify/Vercel:**
1. Add domain in dashboard
2. Update DNS records as instructed
3. HTTPS auto-configured

---

## Do's and Don'ts

### ✅ DO

1. **Always maintain offline-first architecture**
   - Save to IndexedDB before any network calls
   - Never block UI on network operations

2. **Update all three version numbers**
   - `app.js` → `APP_VERSION`
   - `sw.js` → `CACHE_VERSION`
   - `version.json` → `version`

3. **Test offline before committing**
   - DevTools → Network → Offline checkbox
   - Verify all features work

4. **Follow existing code patterns**
   - Singleton modules
   - Async/await
   - Event listeners after HTML injection

5. **Add translations for all three languages**
   - German (de)
   - English (en)
   - Croatian (hr)

6. **Handle errors gracefully**
   - Try-catch for user-facing operations
   - Silent failures for background sync

7. **Preserve simplicity**
   - Keep vanilla JavaScript
   - No build tools
   - Minimal dependencies

8. **Test on real devices**
   - iOS Safari (iPhone/iPad)
   - Android Chrome
   - Desktop browsers

9. **Document breaking changes**
   - Update README.md
   - Update FIREBASE_SETUP.md if needed

10. **Check browser console**
    - No errors
    - No warnings
    - Verify Service Worker registered

### ❌ DON'T

1. **Don't introduce build tools**
   - No webpack, Vite, Rollup, etc.
   - No transpilation or bundling
   - No npm install requirements

2. **Don't break offline mode**
   - Never `await` Firebase calls in main flow
   - Never require internet for core features

3. **Don't make Firebase required**
   - App must work without Firebase
   - Cloud sync is optional enhancement

4. **Don't forget version bumps**
   - Forgetting causes cache issues
   - Update notification won't work

5. **Don't use .then() chains**
   - Use async/await instead
   - Maintains code consistency

6. **Don't add dependencies**
   - Keep vanilla JavaScript
   - Use CDN for libraries (Tailwind, ExcelJS, Firebase)

7. **Don't hardcode strings**
   - Use `ui.t('key')` for all user-facing text
   - Add translations for all languages

8. **Don't commit console.log()**
   - Use `console.error()` for errors
   - Remove debug logs before committing

9. **Don't skip testing**
   - Always test offline
   - Always test on mobile
   - Always test Firebase sync

10. **Don't forget to update Service Worker**
    - Cache version must match app version
    - Test update notification

---

## Troubleshooting Common Issues

### Issue: Service Worker not updating

**Symptoms:**
- Old version still loads after update
- Update banner doesn't appear

**Solutions:**
1. Check if version numbers match (app.js, sw.js, version.json)
2. Hard reload: `Ctrl + Shift + R`
3. DevTools → Application → Service Workers → Unregister
4. DevTools → Application → Clear storage → Clear site data
5. Verify `CACHE_VERSION` changed in sw.js

### Issue: IndexedDB data not persisting

**Symptoms:**
- Data disappears on reload
- "Database not found" errors

**Solutions:**
1. Check browser storage permissions
2. Verify not in incognito/private mode
3. Check available storage space
4. Try different browser
5. Check console for quota errors

### Issue: Firebase sync not working

**Symptoms:**
- Data doesn't sync to cloud
- "Permission denied" errors

**Solutions:**
1. Verify user is signed in: `firebaseService.isSignedIn()`
2. Check Firestore rules in Firebase Console
3. Verify `cloudSync` is enabled in settings
4. Check browser console for errors
5. Verify Firebase config in `firebase-config.js`
6. Test with manual sync button

### Issue: Update banner appears every time

**Symptoms:**
- Update notification doesn't dismiss
- Shows even after updating

**Solutions:**
1. Verify version numbers match in all three files
2. Check localStorage for update dismissal data
3. Clear browser cache
4. Check that `version.json` is being fetched with cache-busting

### Issue: Export/Email not working

**Symptoms:**
- Share API not available
- Email doesn't open

**Solutions:**
1. Check if Web Share API is supported: `navigator.share`
2. Verify email settings in app settings
3. Test mailto fallback manually
4. Check browser console for errors
5. Try different browser

---

## Additional Resources

### Documentation Files

- **README.md** - User documentation (installation, deployment, usage)
- **FIREBASE_SETUP.md** - Firebase setup guide (GDPR, security rules)
- **CLAUDE.md** - This file (AI assistant guide)

### External Resources

- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Tailwind CSS](https://tailwindcss.com/)
- [ExcelJS Documentation](https://github.com/exceljs/exceljs)

### Support

For issues or questions:
- Email: daniel@liftec.at
- Check browser console for errors
- Review documentation files

---

## Version History

- **1.1.3** (2025-01-14)
  - Onboarding walkthrough for new users
  - Multi-language setting explanations
  - Cloud Sync: Only activatable after sign-in
  - Required fields on first start

- **1.1.2** (2025-01-13)
  - Add onboarding walkthrough for new users

- **1.1.0** (2025-01-12)
  - Fix: Prevent onboarding walkthrough loop on restart

- **1.0.0** (2025-01-XX)
  - Initial PWA release
  - Converted from Scriptable iOS app
  - Offline-first architecture
  - IndexedDB storage
  - OTA update mechanism
  - Multi-platform support

---

## Changelog for This Document

- **2025-01-14** - Initial CLAUDE.md creation
  - Comprehensive architecture analysis
  - Development workflows
  - Common tasks guide
  - Testing guidelines
  - Do's and Don'ts

---

**Made with ❤️ for LIFTEC**

*This document is maintained for AI assistants working on the LIFTEC Timer codebase.*
