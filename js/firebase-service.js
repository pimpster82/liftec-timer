// LIFTEC Timer - Firebase Service
// Handles authentication and cloud synchronization

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.currentUser = null;
    this.syncEnabled = false;
    this.isInitialized = false;
    this.listeners = [];
  }

  // Initialize Firebase
  async init() {
    try {
      // Check if Firebase is available
      if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded');
        return false;
      }

      // Initialize Firebase App
      this.app = firebase.initializeApp(window.FIREBASE_CONFIG);

      // Initialize Auth
      if (window.FIREBASE_FEATURES.auth) {
        this.auth = firebase.auth();

        // Auth state observer
        this.auth.onAuthStateChanged(async (user) => {
          this.currentUser = user;
          if (user) {
            console.log('User signed in:', user.uid);
            await this.onUserSignedIn(user);
          } else {
            console.log('User signed out');
            await this.onUserSignedOut();
          }
        });
      }

      // Initialize Firestore
      if (window.FIREBASE_FEATURES.firestore) {
        this.db = firebase.firestore();

        // Enable offline persistence
        if (window.FIREBASE_FEATURES.offline) {
          try {
            await firebase.firestore().enablePersistence({
              synchronizeTabs: true
            });
            console.log('Firestore offline persistence enabled');
          } catch (err) {
            if (err.code === 'failed-precondition') {
              console.warn('Persistence failed: multiple tabs open');
            } else if (err.code === 'unimplemented') {
              console.warn('Persistence not available in this browser');
            }
          }
        }
      }

      this.isInitialized = true;
      console.log('Firebase initialized successfully');
      return true;

    } catch (error) {
      console.error('Firebase initialization error:', error);
      return false;
    }
  }

  // ===== Authentication =====

  // Sign in anonymously
  async signInAnonymously() {
    try {
      const result = await this.auth.signInAnonymously();
      console.log('Anonymous sign-in successful');
      return result.user;
    } catch (error) {
      console.error('Anonymous sign-in error:', error);
      throw error;
    }
  }

  // Sign in with email and password
  async signInWithEmail(email, password) {
    try {
      const result = await this.auth.signInWithEmailAndPassword(email, password);
      console.log('Email sign-in successful');
      return result.user;
    } catch (error) {
      console.error('Email sign-in error:', error);
      throw error;
    }
  }

  // Create new account with email and password
  async createAccountWithEmail(email, password) {
    try {
      const result = await this.auth.createUserWithEmailAndPassword(email, password);
      console.log('Account created successfully');
      return result.user;
    } catch (error) {
      console.error('Account creation error:', error);
      throw error;
    }
  }

  // Sign out
  async signOut() {
    try {
      await this.auth.signOut();
      console.log('User signed out successfully');
    } catch (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
  }

  // Link anonymous account to email/password
  async linkAnonymousToEmail(email, password) {
    try {
      const credential = firebase.auth.EmailAuthProvider.credential(email, password);
      const result = await this.currentUser.linkWithCredential(credential);
      console.log('Anonymous account linked to email');
      return result.user;
    } catch (error) {
      console.error('Account linking error:', error);
      throw error;
    }
  }

  // ===== Helper Methods =====

  // Convert Firestore Timestamps to JavaScript-compatible values
  cleanFirestoreData(data) {
    if (!data) return data;

    const cleaned = { ...data };
    Object.keys(cleaned).forEach(key => {
      // Convert Firestore Timestamps to ISO strings
      if (cleaned[key] && typeof cleaned[key].toDate === 'function') {
        cleaned[key] = cleaned[key].toDate().toISOString();
      }
      // Remove undefined values
      if (cleaned[key] === undefined) {
        delete cleaned[key];
      }
    });
    return cleaned;
  }

  // ===== Firestore Sync =====

  // Sync worklog entry to cloud
  async syncWorklogEntry(entry) {
    if (!this.currentUser || !this.syncEnabled) {
      console.warn('❌ Sync failed: Not signed in or sync disabled');
      return false;
    }

    if (!entry.id) {
      console.error('❌ Sync failed: Entry has no ID!', entry);
      return false;
    }

    try {
      const docRef = this.db
        .collection('users')
        .doc(this.currentUser.uid)
        .collection('worklog')
        .doc(String(entry.id));

      await docRef.set({
        ...entry,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        syncedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      console.log('✅ Worklog entry synced to cloud:', entry.id);
      return true;
    } catch (error) {
      console.error('❌ Sync error:', error);
      return false;
    }
  }

  // Sync multiple worklog entries
  async syncWorklogEntries(entries) {
    if (!this.currentUser || !this.syncEnabled) {
      return { success: 0, failed: 0 };
    }

    const batch = this.db.batch();
    let count = 0;

    try {
      for (const entry of entries) {
        const docRef = this.db
          .collection('users')
          .doc(this.currentUser.uid)
          .collection('worklog')
          .doc(String(entry.id));

        batch.set(docRef, {
          ...entry,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          syncedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        count++;

        // Firestore batch limit is 500
        if (count >= 500) {
          await batch.commit();
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      console.log(`Synced ${entries.length} worklog entries`);
      return { success: entries.length, failed: 0 };

    } catch (error) {
      console.error('Batch sync error:', error);
      return { success: 0, failed: entries.length };
    }
  }

  // Delete worklog entry from cloud
  async deleteWorklogEntry(entryId) {
    if (!this.currentUser || !this.syncEnabled) {
      return false;
    }

    try {
      await this.db
        .collection('users')
        .doc(this.currentUser.uid)
        .collection('worklog')
        .doc(String(entryId))
        .delete();

      console.log('Worklog entry deleted from cloud:', entryId);
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      return false;
    }
  }

  // Sync current session
  async syncCurrentSession(session) {
    if (!this.currentUser || !this.syncEnabled) {
      return false;
    }

    try {
      await this.db
        .collection('users')
        .doc(this.currentUser.uid)
        .collection('sessions')
        .doc('current')
        .set({
          ...session,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      console.log('Current session synced');
      return true;
    } catch (error) {
      console.error('Session sync error:', error);
      return false;
    }
  }

  // Sync user settings
  async syncSettings(settings) {
    if (!this.currentUser || !this.syncEnabled) {
      return false;
    }

    try {
      await this.db
        .collection('users')
        .doc(this.currentUser.uid)
        .collection('data')
        .doc('settings')
        .set({
          ...settings,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      console.log('Settings synced');
      return true;
    } catch (error) {
      console.error('Settings sync error:', error);
      return false;
    }
  }

  // Pull data from cloud on sign-in
  async pullCloudData() {
    if (!this.currentUser) {
      return null;
    }

    try {
      const data = {
        worklog: [],
        session: null,
        settings: null
      };

      // Pull worklog
      const worklogSnapshot = await this.db
        .collection('users')
        .doc(this.currentUser.uid)
        .collection('worklog')
        .get();

      data.worklog = worklogSnapshot.docs.map(doc => {
        const id = parseInt(doc.id);
        if (isNaN(id)) {
          console.error(`Invalid worklog ID from Firestore: ${doc.id}`);
          return null;
        }
        return {
          id,
          ...this.cleanFirestoreData(doc.data())
        };
      }).filter(entry => entry !== null);

      // Pull current session
      const sessionDoc = await this.db
        .collection('users')
        .doc(this.currentUser.uid)
        .collection('sessions')
        .doc('current')
        .get();

      if (sessionDoc.exists) {
        data.session = this.cleanFirestoreData(sessionDoc.data());
      }

      // Pull settings
      const settingsDoc = await this.db
        .collection('users')
        .doc(this.currentUser.uid)
        .collection('data')
        .doc('settings')
        .get();

      if (settingsDoc.exists) {
        data.settings = this.cleanFirestoreData(settingsDoc.data());
      }

      console.log('Cloud data pulled successfully');
      return data;

    } catch (error) {
      console.error('Pull data error:', error);
      return null;
    }
  }

  // Subscribe to realtime updates
  subscribeToWorklog(callback) {
    if (!this.currentUser) {
      return null;
    }

    const unsubscribe = this.db
      .collection('users')
      .doc(this.currentUser.uid)
      .collection('worklog')
      .onSnapshot((snapshot) => {
        const changes = [];
        snapshot.docChanges().forEach((change) => {
          changes.push({
            type: change.type,
            id: parseInt(change.doc.id),
            data: change.doc.data()
          });
        });

        if (changes.length > 0) {
          callback(changes);
        }
      }, (error) => {
        console.error('Realtime listener error:', error);
      });

    this.listeners.push(unsubscribe);
    return unsubscribe;
  }

  // Unsubscribe from all listeners
  unsubscribeAll() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];
  }

  // ===== Event Handlers =====

  async onUserSignedIn(user) {
    // Check if sync is enabled in settings
    const localSettings = await storage.getSettings();
    this.syncEnabled = localSettings.cloudSync !== false;

    if (this.syncEnabled) {
      // Pull cloud data and merge with local
      const cloudData = await this.pullCloudData();

      if (cloudData) {
        // Merge strategy: Cloud data takes precedence for conflicts
        await this.mergeCloudData(cloudData);
      }

      // Start realtime sync
      this.startRealtimeSync();
    }
  }

  async onUserSignedOut() {
    this.syncEnabled = false;
    this.unsubscribeAll();
  }

  async mergeCloudData(cloudData) {
    // Merge worklog entries
    if (cloudData.worklog && cloudData.worklog.length > 0) {
      for (const entry of cloudData.worklog) {
        // Use put() directly instead of addWorklogEntry() because cloud entries already have IDs
        // addWorklogEntry() expects autoIncrement, which conflicts with existing IDs
        // cleanFirestoreData() already removed timestamps and cleaned the data
        await storage.put('worklog', entry);
      }
      console.log(`Merged ${cloudData.worklog.length} worklog entries from cloud`);
    }

    // Merge settings (cloud takes precedence)
    if (cloudData.settings) {
      // cleanFirestoreData() already removed timestamps
      await storage.saveSettings(cloudData.settings);
      console.log('Merged settings from cloud');
    }

    // Merge current session (cloud takes precedence)
    if (cloudData.session) {
      // cleanFirestoreData() already removed timestamps
      await storage.saveCurrentSession(cloudData.session);
      console.log('Merged current session from cloud');
    }
  }

  startRealtimeSync() {
    // Only start if sync is enabled
    if (!this.syncEnabled) {
      console.log('Realtime sync not started: sync disabled');
      return;
    }

    // Subscribe to worklog changes
    this.subscribeToWorklog(async (changes) => {
      for (const change of changes) {
        if (change.type === 'added' || change.type === 'modified') {
          // Clean Firestore data (convert timestamps, remove undefined)
          const cleanEntry = this.cleanFirestoreData(change.data);

          // Use put() directly because cloud entries already have IDs
          await storage.put('worklog', {
            id: change.id,
            ...cleanEntry
          });
        } else if (change.type === 'removed') {
          await storage.deleteWorklogEntry(change.id);
        }
      }
      console.log(`Processed ${changes.length} realtime changes`);
    });
  }

  // ===== Utility Methods =====

  isSignedIn() {
    return this.currentUser !== null;
  }

  isAnonymous() {
    return this.currentUser && this.currentUser.isAnonymous;
  }

  getUserId() {
    return this.currentUser ? this.currentUser.uid : null;
  }

  getUserEmail() {
    return this.currentUser ? this.currentUser.email : null;
  }

  enableSync() {
    this.syncEnabled = true;
  }

  disableSync() {
    this.syncEnabled = false;
    this.unsubscribeAll();
  }
}

// Create singleton instance
const firebaseService = new FirebaseService();
