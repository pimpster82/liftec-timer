// LIFTEC Timer - Storage Module (IndexedDB)
// Replaces iCloud storage from Scriptable app

class Storage {
  constructor() {
    this.dbName = 'LiftecTimerDB';
    this.version = 1;
    this.db = null;
  }

  // Initialize database
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Database failed to open');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
          sessionStore.createIndex('date', 'date', { unique: false });
          sessionStore.createIndex('start', 'start', { unique: false });
        }

        if (!db.objectStoreNames.contains('currentSession')) {
          db.createObjectStore('currentSession', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('worklog')) {
          const worklogStore = db.createObjectStore('worklog', { keyPath: 'id', autoIncrement: true });
          worklogStore.createIndex('date', 'date', { unique: false });
          worklogStore.createIndex('yearMonth', 'yearMonth', { unique: false });
        }

        console.log('Database setup complete');
      };
    });
  }

  // Generic get method
  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Generic put method
  async put(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Generic delete method
  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all records from a store
  async getAll(storeName, indexName = null, query = null) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      let request;
      if (indexName && query) {
        const index = store.index(indexName);
        request = index.getAll(query);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Clear entire store
  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ===== Current Session Methods =====

  async getCurrentSession() {
    const session = await this.get('currentSession', 'active');
    return session || null;
  }

  async saveCurrentSession(sessionData) {
    // OFFLINE FIRST: Save to IndexedDB immediately
    const result = await this.put('currentSession', {
      id: 'active',
      ...sessionData
    });

    // OPTIONAL: Sync to Firebase in background (non-blocking)
    this.syncToCloud('session', sessionData);

    return result;
  }

  async deleteCurrentSession() {
    // OFFLINE FIRST: Delete from IndexedDB immediately
    const result = await this.delete('currentSession', 'active');

    // OPTIONAL: Sync deletion to Firebase in background (non-blocking)
    this.syncToCloud('session-delete');

    return result;
  }

  // ===== Cloud Sync Methods (Offline First - Non-Blocking) =====

  syncToCloud(type, data) {
    // Fire-and-forget: Don't await, don't block
    // This runs in background, app continues immediately
    this._syncToCloudAsync(type, data).catch(err => {
      // Silent fail - offline first means we don't break on sync errors
      console.log(`Background sync failed (${type}):`, err.message);
    });
  }

  async _syncToCloudAsync(type, data) {
    // Check if Firebase is available
    if (typeof firebaseService === 'undefined' || !firebaseService.isInitialized) {
      console.log(`⏭️ Sync skipped (${type}): Firebase not initialized`);
      return; // No Firebase, skip silently
    }

    // Check if user wants cloud sync
    const settings = await this.getSettings();
    if (!settings.cloudSync) {
      console.log(`⏭️ Sync skipped (${type}): Cloud sync disabled in settings`);
      return; // Sync disabled, skip silently
    }

    // Check if user is signed in
    if (!firebaseService.isSignedIn()) {
      console.log(`⏭️ Sync skipped (${type}): User not signed in`);
      return; // Not signed in, skip silently
    }

    console.log(`🔄 Syncing to cloud (${type}):`, data?.id || data);

    // Perform sync based on type
    switch (type) {
      case 'worklog':
        await firebaseService.syncWorklogEntry(data);
        break;

      case 'worklog-delete':
        await firebaseService.deleteWorklogEntry(data);
        break;

      case 'session':
        await firebaseService.syncCurrentSession(data);
        break;

      case 'session-delete':
        // Delete current session from cloud
        if (firebaseService.currentUser) {
          await firebaseService.db
            .collection('users')
            .doc(firebaseService.currentUser.uid)
            .collection('sessions')
            .doc('current')
            .delete();
        }
        break;

      case 'settings':
        await firebaseService.syncSettings(data);
        break;

      default:
        console.warn('Unknown sync type:', type);
    }
  }

  // ===== Settings Methods =====

  async getSettings() {
    const settings = await this.get('settings', 'app');
    return settings ? settings.data : {
      username: 'Benutzer',
      language: 'de',
      surchargePercent: 80,
      email: 'daniel@liftec.at',
      emailSubject: 'Arbeitszeit {month} - {name}',
      emailBody: 'Hi Stefan. Anbei meine Arbeitszeit für {month}.',
      cloudSync: false  // Cloud sync disabled by default
    };
  }

  async saveSettings(settingsData) {
    // OFFLINE FIRST: Save to IndexedDB immediately
    const result = await this.put('settings', {
      key: 'app',
      data: settingsData
    });

    // OPTIONAL: Sync to Firebase in background (non-blocking)
    this.syncToCloud('settings', settingsData);

    return result;
  }

  // ===== Worklog Methods =====

  async addWorklogEntry(entry) {
    // Add yearMonth index for easier filtering
    const [day, month, year] = entry.date.split('.');
    entry.yearMonth = `${year}-${month.padStart(2, '0')}`;

    // OFFLINE FIRST: Save to IndexedDB immediately
    const id = await this.put('worklog', entry);

    // IMPORTANT: Add the ID that IndexedDB assigned to the entry
    entry.id = id;

    // OPTIONAL: Sync to Firebase in background (non-blocking)
    this.syncToCloud('worklog', entry);

    return id;
  }

  async getWorklogEntries(yearMonth = null) {
    if (yearMonth) {
      return await this.getAll('worklog', 'yearMonth', yearMonth);
    }
    return await this.getAll('worklog');
  }

  async getAllWorklogEntries() {
    return await this.getAll('worklog');
  }

  // Get entries for specific month
  async getMonthEntries(year, month) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    return await this.getWorklogEntries(yearMonth);
  }

  // Get entries by date range (for conflict checking)
  async getEntriesByDateRange(startDate, endDate) {
    const allEntries = await this.getAllWorklogEntries();

    // Convert DD.MM.YYYY to Date object for comparison
    const parseDate = (dateStr) => {
      const [day, month, year] = dateStr.split('.');
      return new Date(year, month - 1, day);
    };

    const start = parseDate(startDate);
    const end = parseDate(endDate);

    return allEntries.filter(entry => {
      const entryDate = parseDate(entry.date);
      return entryDate >= start && entryDate <= end;
    });
  }

  // Delete entries by date (for overwriting absences)
  async deleteEntriesByDate(date) {
    const allEntries = await this.getAllWorklogEntries();
    const entriesToDelete = allEntries.filter(entry => entry.date === date);

    for (const entry of entriesToDelete) {
      await this.deleteWorklogEntry(entry.id);
    }

    return entriesToDelete.length;
  }

  async updateWorklogEntry(entry) {
    // Update yearMonth index if date changed
    if (entry.date) {
      const [day, month, year] = entry.date.split('.');
      entry.yearMonth = `${year}-${month.padStart(2, '0')}`;
    }

    // OFFLINE FIRST: Save to IndexedDB immediately
    const result = await this.put('worklog', entry);

    // OPTIONAL: Sync to Firebase in background (non-blocking)
    this.syncToCloud('worklog', entry);

    return result;
  }

  async deleteWorklogEntry(id) {
    // OFFLINE FIRST: Delete from IndexedDB immediately
    const result = await this.delete('worklog', id);

    // OPTIONAL: Sync deletion to Firebase in background (non-blocking)
    this.syncToCloud('worklog-delete', id);

    return result;
  }

  // ===== Export/Import Methods =====

  async exportAllData() {
    const sessions = await this.getAll('sessions');
    const currentSession = await this.getCurrentSession();
    const settings = await this.getSettings();
    const worklog = await this.getAllWorklogEntries();

    return {
      version: this.version,
      exportDate: new Date().toISOString(),
      data: {
        sessions,
        currentSession,
        settings,
        worklog
      }
    };
  }

  async importData(importData) {
    if (!importData || !importData.data) {
      throw new Error('Invalid import data');
    }

    const { sessions, currentSession, settings, worklog } = importData.data;

    // Clear existing data
    await this.clear('sessions');
    await this.clear('currentSession');
    await this.clear('worklog');

    // Import sessions
    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        await this.put('sessions', session);
      }
    }

    // Import current session
    if (currentSession) {
      await this.saveCurrentSession(currentSession);
    }

    // Import settings
    if (settings) {
      await this.saveSettings(settings);
    }

    // Import worklog
    if (worklog && worklog.length > 0) {
      for (const entry of worklog) {
        await this.addWorklogEntry(entry);
      }
    }

    return true;
  }

  // ===== Utility Methods =====

  async getDatabaseSize() {
    if ('estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
      };
    }
    return null;
  }
}

// Create singleton instance
const storage = new Storage();
