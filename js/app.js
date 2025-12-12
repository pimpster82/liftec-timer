// LIFTEC Timer - Main Application

const APP_VERSION = '1.9.3';

const TASK_TYPES = {
  N: 'Neuanlage',
  D: 'Demontage',
  R: 'Reparatur',
  W: 'Wartung',
  '': 'Other'
};

class App {
  constructor() {
    this.session = null;
    this.durationInterval = null;
    this.deferredInstallPrompt = null;
    this.serviceWorkerRegistration = null;
  }

  // Initialize the app
  async init() {
    try {
      // Initialize storage
      await storage.init();

      // Load settings
      ui.settings = await storage.getSettings();

      // Initialize Firebase
      if (typeof firebaseService !== 'undefined') {
        await firebaseService.init();
        console.log('Firebase service initialized');

        // Setup shared entries listener if signed in
        if (firebaseService.isSignedIn()) {
          this.setupSharedEntriesListener();
        }
      }

      // Load current session
      this.session = await storage.getCurrentSession();

      // Register service worker
      await this.registerServiceWorker();

      // Check for updates
      this.checkForUpdates();

      // Setup install prompt
      this.setupInstallPrompt();

      // Check onboarding (only for new users)
      if (ui.settings.username === 'Benutzer' && !ui.settings.onboardingCompleted) {
        await this.showOnboarding();
      }

      // Render main screen
      await this.renderMainScreen();

      // Hide loading screen
      ui.hideLoading();

      // Start duration updater if session is active
      if (this.session) {
        this.startDurationUpdater();
      }

      // Setup event listeners
      this.setupEventListeners();

      // Setup File Handling API (for opening .liftec files)
      this.setupFileHandling();

      console.log(`LIFTEC Timer v${APP_VERSION} initialized`);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      ui.showToast('Fehler beim Laden der App', 'error');
    }
  }

  // ===== Service Worker & Updates =====

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('./sw.js');
        console.log('Service Worker registered');

        // Listen for updates
        this.serviceWorkerRegistration.addEventListener('updatefound', () => {
          const newWorker = this.serviceWorkerRegistration.installing;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              this.showUpdateAvailable();
            }
          });
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  // Check for updates (version.json)
  async checkForUpdates(silent = false) {
    try {
      // Also update service worker
      if (this.serviceWorkerRegistration) {
        this.serviceWorkerRegistration.update();
      }

      const response = await fetch('./version.json?t=' + Date.now());
      const remote = await response.json();

      // Store remote version for settings display
      this.remoteVersion = remote;

      if (remote.version !== APP_VERSION) {
        // Check if user dismissed this version
        const dismissedVersion = localStorage.getItem('dismissedUpdateVersion');
        const remindLater = localStorage.getItem('remindUpdateLater');

        if (dismissedVersion === remote.version) {
          console.log('Update available but dismissed by user:', remote.version);
          return { available: true, dismissed: true, remote };
        }

        if (remindLater) {
          const remindTime = parseInt(remindLater);
          if (Date.now() < remindTime) {
            console.log('Update available but remind later active');
            return { available: true, remindLater: true, remote };
          }
        }

        // Show update banner
        if (!silent) {
          this.showUpdateBanner(remote);
        }

        return { available: true, remote };
      } else {
        if (!silent) {
          console.log('App is up to date');
        }
        return { available: false, remote };
      }
    } catch (err) {
      console.log('Update check failed:', err);
      return { available: false, error: err };
    }
  }

  showUpdateBanner(updateInfo) {
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.className = 'fixed top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 max-w-xs border border-gray-200 dark:border-gray-700 transition-all';

    const firstChangelog = updateInfo.changelog && updateInfo.changelog.length > 0
      ? updateInfo.changelog[0]
      : 'Neue Version verfügbar';

    banner.innerHTML = `
      <div class="p-3">
        <!-- Collapsed State -->
        <div id="banner-collapsed">
          <button id="banner-expand-btn" class="w-full flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded p-1 -m-1">
            <div class="flex items-center gap-2">
              ${ui.icon('download', 'w-5 h-5 text-blue-500')}
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                Update v${updateInfo.version}
              </span>
            </div>
            ${ui.icon('chevron-down', 'w-4 h-4 text-gray-400')}
          </button>
        </div>

        <!-- Expanded State -->
        <div id="banner-expanded" class="hidden">
          <div class="flex items-center justify-between gap-3 mb-2">
            <div class="flex items-center gap-2">
              ${ui.icon('download', 'w-5 h-5 text-blue-500')}
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                Update v${updateInfo.version}
              </span>
            </div>
            <button id="banner-collapse-btn" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              ${ui.icon('chevron-up', 'w-4 h-4')}
            </button>
          </div>
          <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">${firstChangelog}</p>
          <div class="flex flex-col gap-2">
            <button id="update-now-btn" class="w-full px-3 py-2 bg-blue-500 text-white rounded text-sm font-semibold hover:bg-blue-600">
              Installieren
            </button>
            <div class="flex gap-2">
              <button id="update-info-btn" class="flex-1 text-xs text-blue-500 hover:underline">
                Mehr Info
              </button>
              ${!updateInfo.critical ? `
                <button id="update-skip-btn" class="flex-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                  Überspringen
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.prepend(banner);

    // Toggle expand/collapse
    document.getElementById('banner-expand-btn').addEventListener('click', () => {
      document.getElementById('banner-collapsed').classList.add('hidden');
      document.getElementById('banner-expanded').classList.remove('hidden');
    });

    document.getElementById('banner-collapse-btn').addEventListener('click', () => {
      document.getElementById('banner-expanded').classList.add('hidden');
      document.getElementById('banner-collapsed').classList.remove('hidden');
    });

    // Event listeners
    document.getElementById('update-now-btn').addEventListener('click', () => {
      this.performUpdate();
    });

    document.getElementById('update-info-btn').addEventListener('click', () => {
      banner.remove();
      this.showUpdateDetails(updateInfo);
    });

    if (!updateInfo.critical) {
      document.getElementById('update-skip-btn')?.addEventListener('click', () => {
        localStorage.setItem('remindUpdateLater', String(Date.now() + 24 * 60 * 60 * 1000));
        banner.remove();
      });
    }
  }

  showUpdateDetails(updateInfo) {
    const changelogHtml = updateInfo.changelog && updateInfo.changelog.length > 0
      ? updateInfo.changelog.map(item => `<li class="text-sm text-gray-700 dark:text-gray-300">• ${item}</li>`).join('')
      : '<li class="text-sm text-gray-500">Keine Details verfügbar</li>';

    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          ${ui.icon('info')}
          <span>Update v${updateInfo.version}</span>
        </h3>

        <div class="mb-4">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Veröffentlicht: ${updateInfo.releaseDate || 'Heute'}</p>
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Was ist neu:</h4>
          <ul class="space-y-1">${changelogHtml}</ul>
        </div>

        <div class="flex gap-2">
          <button id="details-update-btn" class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">
            Jetzt installieren
          </button>
          <button id="details-close-btn" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            Schließen
          </button>
        </div>
      </div>
    `;

    ui.showModal(content);

    document.getElementById('details-update-btn').addEventListener('click', () => {
      ui.hideModal();
      this.performUpdate();
    });

    document.getElementById('details-close-btn').addEventListener('click', () => {
      ui.hideModal();
    });
  }

  async performUpdate() {
    // Close any open modals before updating
    ui.hideModal();

    ui.showToast('Aktualisierung wird durchgeführt...', 'info');

    // Clear localStorage flags
    localStorage.removeItem('dismissedUpdateVersion');
    localStorage.removeItem('remindUpdateLater');

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('All caches cleared');
    }

    // Tell service worker to skip waiting if available
    if (this.serviceWorkerRegistration?.waiting) {
      this.serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // Hard reload
    setTimeout(() => {
      window.location.reload(true);
    }, 500);
  }

  showUpdateAvailable() {
    const updateBanner = document.getElementById('update-available');
    updateBanner?.classList.remove('hidden');

    document.getElementById('update-btn')?.addEventListener('click', () => {
      this.performUpdate();
    });
  }

  // ===== Shared Entries Notifications =====

  setupSharedEntriesListener() {
    if (!firebaseService.isSignedIn()) return;

    // Real-time listener for new shared entries
    this.sharedEntriesUnsubscribe = firebaseService.onSharedEntriesChange(async (sharedEntries) => {
      if (sharedEntries.length > 0) {
        // Check if this is a new notification (not from page load)
        const lastCheck = localStorage.getItem('lastSharedEntriesCheck');
        const now = Date.now();

        // Only show banner if we haven't checked in the last minute (avoid showing on every page load)
        if (!lastCheck || (now - parseInt(lastCheck)) > 60000) {
          this.showSharedEntriesBanner(sharedEntries.length);
        }

        localStorage.setItem('lastSharedEntriesCheck', String(now));
      }
    });
  }

  showSharedEntriesBanner(count) {
    // Remove existing banner if any
    document.getElementById('shared-entries-banner')?.remove();

    const banner = document.createElement('div');
    banner.id = 'shared-entries-banner';
    banner.className = 'fixed top-20 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 max-w-xs border border-green-200 dark:border-green-700 transition-all';

    banner.innerHTML = `
      <div class="p-3">
        <!-- Collapsed State -->
        <div id="shares-banner-collapsed">
          <button id="shares-banner-expand-btn" class="w-full flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded p-1 -m-1">
            <div class="flex items-center gap-2">
              ${ui.icon('inbox', 'w-5 h-5 text-green-500')}
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                ${count} ${ui.t('newShares')}
              </span>
            </div>
            ${ui.icon('chevron-down', 'w-4 h-4 text-gray-400')}
          </button>
        </div>

        <!-- Expanded State -->
        <div id="shares-banner-expanded" class="hidden">
          <div class="flex items-center justify-between gap-3 mb-2">
            <div class="flex items-center gap-2">
              ${ui.icon('inbox', 'w-5 h-5 text-green-500')}
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                ${count} ${ui.t('newShares')}
              </span>
            </div>
            <button id="shares-banner-collapse-btn" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              ${ui.icon('chevron-up', 'w-4 h-4')}
            </button>
          </div>
          <p class="text-xs text-gray-600 dark:text-gray-400 mb-3">
            ${ui.t('hasSharedEntries')}
          </p>
          <div class="flex flex-col gap-2">
            <button id="view-shares-btn" class="w-full px-3 py-2 bg-green-500 text-white rounded text-sm font-semibold hover:bg-green-600">
              ${ui.t('viewShares')}
            </button>
            <button id="dismiss-shares-btn" class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
              ${ui.t('dismiss')}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.prepend(banner);

    // Toggle expand/collapse
    document.getElementById('shares-banner-expand-btn').addEventListener('click', () => {
      document.getElementById('shares-banner-collapsed').classList.add('hidden');
      document.getElementById('shares-banner-expanded').classList.remove('hidden');
    });

    document.getElementById('shares-banner-collapse-btn').addEventListener('click', () => {
      document.getElementById('shares-banner-expanded').classList.add('hidden');
      document.getElementById('shares-banner-collapsed').classList.remove('hidden');
    });

    // View shares button
    document.getElementById('view-shares-btn').addEventListener('click', () => {
      banner.remove();
      this.showSharedEntriesInbox();
    });

    // Dismiss button
    document.getElementById('dismiss-shares-btn').addEventListener('click', () => {
      banner.remove();
    });
  }

  async showSharedEntriesInbox() {
    try {
      const sharedEntries = await firebaseService.getSharedEntries();

      const entriesHtml = sharedEntries.length > 0
        ? sharedEntries.map(share => `
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-2">
              <div class="flex items-start justify-between mb-2">
                <div>
                  <p class="text-xs text-gray-500 dark:text-gray-400">${ui.t('sharedBy')}: @${share.fromNickname} (${share.fromName})</p>
                  <p class="text-sm font-medium text-gray-900 dark:text-white mt-1">${share.entry.date}</p>
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    ${share.entry.startTime} - ${share.entry.endTime}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    ${share.entry.tasks?.length || 0} ${ui.t('tasks')}
                  </p>
                </div>
              </div>
              <div class="flex gap-2 mt-2">
                <button class="accept-share-btn flex-1 px-3 py-1.5 bg-green-500 text-white rounded text-xs font-semibold hover:bg-green-600" data-share-id="${share.id}">
                  ${ui.t('acceptShare')}
                </button>
                <button class="decline-share-btn px-3 py-1.5 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded text-xs hover:bg-gray-400 dark:hover:bg-gray-500" data-share-id="${share.id}">
                  ${ui.t('declineShare')}
                </button>
              </div>
            </div>
          `).join('')
        : `<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">${ui.t('noSharedEntries')}</p>`;

      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('inbox')}
            <span>${ui.t('sharedEntriesTitle')}</span>
          </h3>

          <div class="max-h-96 overflow-y-auto">
            ${entriesHtml}
          </div>

          <button id="inbox-close-btn" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('close')}
          </button>
        </div>
      `;

      ui.showModal(content);

      // Attach event listeners
      document.querySelectorAll('.accept-share-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const shareId = e.target.getAttribute('data-share-id');
          await this.acceptSharedEntry(shareId, sharedEntries);
        });
      });

      document.querySelectorAll('.decline-share-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const shareId = e.target.getAttribute('data-share-id');
          await this.declineSharedEntry(shareId);
        });
      });

      document.getElementById('inbox-close-btn').addEventListener('click', () => {
        ui.hideModal();
      });

    } catch (error) {
      console.error('Failed to load shared entries:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  async acceptSharedEntry(shareId, sharedEntries) {
    try {
      const share = sharedEntries.find(s => s.id === shareId);
      if (!share) return;

      // Check for duplicate
      const existingEntry = await storage.getWorklogEntryByDate(share.entry.date);

      if (existingEntry) {
        // Show duplicate warning dialog
        const choice = await this.showDuplicateEntryDialog(share.entry, existingEntry, `@${share.fromNickname} (${share.fromName})`);

        if (choice === 'cancel') {
          return;
        } else if (choice === 'overwrite') {
          // Replace existing entry
          await storage.updateWorklogEntry(existingEntry.id, share.entry);
        } else if (choice === 'keep-both') {
          // Add as new entry
          await storage.addWorklogEntry(share.entry);
        }
      } else {
        // No duplicate, just add
        await storage.addWorklogEntry(share.entry);
      }

      // Mark as imported in Firestore
      await firebaseService.markSharedEntryAsImported(shareId);

      ui.showToast(ui.t('entryImported'), 'success');
      ui.hideModal();

      // Refresh history if we're on that screen
      if (this.currentView === 'history') {
        await this.showHistory();
      }

    } catch (error) {
      console.error('Failed to accept shared entry:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  async declineSharedEntry(shareId) {
    try {
      await firebaseService.markSharedEntryAsDeclined(shareId);
      ui.showToast(ui.t('shareDeclined'), 'success');

      // Refresh inbox
      ui.hideModal();
      await this.showSharedEntriesInbox();

    } catch (error) {
      console.error('Failed to decline shared entry:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  // ===== Install Prompt =====

  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;

      // Show custom install UI
      const installPrompt = document.getElementById('install-prompt');
      installPrompt.classList.remove('hidden');

      document.getElementById('install-btn').addEventListener('click', async () => {
        if (this.deferredInstallPrompt) {
          this.deferredInstallPrompt.prompt();
          const { outcome } = await this.deferredInstallPrompt.userChoice;

          if (outcome === 'accepted') {
            console.log('App installed');
          }

          this.deferredInstallPrompt = null;
          installPrompt.classList.add('hidden');
        }
      });

      document.getElementById('install-dismiss').addEventListener('click', () => {
        installPrompt.classList.add('hidden');
      });
    });
  }

  // ===== Event Listeners =====

  setupEventListeners() {
    // Menu button - add icon
    const menuBtn = document.getElementById('menu-btn');
    menuBtn.innerHTML = ui.icon('menu', 'icon-lg');
    menuBtn.addEventListener('click', () => {
      this.showMenu();
    });

    // Handle URL actions (from shortcuts)
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    if (action === 'start') {
      this.startSession();
    }

    // Setup Pull-to-Refresh
    this.setupPullToRefresh();

    // Setup Double-click on title for desktop hard refresh
    const appTitle = document.getElementById('app-title');
    if (appTitle) {
      appTitle.addEventListener('dblclick', async () => {
        // Only enable if cloud sync is active
        if (firebaseService && firebaseService.currentUser && ui.settings && ui.settings.cloudSync) {
          const confirmed = await this.showConfirmDialog(
            'Daten neu laden?',
            'Dies löscht den lokalen Cache und lädt alle Daten vom Cloud neu. Die App wird danach neu geladen. Fortfahren?'
          );

          if (!confirmed) return;

          try {
            ui.showToast('Aktualisiere...', 'info');
            await this.performHardRefresh();
          } catch (error) {
            console.error('Hard refresh error:', error);
            ui.showToast('Fehler beim Aktualisieren', 'error');
          }
        }
      });
    }

    // Quick Export FAB (Floating Action Button)
    const quickExportFab = document.getElementById('quick-export-fab');
    if (quickExportFab) {
      quickExportFab.addEventListener('click', () => {
        this.quickExport();
      });
    }

    // Notes FAB (Floating Action Button) v1.6.1
    const notesFab = document.getElementById('notes-fab');
    if (notesFab) {
      notesFab.addEventListener('click', async () => {
        await this.showNotesManager();
      });
    }
  }

  setupPullToRefresh() {
    // Only enable pull-to-refresh if user is signed in and cloud sync is enabled
    const checkCloudSync = () => {
      return firebaseService &&
             firebaseService.currentUser &&
             ui.settings &&
             ui.settings.cloudSync;
    };

    let startY = 0;
    let currentY = 0;
    let pulling = false;
    const threshold = 80; // Pull distance needed to trigger refresh

    const pullIndicator = document.getElementById('pull-to-refresh');
    const refreshText = document.getElementById('refresh-text');
    const refreshSpinner = document.getElementById('refresh-spinner');
    const appContainer = document.getElementById('app');

    appContainer.addEventListener('touchstart', (e) => {
      // Only start if at top of scroll AND cloud sync enabled
      if (appContainer.scrollTop === 0 && checkCloudSync()) {
        startY = e.touches[0].pageY;
        pulling = true;
      }
    }, { passive: true });

    appContainer.addEventListener('touchmove', (e) => {
      if (!pulling || !checkCloudSync()) return;

      currentY = e.touches[0].pageY;
      const pullDistance = currentY - startY;

      // Only show indicator if pulling down
      if (pullDistance > 0) {
        const translateY = Math.min(pullDistance, threshold + 20);
        pullIndicator.style.transform = `translateY(${translateY - 100}%)`;

        if (pullDistance >= threshold) {
          refreshText.textContent = 'Loslassen zum Aktualisieren...';
        } else {
          refreshText.textContent = 'Zum Aktualisieren ziehen...';
        }
      }
    }, { passive: true });

    appContainer.addEventListener('touchend', async () => {
      if (!pulling || !checkCloudSync()) return;

      const pullDistance = currentY - startY;

      if (pullDistance >= threshold) {
        // Trigger refresh
        refreshText.textContent = 'Aktualisiere...';
        refreshSpinner.classList.remove('hidden');
        pullIndicator.style.transform = 'translateY(0)';

        try {
          await this.performHardRefresh();
        } catch (error) {
          console.error('Pull-to-refresh error:', error);
          ui.showToast('Fehler beim Aktualisieren', 'error');
        }

        // Reset indicator
        setTimeout(() => {
          pullIndicator.style.transform = 'translateY(-100%)';
          refreshSpinner.classList.add('hidden');
          refreshText.textContent = 'Zum Aktualisieren ziehen...';
        }, 500);
      } else {
        // Reset indicator
        pullIndicator.style.transform = 'translateY(-100%)';
      }

      pulling = false;
      startY = 0;
      currentY = 0;
    });
  }

  async performHardRefresh() {
    // Step 1: Unregister service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      console.log('✅ Service Worker unregistered');
    }

    // Step 2: Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('✅ All caches cleared');
    }

    // Step 3: Perform full sync from cloud
    const success = await firebaseService.fullSync();

    if (success) {
      ui.showToast('Daten erfolgreich neu geladen', 'success');

      // Step 4: Force reload from server (not cache)
      setTimeout(() => {
        window.location.href = window.location.href;
      }, 1000);
    } else {
      throw new Error('Sync failed');
    }
  }

  // ===== Main Screen =====

  async renderMainScreen() {
    ui.showScreen('main');

    // Get on-call status
    const onCallStatus = await this.getOnCallStatus();

    // Render hero card
    const heroCard = document.getElementById('hero-card');
    heroCard.innerHTML = ui.createHeroCard(this.session, onCallStatus);

    // Add event listener for on-call button if enabled in settings
    if (ui.settings?.onCallEnabled) {
      const onCallBtn = document.getElementById('oncall-btn');
      if (onCallBtn) {
        onCallBtn.addEventListener('click', () => this.toggleOnCallButton());
      }
    }

    // Add event listener for calendar button
    const calendarBtn = document.getElementById('hero-calendar-btn');
    if (calendarBtn) {
      calendarBtn.addEventListener('click', () => this.showCalendarView('hero'));
    }

    // Add event listener for time display toggle (if session is active)
    if (this.session) {
      const timeDisplay = document.getElementById('hero-time-display');
      if (timeDisplay) {
        timeDisplay.addEventListener('click', () => this.toggleHeroTimeDisplay());
      }
    }

    // Render session info
    const sessionInfo = document.getElementById('session-info');
    if (this.session && this.session.tasks && this.session.tasks.length > 0) {
      sessionInfo.innerHTML = `
        <div class="mb-4">
          <p class="text-xs text-gray-500 uppercase tracking-wide mb-2">${ui.t('tasks')}</p>
          <div class="space-y-2">
            ${this.session.tasks.map((task, idx) => this.renderTask(task, idx)).join('')}
          </div>
        </div>
      `;

      // Add event listeners for edit/delete buttons
      document.querySelectorAll('.task-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.currentTarget.dataset.index);
          this.editTask(index);
        });
      });

      document.querySelectorAll('.task-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.currentTarget.dataset.index);
          this.deleteTask(index);
        });
      });
    } else {
      sessionInfo.innerHTML = '';
    }

    // Render actions
    const actions = document.getElementById('actions');
    if (!this.session) {
      // No session - show start button and absence button
      actions.innerHTML = `
        <button id="start-btn" class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 rounded-lg flex items-center justify-center space-x-2 btn-press">
          ${ui.icon('play', 'icon-lg')}
          <span>${ui.t('startSession')}</span>
        </button>
        <button id="absence-btn" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg flex items-center justify-center space-x-2 btn-press mt-3">
          ${ui.icon('calendar', 'icon-lg')}
          <span>Abwesenheit eintragen</span>
        </button>
      `;

      document.getElementById('start-btn').addEventListener('click', () => this.startSession());
      document.getElementById('absence-btn').addEventListener('click', () => this.showAbsenceEntry());
    } else {
      // Active session - show add task and end session buttons
      actions.innerHTML = `
        <button id="add-task-btn" class="w-full bg-primary hover:bg-primary-dark text-gray-900 font-semibold py-4 rounded-lg flex items-center justify-center space-x-2 btn-press">
          ${ui.icon('plus', 'icon-lg')}
          <span>${ui.t('addTask')}</span>
        </button>
        <button id="end-btn" class="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-lg flex items-center justify-center space-x-2 btn-press">
          ${ui.icon('stop', 'icon-lg')}
          <span>${ui.t('endSession')}</span>
        </button>
      `;

      document.getElementById('add-task-btn').addEventListener('click', () => this.addTask());
      document.getElementById('end-btn').addEventListener('click', () => this.endSession());
    }
  }

  renderTask(task, index) {
    const typeLabel = task.type ? `<span class="badge ml-2">${task.type}</span>` : '';

    return `
      <div class="task-item bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center justify-between" data-index="${index}">
        <div class="flex-1">
          <p class="text-gray-900 dark:text-white">${task.description} ${typeLabel}</p>
        </div>
        <div class="flex gap-2">
          <button class="task-edit-btn text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1" data-index="${index}" title="Bearbeiten">
            ${ui.icon('edit')}
          </button>
          <button class="task-delete-btn text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1" data-index="${index}" title="Löschen">
            ${ui.icon('trash')}
          </button>
        </div>
      </div>
    `;
  }

  // ===== Duration Updater =====

  startDurationUpdater() {
    // Update every second
    this.durationInterval = setInterval(() => {
      if (this.session) {
        const durationElement = document.querySelector('.duration');
        const labelElement = document.querySelector('#hero-time-display .text-xs');

        if (durationElement) {
          // Check if we should show duration or start time
          const showStartTime = ui.settings?.heroTimeDisplay === 'startTime';
          if (showStartTime) {
            // For start time, we don't need to update every second (it's static)
            durationElement.textContent = ui.formatStartTime(this.session.start);
            if (labelElement) labelElement.textContent = ui.t('startTime').toUpperCase();
          } else {
            // For duration, update every second
            durationElement.textContent = ui.formatDuration(this.session.start);
            if (labelElement) labelElement.textContent = ui.t('duration').toUpperCase();
          }
        }
      }
    }, 1000);
  }

  stopDurationUpdater() {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  // ===== Session Management =====

  async startSession() {
    const startTime = await this.showDateTimePicker('Startzeit wählen', new Date());
    if (!startTime) return;

    this.session = {
      start: startTime.toISOString(),
      tasks: []
    };

    await storage.saveCurrentSession(this.session);
    await this.renderMainScreen();
    this.startDurationUpdater();

    ui.showToast('Sitzung gestartet', 'success');
  }

  async addTask() {
    // Show task type selector
    const taskType = await this.showTaskTypeSelector();
    if (taskType === null) return;

    // Show description input
    const description = await this.showInputDialog(ui.t('description'), '');
    if (!description) return;

    this.session.tasks.push({
      type: taskType,
      description: description.trim()
    });

    await storage.saveCurrentSession(this.session);
    await this.renderMainScreen();

    ui.showToast('Aufgabe hinzugefügt', 'success');
  }

  async editTask(index) {
    if (!this.session || !this.session.tasks[index]) return;

    const task = this.session.tasks[index];

    // Show task type selector
    const taskType = await this.showTaskTypeSelector(task.type);
    if (taskType === null) return;

    // Show description input
    const description = await this.showInputDialog(ui.t('description'), task.description);
    if (!description) return;

    this.session.tasks[index] = {
      type: taskType,
      description: description.trim()
    };

    await storage.saveCurrentSession(this.session);
    await this.renderMainScreen();

    ui.showToast('Aufgabe aktualisiert', 'success');
  }

  async deleteTask(index) {
    if (!this.session || !this.session.tasks[index]) return;

    const confirmed = await this.showConfirmDialog('Aufgabe löschen?', 'Diese Aktion kann nicht rückgängig gemacht werden.');
    if (!confirmed) return;

    this.session.tasks.splice(index, 1);

    await storage.saveCurrentSession(this.session);
    await this.renderMainScreen();

    ui.showToast('Aufgabe gelöscht', 'success');
  }

  async endSession() {
    // Show end time picker
    const endTime = await this.showDateTimePicker('Endzeit wählen', new Date());
    if (!endTime) return;

    const startTime = new Date(this.session.start);

    if (endTime <= startTime) {
      ui.showToast('Endzeit muss nach Startzeit liegen', 'error');
      return;
    }

    // Get pause and travel time with new picker
    const times = await this.showPauseTravelPicker(0.5, 0.5);
    if (!times) return;

    const pauseHours = times.pause;
    const travelHours = times.travel;

    const totalHours = (endTime - startTime) / 3600000;
    const netHours = totalHours - pauseHours - travelHours;

    if (netHours < 0) {
      ui.showToast('Pause + Fahrtzeit größer als Gesamtzeit', 'error');
      return;
    }

    // Calculate surcharge
    let surchargePercent = ui.settings.surchargePercent;

    // Check for office tasks
    const hasOfficeTask = this.session.tasks.some(t =>
      t.type === '' ||
      t.description.toLowerCase().includes('office') ||
      t.description.toLowerCase().includes('büro')
    );

    if (hasOfficeTask) {
      const customSurcharge = await this.showInputDialog(
        `Büro-Aufgabe erkannt. Zuschlag anpassen? (Standard: ${surchargePercent}%)`,
        String(surchargePercent)
      );

      if (customSurcharge !== null) {
        const custom = parseFloat(customSurcharge.replace(',', '.'));
        if (!isNaN(custom) && custom >= 0 && custom <= 200) {
          surchargePercent = custom;
        }
      }
    }

    const surchargeHours = Math.round(netHours * (surchargePercent / 100) * 2) / 2;

    // Show summary
    const confirmed = await this.showSessionSummary({
      startTime,
      endTime,
      pauseHours,
      travelHours,
      netHours,
      surchargePercent,
      surchargeHours,
      tasks: this.session.tasks
    });

    if (!confirmed) return;

    // Save to worklog
    const entry = {
      date: ui.formatDate(startTime),
      startTime: ui.formatTime(startTime),
      endTime: ui.formatTime(endTime),
      pause: ui.hoursToHHMM(pauseHours),
      travelTime: ui.hoursToHHMM(travelHours),
      surcharge: ui.hoursToHHMM(surchargeHours),
      tasks: this.session.tasks
    };

    await storage.addWorklogEntry(entry);
    await storage.deleteCurrentSession();

    this.session = null;
    this.stopDurationUpdater();

    await this.renderMainScreen();
    ui.showToast('Sitzung gespeichert', 'success');
  }

  // ===== On-Call Management =====

  /**
   * Get current on-call status from storage
   * Returns the active period for UI display (or a default inactive period if none)
   */
  async getOnCallStatus() {
    try {
      // Get active period only (for UI display)
      const activePeriod = await storage.getActiveOnCall();

      // If no active period, return default inactive status
      if (!activePeriod) {
        return {
          id: null,
          active: false,
          startDate: null,
          startTime: null,
          endDate: null,
          endTime: null
        };
      }

      // Return active period
      return activePeriod;
    } catch (error) {
      console.error('Error getting on-call status:', error);
      return {
        id: null,
        active: false,
        startDate: null,
        startTime: null,
        endDate: null,
        endTime: null
      };
    }
  }

  /**
   * Toggle hero card time display between duration and start time
   */
  async toggleHeroTimeDisplay() {
    try {
      // Ensure settings are loaded
      if (!ui.settings) {
        ui.settings = await storage.getSettings();
      }

      // Toggle between 'duration' and 'startTime'
      const currentDisplay = ui.settings?.heroTimeDisplay || 'duration';
      const newDisplay = currentDisplay === 'duration' ? 'startTime' : 'duration';

      // Update settings
      ui.settings.heroTimeDisplay = newDisplay;
      await storage.saveSettings(ui.settings);

      // Re-render main screen to update display
      await this.renderMainScreen();

      // Restart duration updater if session is active
      if (this.session) {
        this.stopDurationUpdater();  // Stop old interval first
        this.startDurationUpdater();
      }
    } catch (error) {
      console.error('Error toggling time display:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  /**
   * Show calendar view
   * @param {string} source - 'hero' or 'history' to track where the view was opened from
   */
  async showCalendarView(source = 'hero') {
    try {
      // Get all worklog entries
      const entries = await storage.getAllWorklogEntries();

      // Determine which view preference to use
      const viewPrefKey = source === 'hero' ? 'heroCalendarView' : 'historyView';
      const currentView = ui.settings[viewPrefKey] || 'calendar';

      // Show calendar view
      await this.renderCalendarView(entries, source);
    } catch (error) {
      console.error('Error showing calendar view:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  /**
   * Render calendar view for a given month
   * @param {Array} entries - All worklog entries
   * @param {string} source - 'hero' or 'history'
   * @param {Date} monthDate - The month to display (defaults to current month)
   */
  async renderCalendarView(entries, source = 'hero', monthDate = new Date()) {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    // Get first and last day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
    // Adjust so Monday = 0, Sunday = 6
    let firstDayOfWeek = firstDay.getDay() - 1;
    if (firstDayOfWeek === -1) firstDayOfWeek = 6;

    // Build calendar grid
    const daysInMonth = lastDay.getDate();
    const calendarDays = [];

    // Add empty cells for days before first day of month
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarDays.push({ empty: true });
    }

    // Add all days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = ui.formatDate(date);

      // Check if there's an entry for this day and what type
      const entry = entries.find(e => e.date === dateStr);
      const hasEntry = !!entry;

      // Determine entry type
      let entryType = null;
      if (entry && entry.tasks && entry.tasks.length > 0) {
        const task = entry.tasks[0];
        // Absence entries have empty type and description contains absence type
        if (task.type === '' && task.description) {
          entryType = task.description; // Urlaub, Krankenstand, Zeitausgleich, Feiertag
        } else {
          entryType = 'work'; // Normal work entry
        }
      }

      // Check if it's a weekend
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Check if it's today
      const today = new Date();
      const isToday = date.getDate() === today.getDate() &&
                      date.getMonth() === today.getMonth() &&
                      date.getFullYear() === today.getFullYear();

      calendarDays.push({
        day,
        date: dateStr,
        hasEntry,
        entryType,
        isWeekend,
        isToday,
        dateObj: date
      });
    }

    // Create calendar HTML
    const monthNames = ui.t('monthNames');
    const weekdayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    const calendarHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <button id="calendar-prev-month" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 btn-press">
            ${ui.icon('chevron-left', 'w-6 h-6')}
          </button>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            ${monthNames[month]} ${year}
          </h3>
          <button id="calendar-next-month" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 btn-press">
            ${ui.icon('chevron-right', 'w-6 h-6')}
          </button>
        </div>

        <!-- Weekday headers -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          ${weekdayNames.map(day => `
            <div class="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 py-1">
              ${day}
            </div>
          `).join('')}
        </div>

        <!-- Calendar days -->
        <div class="grid grid-cols-7 gap-1 mb-4">
          ${calendarDays.map(dayInfo => {
            if (dayInfo.empty) {
              return '<div class="aspect-square"></div>';
            }

            let bgClass = 'bg-gray-100 dark:bg-gray-800';
            let textClass = 'text-gray-900 dark:text-white';

            // Set colors based on entry type
            if (dayInfo.hasEntry && dayInfo.entryType) {
              switch (dayInfo.entryType) {
                case 'work':
                  bgClass = 'bg-green-100 dark:bg-green-900';
                  textClass = 'text-green-900 dark:text-green-100';
                  break;
                case 'Urlaub':
                  bgClass = 'bg-blue-100 dark:bg-blue-900';
                  textClass = 'text-blue-900 dark:text-blue-100';
                  break;
                case 'Krankenstand':
                  bgClass = 'bg-red-100 dark:bg-red-900';
                  textClass = 'text-red-900 dark:text-red-100';
                  break;
                case 'Zeitausgleich':
                  bgClass = 'bg-purple-100 dark:bg-purple-900';
                  textClass = 'text-purple-900 dark:text-purple-100';
                  break;
                case 'Feiertag':
                  bgClass = 'bg-yellow-100 dark:bg-yellow-900';
                  textClass = 'text-yellow-900 dark:text-yellow-100';
                  break;
                default:
                  bgClass = 'bg-green-100 dark:bg-green-900';
                  textClass = 'text-green-900 dark:text-green-100';
              }
            } else if (dayInfo.isWeekend) {
              bgClass = 'bg-gray-200 dark:bg-gray-700';
              textClass = 'text-gray-600 dark:text-gray-400';
            }

            if (dayInfo.isToday) {
              bgClass += ' ring-2 ring-primary';
            }

            return `
              <button class="calendar-day aspect-square ${bgClass} ${textClass} rounded-lg flex items-center justify-center text-sm font-semibold hover:opacity-80 transition-opacity btn-press"
                      data-date="${dayInfo.date}"
                      ${!dayInfo.hasEntry ? 'disabled' : ''}>
                ${dayInfo.day}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <button id="dialog-ok" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
            ${ui.t('close')}
          </button>
        </div>
      </div>
    `;

    ui.showModal(calendarHTML);

    // Add event listeners
    document.getElementById('calendar-prev-month').addEventListener('click', () => {
      const prevMonth = new Date(year, month - 1, 1);
      this.renderCalendarView(entries, source, prevMonth);
    });

    document.getElementById('calendar-next-month').addEventListener('click', () => {
      const nextMonth = new Date(year, month + 1, 1);
      this.renderCalendarView(entries, source, nextMonth);
    });

    // Click on day to show entry details
    document.querySelectorAll('.calendar-day').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const date = e.currentTarget.dataset.date;
        const entry = entries.find(e => e.date === date);
        if (entry) {
          ui.hideModal();
          await this.editWorklogEntry(entry);
          // Refresh calendar after editing
          await this.showCalendarView(source);
        }
      });
    });

    document.getElementById('dialog-ok').addEventListener('click', () => {
      ui.hideModal();
    });
  }

  /**
   * Toggle on-call button - start if inactive, end if active
   */
  async toggleOnCallButton() {
    try {
      const status = await this.getOnCallStatus();

      if (status.active) {
        // On-call is active, show end dialog
        await this.endOnCall();
      } else {
        // On-call is inactive, show start dialog
        await this.startOnCall();
      }
    } catch (error) {
      console.error('Error toggling on-call:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  /**
   * Start on-call period
   */
  async startOnCall() {
    try {
      // Show date-time picker for start
      const startDateTime = await this.showDateTimePicker(ui.t('onCallStartFrom'), new Date());
      if (!startDateTime) return;

      // Extract date and time
      const startDate = ui.formatDate(startDateTime);
      const startTime = ui.formatTime(startDateTime);

      // Save to storage (creates new period with auto-incrementing ID)
      const result = await storage.startOnCall(startDate, startTime);

      // Update UI
      await this.renderMainScreen();

      // Show success message with period number
      ui.showToast(`${ui.t('onCallActive')} #${result.periodId}`, 'success');
    } catch (error) {
      console.error('Error starting on-call:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  /**
   * End on-call period and calculate total on-call time
   */
  async endOnCall() {
    try {
      // Get current on-call status
      const status = await this.getOnCallStatus();
      if (!status.active) {
        ui.showToast('Keine aktive Bereitschaft', 'error');
        return;
      }

      // Show date-time picker for end
      const endDateTime = await this.showDateTimePicker(ui.t('onCallEndAt'), new Date());
      if (!endDateTime) return;

      // Extract date and time
      const endDate = ui.formatDate(endDateTime);
      const endTime = ui.formatTime(endDateTime);

      // Validate end time is after start time
      const startDateTime = this.parseDateTime(status.startDate, status.startTime);
      if (endDateTime <= startDateTime) {
        ui.showToast('Endzeit muss nach Startzeit liegen', 'error');
        return;
      }

      // Calculate on-call time
      const onCallHours = await this.calculateOnCallTime(status.startDate, status.startTime, endDate, endTime);

      // Show summary for confirmation (BEFORE saving)
      const summary = ui.t('onCallSummary')
        .replace('{start}', `${status.startDate} ${status.startTime}`)
        .replace('{end}', `${endDate} ${endTime}`);
      const total = ui.t('onCallTotal').replace('{hours}', ui.hoursToHHMM(onCallHours));
      const periodNumber = status.id;

      // Show confirmation dialog with period number
      const dialogContent = `
        <div style="padding: 20px;">
          <h3 style="margin-bottom: 15px; font-weight: bold;">${ui.t('onCallEnded')} #${periodNumber}</h3>
          <p style="margin-bottom: 10px;">${summary}</p>
          <p style="font-weight: bold;">${total}</p>
          <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button id="confirm-ok-btn" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">OK</button>
          </div>
        </div>
      `;

      ui.showModal(dialogContent);

      // Wait for user to click OK
      await new Promise((resolve) => {
        document.getElementById('confirm-ok-btn').addEventListener('click', resolve);
      });

      // Close dialog
      ui.hideModal();

      // Now save end time to storage (keeps data for export)
      const result = await storage.endOnCall(endDate, endTime);
      // Don't clear - we need the data for CSV/Excel export!

      // Update UI
      await this.renderMainScreen();
      ui.showToast(`${ui.t('onCallEnded')} #${result.periodId}`, 'success');
    } catch (error) {
      console.error('Error ending on-call:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  /**
   * Calculate on-call time (24h - actual work hours during period)
   * @param {string} startDate - Start date in DD.MM.YYYY format
   * @param {string} startTime - Start time in HH:MM format
   * @param {string} endDate - End date in DD.MM.YYYY format
   * @param {string} endTime - End time in HH:MM format
   * @returns {number} On-call hours
   */
  async calculateOnCallTime(startDate, startTime, endDate, endTime) {
    try {
      // Parse start and end date-time
      const start = this.parseDateTime(startDate, startTime);
      const end = this.parseDateTime(endDate, endTime);

      // Calculate total hours in the period
      const totalHours = (end - start) / 3600000; // milliseconds to hours

      // Get all worklog entries in the date range
      const entries = await storage.getEntriesByDateRange(startDate, endDate);

      // Sum up actual work hours (endTime - startTime, not including pause/travel)
      let workHours = 0;
      for (const entry of entries) {
        if (entry.startTime && entry.endTime) {
          // Parse HH:MM format to decimal hours
          const [startH, startM] = entry.startTime.split(':').map(Number);
          const [endH, endM] = entry.endTime.split(':').map(Number);
          const startHours = startH + (startM / 60);
          const endHours = endH + (endM / 60);

          // Calculate work hours for this day
          const dayWork = endHours - startHours;
          workHours += dayWork;
        }
      }

      // On-call time = Total time - Work time
      const onCallHours = Math.max(0, totalHours - workHours);

      return onCallHours;
    } catch (error) {
      console.error('Error calculating on-call time:', error);
      return 0;
    }
  }

  /**
   * Parse date and time strings to Date object
   * @param {string} dateStr - Date in DD.MM.YYYY format
   * @param {string} timeStr - Time in HH:MM format
   * @returns {Date} Date object
   */
  parseDateTime(dateStr, timeStr) {
    const [day, month, year] = dateStr.split('.').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }

  // ===== Absence Entry =====

  async showAbsenceEntry() {
    // Step 1: Choose absence type
    const absenceType = await this.showAbsenceTypeDialog();
    if (!absenceType) return;

    // Step 2: Choose period type (single day or range)
    const periodType = await this.showPeriodTypeDialog();
    if (!periodType) return;

    // Step 3: Choose date(s)
    let startDate, endDate;

    if (periodType === 'single') {
      startDate = await this.showDatePicker('Datum wählen');
      if (!startDate) return;
      endDate = startDate;
    } else {
      startDate = await this.showDatePicker('Von (Datum)');
      if (!startDate) return;

      endDate = await this.showDatePicker('Bis (Datum)');
      if (!endDate) return;

      // Validate date range
      if (endDate < startDate) {
        ui.showToast('End-Datum muss nach Start-Datum liegen', 'error');
        return;
      }
    }

    // Format dates to DD.MM.YYYY
    const formatDate = (date) => {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    // Step 4: Check for conflicts
    const conflicts = await storage.getEntriesByDateRange(startDateStr, endDateStr);

    if (conflicts.length > 0) {
      const action = await this.showConflictDialog(conflicts);

      if (action === 'cancel') {
        return;
      } else if (action === 'reselect') {
        // Restart flow
        return this.showAbsenceEntry();
      } else if (action === 'overwrite') {
        // Delete conflicting entries
        for (const conflict of conflicts) {
          await storage.deleteWorklogEntry(conflict.id);
        }
      }
    }

    // Step 5: Save absence entries
    const entries = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate);

      const entry = {
        date: dateStr,
        startTime: '',
        endTime: '',
        pause: '',
        travelTime: '',
        surcharge: '',
        tasks: [{ type: '', description: absenceType }]
      };

      entries.push(entry);
      await storage.addWorklogEntry(entry);

      currentDate.setDate(currentDate.getDate() + 1);
    }

    await this.renderMainScreen();
    ui.showToast(`${entries.length} Abwesenheitseintrag/e gespeichert`, 'success');
  }

  async showAbsenceTypeDialog() {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('calendar')}
            <span>Abwesenheit eintragen</span>
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Art wählen:</p>
          <div class="space-y-2">
            <button class="absence-type-btn w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2" data-type="Urlaub">
              ${ui.icon('sun')}
              <span>Urlaub</span>
            </button>
            <button class="absence-type-btn w-full px-4 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 flex items-center justify-center gap-2" data-type="Zeitausgleich">
              ${ui.icon('clock')}
              <span>Zeitausgleich</span>
            </button>
            <button class="absence-type-btn w-full px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 flex items-center justify-center gap-2" data-type="Krankenstand">
              ${ui.icon('heart-pulse')}
              <span>Krankenstand</span>
            </button>
            <button class="absence-type-btn w-full px-4 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 flex items-center justify-center gap-2" data-type="Feiertag">
              ${ui.icon('star')}
              <span>Feiertag</span>
            </button>
          </div>
          <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            Abbrechen
          </button>
        </div>
      `;

      ui.showModal(content);

      document.querySelectorAll('.absence-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const type = btn.getAttribute('data-type');
          ui.hideModal();
          resolve(type);
        });
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(null);
      });
    });
  }

  async showPeriodTypeDialog() {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('calendar')}
            <span>Zeitraum wählen</span>
          </h3>
          <div class="space-y-2">
            <button id="period-single" class="w-full px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
              ${ui.icon('calendar-day')}
              <span>Einzelner Tag</span>
            </button>
            <button id="period-range" class="w-full px-4 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 flex items-center justify-center gap-2">
              ${ui.icon('calendar-range')}
              <span>Zeitraum (Von-Bis)</span>
            </button>
          </div>
          <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            Abbrechen
          </button>
        </div>
      `;

      ui.showModal(content);

      document.getElementById('period-single').addEventListener('click', () => {
        ui.hideModal();
        resolve('single');
      });

      document.getElementById('period-range').addEventListener('click', () => {
        ui.hideModal();
        resolve('range');
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(null);
      });
    });
  }

  showDatePicker(title) {
    return new Promise((resolve) => {
      const today = new Date().toISOString().split('T')[0];

      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">${title}</h3>
          <input type="date" id="date-input" value="${today}"
                 class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <div class="flex space-x-3">
            <button id="dialog-cancel" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('cancel')}
            </button>
            <button id="dialog-ok" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
              OK
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      document.getElementById('dialog-ok').addEventListener('click', () => {
        const value = document.getElementById('date-input').value;
        ui.hideModal();
        resolve(value ? new Date(value) : null);
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(null);
      });
    });
  }

  async showConflictDialog(conflicts) {
    return new Promise((resolve) => {
      // Build conflict list
      const conflictList = conflicts.map(c => `
        <div class="text-sm text-gray-700 dark:text-gray-300 py-2 border-b border-gray-200 dark:border-gray-700">
          <strong>${c.date}</strong>
          ${c.startTime && c.endTime ? `<br/><span class="text-gray-500">${c.startTime} - ${c.endTime}</span>` : ''}
          ${c.tasks && c.tasks.length > 0 ? `<br/><span class="text-gray-500">${c.tasks.map(t => t.description).join(', ')}</span>` : ''}
        </div>
      `).join('');

      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('exclamation-triangle')}
            <span>Konflikt erkannt</span>
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Für folgende Tage existieren bereits Einträge:
          </p>
          <div class="max-h-48 overflow-y-auto mb-4 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            ${conflictList}
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Was möchtest du tun?</p>
          <div class="space-y-2">
            <button id="conflict-overwrite" class="w-full px-4 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 flex items-center justify-center gap-2">
              ${ui.icon('refresh')}
              <span>Überschreiben</span>
            </button>
            <button id="conflict-reselect" class="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2">
              ${ui.icon('pencil')}
              <span>Neu wählen</span>
            </button>
            <button id="conflict-cancel" class="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center gap-2">
              ${ui.icon('x')}
              <span>Abbrechen</span>
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      document.getElementById('conflict-overwrite').addEventListener('click', () => {
        ui.hideModal();
        resolve('overwrite');
      });

      document.getElementById('conflict-reselect').addEventListener('click', () => {
        ui.hideModal();
        resolve('reselect');
      });

      document.getElementById('conflict-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve('cancel');
      });
    });
  }

  // ===== Onboarding =====

  async showOnboarding() {
    let currentStep = 1;
    const totalSteps = 4;
    const onboardingData = {
      username: '',
      language: 'de',
      surchargePercent: 80,
      email: ''
    };

    // Step 1: Name
    const nameResult = await this.showOnboardingStep({
      step: currentStep++,
      total: totalSteps,
      title: ui.t('onboardingNameTitle'),
      description: ui.t('onboardingNameDesc'),
      type: 'text',
      placeholder: ui.t('onboardingNamePlaceholder'),
      required: true,
      value: onboardingData.username
    });
    if (!nameResult) return; // User cancelled
    onboardingData.username = nameResult;

    // Update UI language for next steps
    ui.settings.username = nameResult;
    ui.settings.language = onboardingData.language;
    ui.i18n = ui.getI18N();

    // Step 2: Language
    const langResult = await this.showOnboardingStep({
      step: currentStep++,
      total: totalSteps,
      title: ui.t('onboardingLanguageTitle'),
      description: ui.t('onboardingLanguageDesc'),
      type: 'select',
      options: [
        { value: 'de', label: 'Deutsch' },
        { value: 'en', label: 'English' },
        { value: 'hr', label: 'Hrvatski' }
      ],
      required: true,
      value: onboardingData.language
    });
    if (!langResult) return;
    onboardingData.language = langResult;

    // Update language immediately
    ui.settings.language = langResult;
    ui.i18n = ui.getI18N();

    // Step 3: Email
    const emailResult = await this.showOnboardingStep({
      step: currentStep++,
      total: totalSteps,
      title: ui.t('onboardingEmailTitle'),
      description: ui.t('onboardingEmailDesc'),
      type: 'email',
      placeholder: ui.t('onboardingEmailPlaceholder'),
      required: false,
      value: onboardingData.email
    });
    if (emailResult !== null) {
      onboardingData.email = emailResult || ui.settings.email;
    }

    // Step 4: Surcharge
    const surchargeResult = await this.showOnboardingStep({
      step: currentStep++,
      total: totalSteps,
      title: ui.t('onboardingSurchargeTitle'),
      description: ui.t('onboardingSurchargeDesc'),
      type: 'number',
      placeholder: ui.t('onboardingSurchargePlaceholder'),
      required: true,
      value: onboardingData.surchargePercent,
      isLast: true
    });
    if (!surchargeResult) return;
    onboardingData.surchargePercent = parseInt(surchargeResult);

    // Show summary before completion
    const languageName = {
      de: 'Deutsch',
      en: 'English',
      hr: 'Hrvatski'
    }[onboardingData.language];

    const summaryHTML = `
      <div class="text-center mb-8">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          ${ui.t('onboardingWelcome')}
        </h2>
        <p class="text-gray-600 dark:text-gray-300">${ui.t('onboardingSummaryTitle')}</p>
      </div>

      <div class="space-y-4 mb-8 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <div class="flex items-center justify-between">
          <span class="text-gray-700 dark:text-gray-300">${ui.t('onboardingSummaryName')}</span>
          <span class="font-semibold text-gray-900 dark:text-white">${onboardingData.username}</span>
        </div>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div class="flex items-center justify-between">
            <span class="text-gray-700 dark:text-gray-300">${ui.t('onboardingSummaryLanguage')}</span>
            <span class="font-semibold text-gray-900 dark:text-white">${languageName}</span>
          </div>
        </div>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div class="flex items-center justify-between">
            <span class="text-gray-700 dark:text-gray-300">${ui.t('onboardingSummarySurcharge')}</span>
            <span class="font-semibold text-gray-900 dark:text-white">${onboardingData.surchargePercent}%</span>
          </div>
        </div>
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div class="flex items-center justify-between">
            <span class="text-gray-700 dark:text-gray-300">${ui.t('onboardingSummaryEmail')}</span>
            <span class="font-semibold text-gray-900 dark:text-white">${onboardingData.email || ui.t('onboardingSummaryNotSet')}</span>
          </div>
        </div>
      </div>

      <p class="text-sm text-gray-600 dark:text-gray-300 mb-6 text-center">
        ${ui.t('onboardingSummaryNote')}
      </p>

      <div class="flex gap-3">
        <button id="summary-back-btn" class="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium">
          ${ui.t('onboardingSummaryBack')}
        </button>
        <button id="summary-confirm-btn" class="flex-1 px-4 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors font-medium">
          ${ui.t('onboardingSummaryConfirm')}
        </button>
      </div>
    `;

    return new Promise((resolve) => {
      ui.showModal(summaryHTML);

      document.getElementById('summary-back-btn').addEventListener('click', () => {
        ui.hideModal();
        resolve(false); // Go back
      });

      document.getElementById('summary-confirm-btn').addEventListener('click', () => {
        ui.hideModal();
        resolve(true); // Proceed to save
      });
    }).then(async (confirmed) => {
      if (!confirmed) {
        // User went back - show surcharge step again
        await this.showOnboarding();
        return;
      }

      // Save settings
      const newSettings = {
        ...ui.settings,
        ...onboardingData,
        onboardingCompleted: true
      };

      await storage.saveSettings(newSettings);
      ui.settings = newSettings;
      ui.showToast('Willkommen! 👋', 'success');
    });
  }

  async showOnboardingStep(config) {
    return new Promise((resolve) => {
      const stepText = ui.t('onboardingStep')
        .replace('{current}', config.step)
        .replace('{total}', config.total);

      const inputHTML = config.type === 'select'
        ? `<select id="onboarding-input" class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            ${config.options.map(opt => `<option value="${opt.value}" ${opt.value === config.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
          </select>`
        : `<input type="${config.type}" id="onboarding-input" value="${config.value || ''}" placeholder="${config.placeholder}"
            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white">`;

      const content = `
        <div class="p-6">
          <div class="text-center mb-6">
            <h2 class="text-2xl font-bold text-primary mb-2">${ui.t('onboardingWelcome')}</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">${stepText}</p>
          </div>

          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">${config.title}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${config.description}</p>
            ${inputHTML}
            ${config.required ? `<p id="error-msg" class="text-sm text-red-500 mt-1 hidden">${ui.t('onboardingRequired')}</p>` : ''}
          </div>

          <button id="onboarding-next" class="w-full px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
            ${config.isLast ? ui.t('onboardingFinish') : ui.t('onboardingNext')}
          </button>
        </div>
      `;

      ui.showModal(content);

      const input = document.getElementById('onboarding-input');
      const nextBtn = document.getElementById('onboarding-next');
      const errorMsg = document.getElementById('error-msg');

      if (config.type !== 'select') {
        input.focus();
      }

      nextBtn.addEventListener('click', () => {
        const value = input.value.trim();

        if (config.required && !value) {
          errorMsg?.classList.remove('hidden');
          input.classList.add('border-red-500');
          return;
        }

        ui.hideModal();
        resolve(value || (config.required ? null : ''));
      });
    });
  }

  // ===== Dialogs =====

  showDateTimePicker(title, initialDate) {
    return new Promise((resolve) => {
      // Fix: Use local time instead of UTC
      const year = initialDate.getFullYear();
      const month = String(initialDate.getMonth() + 1).padStart(2, '0');
      const day = String(initialDate.getDate()).padStart(2, '0');
      const hours = String(initialDate.getHours()).padStart(2, '0');
      const minutes = String(initialDate.getMinutes()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}T${hours}:${minutes}`;

      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">${title}</h3>
          <input type="datetime-local" id="datetime-input" value="${dateStr}"
                 class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" step="300">
          <div class="flex space-x-3">
            <button id="dialog-cancel" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('cancel')}
            </button>
            <button id="dialog-ok" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
              OK
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      document.getElementById('dialog-ok').addEventListener('click', () => {
        const value = document.getElementById('datetime-input').value;
        ui.hideModal();
        resolve(value ? new Date(value) : null);
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(null);
      });
    });
  }

  showInputDialog(title, initialValue = '') {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">${title}</h3>
          <input type="text" id="text-input" value="${initialValue}"
                 class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <div class="flex space-x-3">
            <button id="dialog-cancel" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('cancel')}
            </button>
            <button id="dialog-ok" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
              ${ui.t('save')}
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      const input = document.getElementById('text-input');
      input.focus();
      input.select();

      document.getElementById('dialog-ok').addEventListener('click', () => {
        const value = input.value;
        ui.hideModal();
        resolve(value);
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(null);
      });

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const value = input.value;
          ui.hideModal();
          resolve(value);
        }
      });
    });
  }

  // Combined picker for pause and travel time with increment/decrement
  showPauseTravelPicker(defaultPause = 0.5, defaultTravel = 0) {
    return new Promise((resolve) => {
      let pauseValue = defaultPause;
      let travelValue = defaultTravel;

      const content = `
        <div class="p-6 pb-8">
          <h3 class="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Pause und Fahrtzeit</h3>

          <!-- Pause Picker -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pause (Stunden)</label>
            <div class="flex items-center space-x-4">
              <button id="pause-minus" class="w-12 h-12 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-bold text-xl hover:bg-gray-300 dark:hover:bg-gray-600 btn-press">−</button>
              <div class="flex-1 text-center">
                <span id="pause-display" class="text-3xl font-bold text-gray-900 dark:text-white">${pauseValue.toFixed(1)}</span>
                <span class="text-lg text-gray-600 dark:text-gray-400 ml-1">h</span>
              </div>
              <button id="pause-plus" class="w-12 h-12 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-bold text-xl hover:bg-gray-300 dark:hover:bg-gray-600 btn-press">+</button>
            </div>
          </div>

          <!-- Travel Picker -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fahrtzeit (Stunden)</label>
            <div class="flex items-center space-x-4">
              <button id="travel-minus" class="w-12 h-12 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-bold text-xl hover:bg-gray-300 dark:hover:bg-gray-600 btn-press">−</button>
              <div class="flex-1 text-center">
                <span id="travel-display" class="text-3xl font-bold text-gray-900 dark:text-white">${travelValue.toFixed(1)}</span>
                <span class="text-lg text-gray-600 dark:text-gray-400 ml-1">h</span>
              </div>
              <button id="travel-plus" class="w-12 h-12 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-bold text-xl hover:bg-gray-300 dark:hover:bg-gray-600 btn-press">+</button>
            </div>
          </div>

          <!-- Buttons -->
          <div class="flex space-x-3 mt-6">
            <button id="dialog-cancel" class="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('cancel')}
            </button>
            <button id="dialog-ok" class="flex-1 px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
              OK
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      // Update display
      const updateDisplay = () => {
        document.getElementById('pause-display').textContent = pauseValue.toFixed(1);
        document.getElementById('travel-display').textContent = travelValue.toFixed(1);
      };

      // Pause increment/decrement
      document.getElementById('pause-plus').addEventListener('click', () => {
        pauseValue = Math.min(24, pauseValue + 0.5);
        updateDisplay();
      });

      document.getElementById('pause-minus').addEventListener('click', () => {
        pauseValue = Math.max(0, pauseValue - 0.5);
        updateDisplay();
      });

      // Travel increment/decrement
      document.getElementById('travel-plus').addEventListener('click', () => {
        travelValue = Math.min(24, travelValue + 0.5);
        updateDisplay();
      });

      document.getElementById('travel-minus').addEventListener('click', () => {
        travelValue = Math.max(0, travelValue - 0.5);
        updateDisplay();
      });

      // OK button
      document.getElementById('dialog-ok').addEventListener('click', () => {
        ui.hideModal();
        resolve({ pause: pauseValue, travel: travelValue });
      });

      // Cancel button
      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(null);
      });
    });
  }

  showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2">${title}</h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">${message}</p>
          <div class="flex space-x-3">
            <button id="dialog-cancel" class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">
              ${ui.t('cancel')}
            </button>
            <button id="dialog-confirm" class="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold">
              ${ui.t('delete')}
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      document.getElementById('dialog-confirm').addEventListener('click', () => {
        ui.hideModal();
        resolve(true);
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(false);
      });
    });
  }

  showInputDialog(title, defaultValue = '', multiline = false) {
    return new Promise((resolve) => {
      const inputField = multiline
        ? `<textarea id="dialog-input" rows="6" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Eingeben...">${defaultValue}</textarea>`
        : `<input type="text" id="dialog-input" value="${defaultValue}" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Eingeben...">`;

      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">${title}</h3>
          ${inputField}
          <div class="flex space-x-3 mt-4">
            <button id="dialog-cancel" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg">
              Abbrechen
            </button>
            <button id="dialog-ok" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold">
              OK
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      const input = document.getElementById('dialog-input');
      input.focus();

      // Select text if default value exists
      if (defaultValue && !multiline) {
        input.select();
      }

      const handleOk = () => {
        const value = input.value.trim();
        ui.hideModal();
        resolve(value || null);
      };

      const handleCancel = () => {
        ui.hideModal();
        resolve(null);
      };

      document.getElementById('dialog-ok').addEventListener('click', handleOk);
      document.getElementById('dialog-cancel').addEventListener('click', handleCancel);

      // Enter key submits (only for single-line input)
      if (!multiline) {
        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            handleOk();
          }
        });
      }
    });
  }

  showImportConfirmDialog() {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('warning')}
            <span>CSV importieren?</span>
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Beim Import werden alle Einträge aus der CSV-Datei hinzugefügt.
            Bereits vorhandene Einträge werden nicht überschrieben, es können Duplikate entstehen.
          </p>
          <div class="flex space-x-3">
            <button id="dialog-cancel" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('cancel')}
            </button>
            <button id="dialog-confirm" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">
              Importieren
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      document.getElementById('dialog-confirm').addEventListener('click', () => {
        ui.hideModal();
        resolve(true);
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(false);
      });
    });
  }

  showTaskTypeSelector(defaultType = null) {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">${ui.t('taskType')}</h3>
          <div class="space-y-2 mb-4">
            ${Object.entries(TASK_TYPES).map(([code, name]) => {
              const isSelected = code === defaultType;
              const bgClass = isSelected ? 'bg-primary text-gray-900' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white';
              return `
                <button class="task-type-btn w-full px-4 py-3 text-left ${bgClass} rounded-lg" data-type="${code}">
                  ${name} ${code ? `<span class="badge float-right">${code}</span>` : ''}
                </button>
              `;
            }).join('')}
          </div>
          <button id="dialog-cancel" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('cancel')}
          </button>
        </div>
      `;

      ui.showModal(content);

      document.querySelectorAll('.task-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const type = btn.getAttribute('data-type');
          ui.hideModal();
          resolve(type);
        });
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(null);
      });
    });
  }

  async showSessionSummary(data) {
    return new Promise((resolve) => {
      const tasksHTML = data.tasks.length > 0
        ? data.tasks.map(t => `
            <div class="text-sm text-gray-700 dark:text-gray-300">
              • ${t.description} ${t.type ? `<span class="badge">${t.type}</span>` : ''}
            </div>
          `).join('')
        : `<p class="text-sm text-gray-500 dark:text-gray-400">${ui.t('noTasks')}</p>`;

      const content = `
        <div class="p-6">
          <h3 class="text-xl font-bold text-primary mb-4">${ui.t('sessionSummary')}</h3>

          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('date')}</span>
              <span class="font-semibold text-gray-900 dark:text-white">${ui.formatDate(data.startTime)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('start')}</span>
              <span class="font-semibold text-gray-900 dark:text-white">${ui.formatTime(data.startTime)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('end')}</span>
              <span class="font-semibold text-gray-900 dark:text-white">${ui.formatTime(data.endTime)}</span>
            </div>
          </div>

          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('pause')}</span>
              <span class="font-semibold text-gray-900 dark:text-white">${ui.hoursToHHMM(data.pauseHours)} h</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('travelTime')}</span>
              <span class="font-semibold text-gray-900 dark:text-white">${ui.hoursToHHMM(data.travelHours)} h</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('netWorkTime')}</span>
              <span class="font-semibold text-gray-900 dark:text-white">${ui.hoursToHHMM(data.netHours)} h</span>
            </div>
            <div class="flex justify-between border-t border-gray-300 dark:border-gray-600 pt-2">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('surcharge')} (${data.surchargePercent}%)</span>
              <span class="text-2xl font-bold text-primary">${ui.hoursToHHMM(data.surchargeHours)} h</span>
            </div>
          </div>

          ${data.tasks.length > 0 ? `
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">${ui.t('tasks')} (${data.tasks.length})</p>
              <div class="space-y-1">
                ${tasksHTML}
              </div>
            </div>
          ` : ''}

          <div class="flex space-x-3">
            <button id="dialog-cancel" class="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('cancel')}
            </button>
            <button id="dialog-ok" class="flex-1 px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
              ${ui.t('save')}
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      document.getElementById('dialog-ok').addEventListener('click', () => {
        ui.hideModal();
        resolve(true);
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(false);
      });
    });
  }

  // ===== Menu =====

  async showMenu() {
    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">${ui.t('menu')}</h3>
        <div class="space-y-2">
          <button id="menu-settings" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-3">
            ${ui.icon('settings')}
            <span>${ui.t('settings')}</span>
          </button>
          <button id="menu-export" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-3">
            ${ui.icon('upload')}
            <span>${ui.t('monthExport')}</span>
          </button>
          <button id="menu-import" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-3">
            ${ui.icon('download')}
            <span>${ui.t('importCSV')}</span>
          </button>
          <button id="menu-history" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-3">
            ${ui.icon('history')}
            <span>${ui.t('recordings')}</span>
          </button>
          <button id="menu-about" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-3">
            ${ui.icon('info')}
            <span>Info</span>
          </button>
        </div>
        <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg">
          ${ui.t('cancel')}
        </button>
      </div>
    `;

    ui.showModal(content);

    document.getElementById('menu-settings').addEventListener('click', () => {
      ui.hideModal();
      this.showSettings();
    });

    document.getElementById('menu-export').addEventListener('click', () => {
      ui.hideModal();
      this.showExportMenu();
    });

    document.getElementById('menu-import').addEventListener('click', () => {
      ui.hideModal();
      this.showImportMenu();
    });

    document.getElementById('menu-history').addEventListener('click', () => {
      ui.hideModal();
      this.showHistory();
    });

    document.getElementById('menu-about').addEventListener('click', () => {
      ui.hideModal();
      this.showAbout();
    });

    document.getElementById('dialog-cancel').addEventListener('click', () => {
      ui.hideModal();
    });
  }

  // ===== Settings =====

  async showSettings() {
    const settings = ui.settings;
    const isSignedIn = firebaseService && firebaseService.isSignedIn();
    const isAnonymous = firebaseService && firebaseService.isAnonymous();
    const userEmail = firebaseService ? firebaseService.getUserEmail() : null;

    // Cloud sync status
    let syncStatusHTML = '';
    let lastSyncHTML = '';
    if (firebaseService && firebaseService.isInitialized) {
      if (isSignedIn) {
        const statusText = isAnonymous ? 'Anonym angemeldet' : `Angemeldet als ${userEmail}`;
        syncStatusHTML = `
          <div class="mt-2 text-sm text-green-600 dark:text-green-400">
            ● ${statusText} (Sync aktiv)
          </div>
        `;

        // Last sync time
        const lastSync = firebaseService.getLastSyncTime();
        if (lastSync) {
          const timeSince = Math.floor((Date.now() - lastSync.getTime()) / 1000 / 60); // minutes
          const timeText = timeSince < 1 ? 'gerade eben' :
                         timeSince < 60 ? `vor ${timeSince} Min` :
                         `vor ${Math.floor(timeSince / 60)} Std`;
          lastSyncHTML = `
            <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Letzter Sync: ${timeText}
            </div>
          `;
        } else {
          lastSyncHTML = `
            <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Noch kein Sync durchgeführt
            </div>
          `;
        }
      } else {
        syncStatusHTML = `
          <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Nicht angemeldet
          </div>
        `;
      }
    }

    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          ${ui.icon('settings')}
          <span>${ui.t('settings')}</span>
        </h3>

        <div class="space-y-4">
          <!-- Cloud Sync Section -->
          ${firebaseService && firebaseService.isInitialized ? `
            <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
              <button class="collapsible-header w-full flex items-center justify-between text-left" data-target="cloud-sync-content">
                <div class="flex items-center gap-2">
                  ${ui.icon('cloud')}
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Cloud Synchronisation</h4>
                </div>
                ${ui.icon('chevron-down', 'w-5 h-5 collapsible-icon transition-transform')}
              </button>
              <div id="cloud-sync-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary">

              ${syncStatusHTML}
              ${lastSyncHTML}

              ${isSignedIn ? `
                <div class="mt-3 space-y-2">
                  <button id="firebase-manual-sync" class="w-full px-3 py-2 bg-primary text-gray-900 rounded-lg text-sm font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
                    <span id="sync-button-text">Jetzt syncen</span>
                    <span id="sync-button-spinner" class="hidden">
                      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                  </button>
                  <button id="firebase-hard-refresh" class="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
                    <span id="refresh-button-text">Daten neu laden (Cache leeren)</span>
                    <span id="refresh-button-spinner" class="hidden">
                      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                  </button>
                  <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Automatischer Sync: alle 60 Minuten
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 italic">
                    "Daten neu laden" löscht den Cache und holt aktuelle Daten vom Cloud. Nutze dies beim Gerätewechsel.
                  </p>
                </div>
              ` : ''}

              <div class="mt-3 space-y-2">
                ${!isSignedIn ? `
                  <button id="firebase-login-anon" class="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
                    Anonym anmelden
                  </button>
                  <button id="firebase-login-email" class="w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
                    Mit Email anmelden
                  </button>
                ` : isAnonymous ? `
                  <button id="firebase-link-email" class="w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
                    Account mit Email verbinden
                  </button>
                  <button id="firebase-logout" class="w-full px-3 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600">
                    Abmelden
                  </button>
                ` : `
                  <button id="firebase-logout" class="w-full px-3 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600">
                    Abmelden
                  </button>
                `}
              </div>

              ${isSignedIn ? `
                <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                  ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
                  <span>Deine Daten werden automatisch zwischen allen Geräten synchronisiert</span>
                </p>
              ` : `
                <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                  ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
                  <span>Melde dich an, um deine Daten zwischen Geräten zu synchronisieren</span>
                </p>
              `}
              </div>
            </div>
          ` : ''}

          <!-- Update Section -->
          <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
            <button class="collapsible-header w-full flex items-center justify-between text-left" data-target="update-content">
              <div class="flex items-center gap-2">
                ${ui.icon('arrow-down-circle')}
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white">App-Updates</h4>
              </div>
              ${ui.icon('chevron-down', 'w-5 h-5 collapsible-icon transition-transform')}
            </button>
            <div id="update-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary">

            <div class="space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">Aktuelle Version:</span>
                <span class="font-semibold text-gray-900 dark:text-white">v${APP_VERSION}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">Verfügbare Version:</span>
                <span id="remote-version-display" class="font-semibold text-gray-900 dark:text-white">-</span>
              </div>
            </div>

            <button id="check-update-btn" class="w-full mt-3 px-3 py-2 bg-primary text-gray-900 rounded-lg text-sm font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
              ${ui.icon('refresh')}
              <span>Auf Updates prüfen</span>
            </button>

            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
              ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
              <span>Updates werden automatisch beim App-Start geprüft</span>
            </p>
            </div>
          </div>

          <!-- Version Rollback Section -->
          <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
            <button class="collapsible-header w-full flex items-center justify-between text-left" data-target="version-rollback-content">
              <div class="flex items-center gap-2">
                ${ui.icon('clock')}
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Versionsverwaltung</h4>
              </div>
              ${ui.icon('chevron-down', 'w-5 h-5 collapsible-icon transition-transform')}
            </button>
            <div id="version-rollback-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary">

            <div id="versions-list" class="space-y-2">
              <p class="text-sm text-gray-600 dark:text-gray-400">Lade verfügbare Versionen...</p>
            </div>

            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
              ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
              <span>Stable Versions können wiederhergestellt werden. Alle Daten werden automatisch gesichert.</span>
            </p>
            </div>
          </div>

          <!-- Sharing & Friends Section -->
          ${firebaseService && firebaseService.isInitialized && isSignedIn ? `
            <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
              <button class="collapsible-header w-full flex items-center justify-between text-left" data-target="sharing-content">
                <div class="flex items-center gap-2">
                  ${ui.icon('users')}
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Teilen & Freunde</h4>
                </div>
                ${ui.icon('chevron-down', 'w-5 h-5 collapsible-icon transition-transform')}
              </button>
              <div id="sharing-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary">

                <div class="space-y-2">
                  <button id="manage-profile-btn" class="w-full px-3 py-2 bg-primary text-gray-900 rounded-lg text-sm font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
                    ${ui.icon('user')}
                    <span>Mein Share-Profil</span>
                  </button>

                  <button id="show-qr-btn" class="w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 flex items-center justify-center gap-2">
                    ${ui.icon('qr-code')}
                    <span>Mein QR-Code anzeigen</span>
                  </button>

                  <button id="scan-qr-btn" class="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 flex items-center justify-center gap-2">
                    ${ui.icon('camera')}
                    <span>Friend QR scannen</span>
                  </button>

                  <button id="manage-friends-btn" class="w-full px-3 py-2 bg-gray-600 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 flex items-center justify-center gap-2">
                    ${ui.icon('users')}
                    <span>Friends verwalten</span>
                  </button>
                </div>

                <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                  ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
                  <span>Erstelle ein Profil, teile deinen QR-Code und füge Friends hinzu um Zeiteinträge zu teilen</span>
                </p>
              </div>
            </div>
          ` : ''}

          <!-- Basic Settings -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input type="text" id="setting-username" value="${settings.username}"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">${ui.t('language')}</label>
            <select id="setting-language"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <option value="de" ${settings.language === 'de' ? 'selected' : ''}>Deutsch</option>
              <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
              <option value="hr" ${settings.language === 'hr' ? 'selected' : ''}>Hrvatski</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">${ui.t('surcharge')} (%)</label>
            <input type="number" id="setting-surcharge" value="${settings.surchargePercent}" min="0" max="200"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          </div>

          <!-- On-Call Feature Toggle -->
          <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" id="setting-oncall-enabled" ${settings.onCallEnabled ? 'checked' : ''}
                class="w-4 h-4 text-primary focus:ring-primary rounded">
              <div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${ui.t('onCallEnabled')}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Bereitschaftszeiten erfassen und verwalten</p>
              </div>
            </label>
          </div>

          <!-- Email Export Settings -->
          <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
            <button class="collapsible-header w-full flex items-center justify-between text-left" data-target="email-content">
              <div class="flex items-center gap-2">
                ${ui.icon('mail')}
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Email-Export</h4>
              </div>
              ${ui.icon('chevron-down', 'w-5 h-5 collapsible-icon transition-transform')}
            </button>
            <div id="email-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Betreff</label>
                <input type="text" id="setting-email-subject" value="${settings.emailSubject}"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-start gap-1">
                  ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
                  <span>Platzhalter: {month}, {name}</span>
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Text</label>
                <textarea id="setting-email-body" rows="3"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white">${settings.emailBody}</textarea>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-start gap-1">
                  ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
                  <span>Platzhalter: {month}, {name}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        <button id="settings-backups" class="w-full px-4 py-3 mt-6 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700">
          ${ui.t('backupTitle')}
        </button>
        <div class="flex gap-2 mt-4">
          <button id="settings-save" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
            ${ui.t('save')}
          </button>
          <button id="settings-cancel" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('cancel')}
          </button>
        </div>
      </div>
    `;

    ui.showModal(content);

    // ===== Firebase Event Listeners =====
    if (firebaseService && firebaseService.isInitialized) {
      // Anonymous Login
      const anonLoginBtn = document.getElementById('firebase-login-anon');
      if (anonLoginBtn) {
        anonLoginBtn.addEventListener('click', async () => {
          try {
            ui.showToast('Anmeldung läuft...', 'info');
            await firebaseService.signInAnonymously();
            ui.hideModal();
            ui.showToast('Erfolgreich anonym angemeldet', 'success');
            await this.showSettings(); // Refresh settings to show new state
          } catch (error) {
            ui.showToast('Anmeldung fehlgeschlagen: ' + error.message, 'error');
          }
        });
      }

      // Manual Sync Button
      const manualSyncBtn = document.getElementById('firebase-manual-sync');
      if (manualSyncBtn) {
        manualSyncBtn.addEventListener('click', async () => {
          const buttonText = document.getElementById('sync-button-text');
          const buttonSpinner = document.getElementById('sync-button-spinner');

          try {
            // Show spinner
            buttonText.textContent = 'Synchronisiere...';
            buttonSpinner.classList.remove('hidden');
            manualSyncBtn.disabled = true;

            // Perform full sync
            const success = await firebaseService.fullSync();

            if (success) {
              ui.showToast('Sync erfolgreich abgeschlossen', 'success');
              // Refresh settings to show new sync time
              await this.showSettings();
            } else {
              ui.showToast('Sync fehlgeschlagen', 'error');
            }
          } catch (error) {
            ui.showToast('Sync-Fehler: ' + error.message, 'error');
          } finally {
            // Hide spinner
            buttonText.textContent = 'Jetzt syncen';
            buttonSpinner.classList.add('hidden');
            manualSyncBtn.disabled = false;
          }
        });
      }

      // Hard Refresh Button (Clear cache + sync from cloud)
      const hardRefreshBtn = document.getElementById('firebase-hard-refresh');
      if (hardRefreshBtn) {
        hardRefreshBtn.addEventListener('click', async () => {
          const buttonText = document.getElementById('refresh-button-text');
          const buttonSpinner = document.getElementById('refresh-button-spinner');

          // Confirm action
          const confirmed = await this.showConfirmDialog(
            'Daten neu laden?',
            'Dies löscht den lokalen Cache und lädt alle Daten vom Cloud neu. Die App wird danach neu geladen. Fortfahren?'
          );

          if (!confirmed) return;

          try {
            // Show spinner
            buttonText.textContent = 'Lade neu...';
            buttonSpinner.classList.remove('hidden');
            hardRefreshBtn.disabled = true;

            // Use shared performHardRefresh method
            await this.performHardRefresh();
          } catch (error) {
            console.error('Hard refresh error:', error);
            ui.showToast('Fehler beim Neu laden: ' + error.message, 'error');
            buttonText.textContent = 'Daten neu laden (Cache leeren)';
            buttonSpinner.classList.add('hidden');
            hardRefreshBtn.disabled = false;
          }
        });
      }

      // Email Login
      const emailLoginBtn = document.getElementById('firebase-login-email');
      if (emailLoginBtn) {
        emailLoginBtn.addEventListener('click', async () => {
          await this.showEmailLoginDialog();
        });
      }

      // Link Anonymous to Email
      const linkEmailBtn = document.getElementById('firebase-link-email');
      if (linkEmailBtn) {
        linkEmailBtn.addEventListener('click', async () => {
          await this.showLinkEmailDialog();
        });
      }

      // Logout
      const logoutBtn = document.getElementById('firebase-logout');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          try {
            await firebaseService.signOut();
            ui.hideModal();
            ui.showToast('Erfolgreich abgemeldet', 'success');
            await this.showSettings(); // Refresh settings
          } catch (error) {
            ui.showToast('Abmeldung fehlgeschlagen: ' + error.message, 'error');
          }
        });
      }
    }

    // ===== Collapsible Sections =====
    document.querySelectorAll('.collapsible-header').forEach(button => {
      button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-target');
        const content = document.getElementById(targetId);
        const icon = button.querySelector('.collapsible-icon');

        // Store current scroll position
        const scrollableParent = document.getElementById('modal-content');
        const scrollBefore = scrollableParent ? scrollableParent.scrollTop : 0;

        if (content.classList.contains('hidden')) {
          // Opening
          content.classList.remove('hidden');
          if (icon) icon.style.transform = 'rotate(180deg)';

          // Restore scroll position to prevent jumping up
          if (scrollableParent) {
            scrollableParent.scrollTop = scrollBefore;
          }
        } else {
          // Closing
          content.classList.add('hidden');
          if (icon) icon.style.transform = 'rotate(0deg)';
        }
      });
    });

    // ===== Update Check Button =====
    const updateBtn = document.getElementById('check-update-btn');
    const remoteVersionDisplay = document.getElementById('remote-version-display');

    // Display remote version if already fetched
    if (this.remoteVersion) {
      remoteVersionDisplay.textContent = `v${this.remoteVersion.version}`;
      if (this.remoteVersion.version !== APP_VERSION) {
        remoteVersionDisplay.classList.add('text-green-600', 'dark:text-green-400');
      }
    }

    updateBtn.addEventListener('click', async () => {
      const btnText = updateBtn.querySelector('span');
      const originalText = btnText.textContent;

      try {
        btnText.textContent = 'Prüfe...';
        updateBtn.disabled = true;

        const result = await this.checkForUpdates(true); // silent = true

        if (result.available) {
          remoteVersionDisplay.textContent = `v${result.remote.version}`;
          remoteVersionDisplay.classList.add('text-green-600', 'dark:text-green-400');
          ui.showToast('Update verfügbar!', 'success');

          // Show update banner
          ui.hideModal();
          this.showUpdateBanner(result.remote);
        } else if (result.error) {
          ui.showToast('Update-Prüfung fehlgeschlagen', 'error');
          remoteVersionDisplay.textContent = 'Fehler';
        } else {
          remoteVersionDisplay.textContent = `v${result.remote.version}`;
          ui.showToast('App ist aktuell', 'success');
        }
      } catch (error) {
        ui.showToast('Fehler beim Prüfen', 'error');
        console.error(error);
      } finally {
        btnText.textContent = originalText;
        updateBtn.disabled = false;
      }
    });

    // ===== Version Rollback - Load versions list =====
    this.loadVersionsList();

    // ===== Settings Save =====
    // Sharing & Friends Event Listeners
    const manageProfileBtn = document.getElementById('manage-profile-btn');
    if (manageProfileBtn) {
      manageProfileBtn.addEventListener('click', () => {
        ui.hideModal();
        this.showShareProfileDialog();
      });
    }

    const showQRBtn = document.getElementById('show-qr-btn');
    if (showQRBtn) {
      showQRBtn.addEventListener('click', () => {
        ui.hideModal();
        this.showMyQRCode();
      });
    }

    const scanQRBtn = document.getElementById('scan-qr-btn');
    if (scanQRBtn) {
      scanQRBtn.addEventListener('click', () => {
        ui.hideModal();
        this.showQRScanner();
      });
    }

    const manageFriendsBtn = document.getElementById('manage-friends-btn');
    if (manageFriendsBtn) {
      manageFriendsBtn.addEventListener('click', () => {
        ui.hideModal();
        this.showFriendsList();
      });
    }

    document.getElementById('settings-save').addEventListener('click', async () => {
      const newSettings = {
        username: document.getElementById('setting-username').value,
        language: document.getElementById('setting-language').value,
        surchargePercent: parseInt(document.getElementById('setting-surcharge').value),
        emailSubject: document.getElementById('setting-email-subject').value,
        emailBody: document.getElementById('setting-email-body').value,
        onCallEnabled: document.getElementById('setting-oncall-enabled').checked
      };

      await storage.saveSettings(newSettings);
      ui.settings = newSettings;
      ui.i18n = ui.getI18N();

      ui.hideModal();
      ui.showToast('Einstellungen gespeichert', 'success');
      await this.renderMainScreen();
    });

    document.getElementById('settings-backups').addEventListener('click', () => {
      ui.hideModal();
      this.showBackupManager();
    });

    document.getElementById('settings-cancel').addEventListener('click', () => {
      ui.hideModal();
    });
  }

  // ===== Firebase Auth Dialogs =====

  async showEmailLoginDialog() {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Mit Email anmelden</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" id="login-email" placeholder="deine@email.com"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Passwort</label>
              <input type="password" id="login-password" placeholder="••••••••"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            </div>
          </div>
          <div class="flex gap-2 mt-6">
            <button id="login-signin" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">
              Anmelden
            </button>
            <button id="login-register" class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">
              Registrieren
            </button>
          </div>
          <button id="dialog-cancel" class="w-full mt-3 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            Abbrechen
          </button>
        </div>
      `;

      ui.showModal(content);

      const emailInput = document.getElementById('login-email');
      const passwordInput = document.getElementById('login-password');

      // Sign In
      document.getElementById('login-signin').addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
          ui.showToast('Bitte Email und Passwort eingeben', 'error');
          return;
        }

        try {
          ui.showToast('Anmeldung läuft...', 'info');
          await firebaseService.signInWithEmail(email, password);
          ui.hideModal();
          ui.showToast('Erfolgreich angemeldet', 'success');
          await this.showSettings();
          resolve(true);
        } catch (error) {
          ui.showToast('Anmeldung fehlgeschlagen: ' + error.message, 'error');
        }
      });

      // Register
      document.getElementById('login-register').addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
          ui.showToast('Bitte Email und Passwort eingeben', 'error');
          return;
        }

        if (password.length < 6) {
          ui.showToast('Passwort muss mindestens 6 Zeichen haben', 'error');
          return;
        }

        try {
          ui.showToast('Account wird erstellt...', 'info');
          await firebaseService.createAccountWithEmail(email, password);
          ui.hideModal();
          ui.showToast('Account erfolgreich erstellt', 'success');
          await this.showSettings();
          resolve(true);
        } catch (error) {
          ui.showToast('Registrierung fehlgeschlagen: ' + error.message, 'error');
        }
      });

      // Cancel
      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(false);
      });
    });
  }

  async showLinkEmailDialog() {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Account mit Email verbinden</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Verbinde deinen anonymen Account mit einer Email, um ihn dauerhaft zu sichern.
          </p>
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" id="link-email" placeholder="deine@email.com"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Passwort</label>
              <input type="password" id="link-password" placeholder="••••••••"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            </div>
          </div>
          <div class="flex gap-2 mt-6">
            <button id="link-confirm" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">
              Verbinden
            </button>
            <button id="dialog-cancel" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              Abbrechen
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      const emailInput = document.getElementById('link-email');
      const passwordInput = document.getElementById('link-password');

      document.getElementById('link-confirm').addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
          ui.showToast('Bitte Email und Passwort eingeben', 'error');
          return;
        }

        if (password.length < 6) {
          ui.showToast('Passwort muss mindestens 6 Zeichen haben', 'error');
          return;
        }

        try {
          ui.showToast('Account wird verbunden...', 'info');
          await firebaseService.linkAnonymousToEmail(email, password);
          ui.hideModal();
          ui.showToast('Account erfolgreich mit Email verbunden', 'success');
          await this.showSettings();
          resolve(true);
        } catch (error) {
          ui.showToast('Verbindung fehlgeschlagen: ' + error.message, 'error');
        }
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(false);
      });
    });
  }

  // ===== Export =====

  // Helper: Get auto month (previous month if day 1-5, else current month)
  getAutoMonth() {
    const now = new Date();
    const day = now.getDate();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;

    // If day 1-5, use previous month
    if (day <= 5) {
      month--;
      if (month === 0) {
        month = 12;
        year--;
      }
    }

    return { year, month };
  }

  // Helper: Parse manual month input (MM.YYYY or YYYY-MM)
  parseManualMonth(input) {
    const parts = input.split(/[.-]/);
    if (parts.length !== 2) return null;

    let month, year;
    if (parts[0].length === 4) {
      year = parseInt(parts[0]);
      month = parseInt(parts[1]);
    } else {
      month = parseInt(parts[0]);
      year = parseInt(parts[1]);
    }

    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) return null;
    return { year, month };
  }

  // Quick Export - direkt per Email senden mit automatischem Monat
  async quickExport() {
    try {
      // Automatischen Monat verwenden
      const { year, month } = this.getAutoMonth();

      ui.showToast('Generiere Excel-Datei...', 'info');

      const entries = await storage.getMonthEntries(year, month);

      if (!entries || entries.length === 0) {
        ui.showToast('Keine Einträge für diesen Monat', 'error');
        return;
      }

      // Excel generieren
      const { blob, filename } = await excelExport.generateXLSX(entries, year, month, ui.settings.username);

      // Direkt per Email senden (kein Dialog)
      await excelExport.sendEmail(blob, filename, ui.settings);

    } catch (error) {
      ui.showToast('Export fehlgeschlagen: ' + error.message, 'error');
      console.error('Quick export error:', error);
    }
  }

  async showExportMenu() {
    // Step 1: Choose month (auto or manual)
    const auto = this.getAutoMonth();
    const pad2 = (n) => String(n).padStart(2, '0');
    const autoLabel = `${auto.year}-${pad2(auto.month)}`;

    const monthDialogContent = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          ${ui.icon('calendar')}
          <span>Monat wählen</span>
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Automatisch: <strong>${autoLabel}</strong>
        </p>
        <div class="space-y-3">
          <button id="month-auto" class="w-full px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
            ${ui.icon('calendar')}
            <span>Automatisch: ${autoLabel}</span>
          </button>
          <button id="month-manual" class="w-full px-4 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 flex items-center justify-center gap-2">
            ${ui.icon('pencil')}
            <span>Monat manuell eingeben</span>
          </button>
        </div>
        <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
          Abbrechen
        </button>
      </div>
    `;

    ui.showModal(monthDialogContent);

    // Wait for month selection
    const selectedMonth = await new Promise((resolve) => {
      document.getElementById('month-auto').addEventListener('click', () => {
        ui.hideModal();
        resolve(auto);
      });

      document.getElementById('month-manual').addEventListener('click', async () => {
        ui.hideModal();
        const input = prompt('Monat eingeben (Format: MM.YYYY oder YYYY-MM):', `${pad2(auto.month)}.${auto.year}`);
        if (!input) {
          resolve(null);
          return;
        }

        const parsed = this.parseManualMonth(input);
        if (!parsed) {
          ui.showToast('Ungültiges Format', 'error');
          resolve(null);
          return;
        }

        resolve(parsed);
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(null);
      });
    });

    if (!selectedMonth) return;

    const { year, month } = selectedMonth;

    // Step 2: Generate Excel directly (no format selection)
    await this.showExcelExport(year, month);
  }

  // Excel export dialog
  async showExcelExport(year, month) {
    try {
      ui.showToast('Generiere Excel-Datei...', 'info');

      const entries = await storage.getMonthEntries(year, month);

      if (!entries || entries.length === 0) {
        ui.showToast('Keine Einträge für diesen Monat', 'error');
        return;
      }

      // Generate Excel → get blob + filename
      const { blob, filename } = await excelExport.generateXLSX(entries, year, month, ui.settings.username);

      const dialogContent = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('check')}
            <span>Excel erstellt</span>
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${filename}</p>
          <div class="space-y-3">
            <button id="xlsx-download" class="w-full px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
              ${ui.icon('download')}
              <span>Herunterladen</span>
            </button>
            <button id="xlsx-email" class="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2">
              ${ui.icon('mail')}
              <span>Per Mail senden</span>
            </button>
          </div>
          <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            Schließen
          </button>
        </div>
      `;

      ui.showModal(dialogContent);

      // Download Button
      document.getElementById('xlsx-download').addEventListener('click', () => {
        excelExport.downloadExcel(blob, filename);
        ui.hideModal();
        ui.showToast('Excel heruntergeladen', 'success');
      });

      // E-Mail / Share Button
      document.getElementById('xlsx-email').addEventListener('click', async () => {
        const success = await excelExport.sendEmail(blob, filename, ui.settings);
        if (success) {
          ui.hideModal();
        } else {
          ui.showToast('Bitte lade die Datei herunter und hänge sie manuell an', 'info');
        }
      });

      // Cancel
      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
      });

    } catch (error) {
      ui.showToast('Export fehlgeschlagen: ' + error.message, 'error');
      console.error(error);
    }
  }

  // CSV export dialog
  async showCSVExport(year, month) {
    try {
      ui.showToast('Generiere CSV-Datei...', 'info');
      const { content, filename } = await csvExport.generateMonthlyCSV(year, month, ui.settings.username);

      const dialogContent = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('check')}
            <span>${ui.t('exportSuccess')}</span>
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${filename}</p>
          <div class="space-y-2">
            <button id="csv-download" class="w-full px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
              ${ui.icon('download')}
              <span>${ui.t('download')}</span>
            </button>
            <button id="csv-email" class="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2">
              ${ui.icon('mail')}
              <span>${ui.t('sendEmail')}</span>
            </button>
          </div>
          <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('close')}
          </button>
        </div>
      `;

      ui.showModal(dialogContent);

      document.getElementById('csv-download').addEventListener('click', () => {
        csvExport.downloadCSV(content, filename);
        ui.hideModal();
        ui.showToast('CSV heruntergeladen', 'success');
      });

      document.getElementById('csv-email').addEventListener('click', () => {
        csvExport.sendEmail(content, filename, ui.settings);
        ui.hideModal();
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
      });
    } catch (error) {
      ui.showToast('Export fehlgeschlagen', 'error');
      console.error(error);
    }
  }

  // ===== Import =====

  async showImportMenu() {
    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          ${ui.icon('download')}
          <span>${ui.t('importCSV')}</span>
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Wähle eine CSV-Datei aus, um Einträge zu importieren.
        </p>
        <input type="file" id="csv-file-input" accept=".csv" class="hidden">
        <button id="select-file-btn" class="w-full px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold mb-2 hover:bg-primary-dark flex items-center justify-center gap-2">
          ${ui.icon('folder')}
          <span>${ui.t('selectFile')}</span>
        </button>
        <div id="file-name" class="text-sm text-gray-600 dark:text-gray-400 mb-4 min-h-6"></div>
        <button id="import-btn" class="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-semibold disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-600 dark:disabled:text-gray-400 hover:bg-green-600 flex items-center justify-center gap-2" disabled>
          ${ui.icon('upload')}
          <span>Importieren</span>
        </button>
        <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
          ${ui.t('cancel')}
        </button>
      </div>
    `;

    ui.showModal(content);

    const fileInput = document.getElementById('csv-file-input');
    const importBtn = document.getElementById('import-btn');
    const fileNameDisplay = document.getElementById('file-name');
    let selectedFile = null;

    document.getElementById('select-file-btn').addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      selectedFile = e.target.files[0];
      if (selectedFile) {
        fileNameDisplay.innerHTML = `<div class="flex items-center gap-2">${ui.icon('file')}<span>${selectedFile.name}</span></div>`;
        importBtn.disabled = false;
      } else {
        fileNameDisplay.textContent = '';
        importBtn.disabled = true;
      }
    });

    importBtn.addEventListener('click', async () => {
      if (!selectedFile) {
        ui.showToast(ui.t('noFileSelected'), 'error');
        return;
      }

      // Show confirmation dialog
      const confirmed = await this.showImportConfirmDialog();

      if (!confirmed) return;

      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const csvContent = e.target.result;
            const count = await csvExport.importCSV(csvContent);

            ui.hideModal();
            if (count > 0) {
              ui.showToast(ui.t('entriesImported').replace('{count}', count), 'success');
            } else {
              ui.showToast('Keine gültigen Einträge gefunden', 'warning');
            }
          } catch (error) {
            console.error('Import error:', error);
            ui.showToast(ui.t('importError'), 'error');
          }
        };
        reader.readAsText(selectedFile);
      } catch (error) {
        console.error('File read error:', error);
        ui.showToast(ui.t('importError'), 'error');
      }
    });

    document.getElementById('dialog-cancel').addEventListener('click', () => {
      ui.hideModal();
    });
  }

  // ===== History =====

  // Helper function: Convert HH:MM to hours
  timeToHours(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes / 60);
  }

  // Helper function: Calculate work hours (total time - pause, travel time is INCLUDED)
  calculateWorkHours(entry) {
    const startHours = this.timeToHours(entry.startTime);
    const endHours = this.timeToHours(entry.endTime);
    const pauseHours = this.timeToHours(entry.pause);

    // Total time - pause (travel time stays in)
    return (endHours - startHours) - pauseHours;
  }

  async showHistory() {
    const entries = await storage.getAllWorklogEntries();

    if (entries.length === 0) {
      const content = `
        <div class="p-6 text-center">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center justify-center gap-2">
            ${ui.icon('history')}
            <span>${ui.t('recordings')}</span>
          </h3>
          <p class="text-gray-500 dark:text-gray-400">Noch keine Einträge vorhanden</p>
          <button id="dialog-ok" class="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            OK
          </button>
        </div>
      `;
      ui.showModal(content);
      document.getElementById('dialog-ok').addEventListener('click', () => {
        ui.hideModal();
      });
      return;
    }

    // Sort entries by date (newest first)
    entries.sort((a, b) => {
      const dateA = a.date.split('.').reverse().join('-');
      const dateB = b.date.split('.').reverse().join('-');
      return dateB.localeCompare(dateA);
    });

    // Calculate statistics
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let weekHours = 0;
    let weekDays = 0;
    let monthHours = 0;
    let monthDays = 0;

    entries.forEach(entry => {
      const [day, month, year] = entry.date.split('.');
      const entryDate = new Date(year, month - 1, day);
      const workHours = this.calculateWorkHours(entry);

      if (entryDate >= currentWeekStart) {
        weekHours += workHours;
        weekDays++;
      }

      if (entryDate >= currentMonthStart) {
        monthHours += workHours;
        monthDays++;
      }
    });

    // Add current session if active
    let isSessionActive = false;
    if (this.session) {
      const sessionStart = new Date(this.session.start);
      const sessionDate = new Date(sessionStart.getFullYear(), sessionStart.getMonth(), sessionStart.getDate());

      // Calculate current session duration (in hours)
      const currentDuration = (Date.now() - sessionStart.getTime()) / (1000 * 60 * 60);

      // Check if session is in current week
      if (sessionDate >= currentWeekStart) {
        weekHours += currentDuration;
        isSessionActive = true;
      }

      // Check if session is in current month
      if (sessionDate >= currentMonthStart) {
        monthHours += currentDuration;
        isSessionActive = true;
      }
    }

    // Statistics HTML
    const liveIndicator = isSessionActive ? `<span class="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1"></span>` : '';
    const statsHtml = `
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-primary bg-opacity-20 rounded-lg p-4">
          <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Diese Woche</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-white flex items-center">${weekHours.toFixed(1)}h${liveIndicator}</div>
          <div class="text-xs text-gray-500 mt-1">${weekDays} ${weekDays === 1 ? 'Tag' : 'Tage'}</div>
        </div>
        <div class="bg-blue-100 dark:bg-blue-900 rounded-lg p-4">
          <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Dieser Monat</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-white flex items-center">${monthHours.toFixed(1)}h${liveIndicator}</div>
          <div class="text-xs text-gray-500 mt-1">${monthDays} ${monthDays === 1 ? 'Tag' : 'Tage'}</div>
        </div>
      </div>
    `;

    // Entries HTML with calculated hours
    const entriesHtml = entries.map(entry => {
      // Parse date from DD.MM.YYYY format
      const [day, month, year] = entry.date.split('.');
      const date = new Date(year, month - 1, day);
      const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

      const taskList = entry.tasks && entry.tasks.length > 0
        ? entry.tasks.map(t => `${t.type}: ${t.description}`).join('<br>')
        : '';

      const workHours = this.calculateWorkHours(entry);

      return `
        <div class="border-b border-gray-200 dark:border-gray-700 py-3 last:border-0" data-entry-id="${entry.id}">
          <div class="flex justify-between items-start mb-1">
            <span class="font-medium text-gray-900 dark:text-white">${dateStr}</span>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-primary">${workHours.toFixed(1)}h</span>
              <button class="history-share-btn text-green-500 hover:text-green-700 dark:hover:text-green-400 p-1" data-id="${entry.id}" title="${ui.t('shareEntry')}">
                ${ui.icon('share')}
              </button>
              <button class="history-edit-btn text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1" data-id="${entry.id}" title="Bearbeiten">
                ${ui.icon('edit')}
              </button>
              <button class="history-delete-btn text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1" data-id="${entry.id}" title="Löschen">
                ${ui.icon('trash')}
              </button>
            </div>
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            ${entry.startTime} - ${entry.endTime}
          </div>
          ${entry.pause ? `<div class="text-xs text-gray-500 dark:text-gray-400">Pause: ${entry.pause}</div>` : ''}
          ${entry.travelTime ? `<div class="text-xs text-gray-500 dark:text-gray-400">Fahrt: ${entry.travelTime}</div>` : ''}
          ${entry.surcharge ? `<div class="text-xs text-gray-500 dark:text-gray-400">Zuschlag: ${entry.surcharge}</div>` : ''}
          ${taskList ? `<div class="text-sm text-gray-700 dark:text-gray-300 mt-2">${taskList}</div>` : ''}
        </div>
      `;
    }).join('');

    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          ${ui.icon('history')}
          <span>${ui.t('recordings')}</span>
        </h3>

        ${statsHtml}

        <div class="mb-3">
          <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Alle Einträge (${entries.length})</div>
        </div>

        <div class="max-h-64 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
          ${entriesHtml}
        </div>

        <!-- Actions -->
        <div class="flex gap-2 mt-4">
          <button id="import-entry-open" class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600">
            ${ui.icon('download')} ${ui.t('importEntry')}
          </button>
          <button id="dialog-ok" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
            ${ui.t('close')}
          </button>
        </div>
      </div>
    `;

    ui.showModal(content);

    // Add event listeners for share buttons
    document.querySelectorAll('.history-share-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const entryId = parseInt(e.currentTarget.dataset.id);
        const entry = entries.find(e => e.id === entryId);
        if (entry) {
          await this.shareWorklogEntry(entry);
        }
      });
    });

    // Add event listeners for edit buttons
    document.querySelectorAll('.history-edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const entryId = parseInt(e.currentTarget.dataset.id);
        const entry = entries.find(e => e.id === entryId);
        if (entry) {
          ui.hideModal();
          await this.editWorklogEntry(entry);
          await this.showHistory(); // Refresh history
        }
      });
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.history-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const entryId = parseInt(e.currentTarget.dataset.id);
        const entry = entries.find(e => e.id === entryId);
        if (entry) {
          ui.hideModal();
          await this.deleteWorklogEntry(entry);
          await this.showHistory(); // Refresh history
        }
      });
    });

    // Add event listener for import button
    document.getElementById('import-entry-open').addEventListener('click', () => {
      ui.hideModal();
      this.showImportEntryDialog();
    });

    document.getElementById('dialog-ok').addEventListener('click', () => {
      ui.hideModal();
    });
  }

  async editWorklogEntry(entry) {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('edit')}
            <span>Eintrag bearbeiten</span>
          </h3>

          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Datum</label>
              <input type="date" id="edit-date" value="${entry.date.split('.').reverse().join('-')}"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Startzeit</label>
                <input type="time" id="edit-start" value="${entry.startTime}"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endzeit</label>
                <input type="time" id="edit-end" value="${entry.endTime}"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pause (HH:MM)</label>
                <input type="time" id="edit-pause" value="${entry.pause || '00:00'}"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fahrtzeit (HH:MM)</label>
                <input type="time" id="edit-travel" value="${entry.travelTime || '00:00'}"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zuschlag (HH:MM)</label>
              <input type="time" id="edit-surcharge" value="${entry.surcharge || '00:00'}"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Aufgaben</label>
              <div id="edit-tasks-list" class="space-y-2 mb-2">
                ${entry.tasks && entry.tasks.length > 0 ? entry.tasks.map((task, idx) => `
                  <div class="flex gap-2">
                    <input type="text" class="task-type flex-none w-12 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      value="${task.type}" placeholder="Typ">
                    <input type="text" class="task-desc flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      value="${task.description}" placeholder="Beschreibung">
                    <button class="remove-task-btn text-red-500 hover:text-red-700 dark:hover:text-red-400 px-2" data-index="${idx}">${ui.icon('x')}</button>
                  </div>
                `).join('') : '<p class="text-sm text-gray-500 dark:text-gray-400">Keine Aufgaben</p>'}
              </div>
              <button id="add-task-to-entry" class="text-sm text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-1">
                ${ui.icon('plus')}
                <span>Aufgabe hinzufügen</span>
              </button>
            </div>
          </div>

          <div class="flex gap-2 mt-6">
            <button id="edit-save" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
              Speichern
            </button>
            <button id="edit-cancel" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              Abbrechen
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      // Add task button
      document.getElementById('add-task-to-entry').addEventListener('click', () => {
        const tasksList = document.getElementById('edit-tasks-list');
        const existingTasks = tasksList.querySelectorAll('.flex');
        const newIndex = existingTasks.length;

        const newTaskHtml = `
          <div class="flex gap-2">
            <input type="text" class="task-type flex-none w-12 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value="" placeholder="Typ">
            <input type="text" class="task-desc flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value="" placeholder="Beschreibung">
            <button class="remove-task-btn text-red-500 hover:text-red-700 dark:hover:text-red-400 px-2" data-index="${newIndex}">${ui.icon('x')}</button>
          </div>
        `;

        if (tasksList.querySelector('p')) {
          tasksList.innerHTML = newTaskHtml;
        } else {
          tasksList.insertAdjacentHTML('beforeend', newTaskHtml);
        }

        // Re-attach remove listeners
        tasksList.querySelectorAll('.remove-task-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.currentTarget.closest('.flex').remove();
            if (tasksList.querySelectorAll('.flex').length === 0) {
              tasksList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Keine Aufgaben</p>';
            }
          });
        });
      });

      // Remove task buttons
      document.querySelectorAll('.remove-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.currentTarget.closest('.flex').remove();
          const tasksList = document.getElementById('edit-tasks-list');
          if (tasksList.querySelectorAll('.flex').length === 0) {
            tasksList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400">Keine Aufgaben</p>';
          }
        });
      });

      // Save button
      document.getElementById('edit-save').addEventListener('click', async () => {
        const dateInput = document.getElementById('edit-date').value;
        const [year, month, day] = dateInput.split('-');
        const formattedDate = `${day}.${month}.${year}`;

        const taskElements = document.querySelectorAll('#edit-tasks-list .flex');
        const tasks = Array.from(taskElements).map(el => ({
          type: el.querySelector('.task-type').value.trim(),
          description: el.querySelector('.task-desc').value.trim()
        })).filter(t => t.description); // Only keep tasks with descriptions

        const updatedEntry = {
          ...entry,
          date: formattedDate,
          startTime: document.getElementById('edit-start').value,
          endTime: document.getElementById('edit-end').value,
          pause: document.getElementById('edit-pause').value,
          travelTime: document.getElementById('edit-travel').value,
          surcharge: document.getElementById('edit-surcharge').value,
          tasks: tasks
        };

        await storage.updateWorklogEntry(updatedEntry);
        ui.hideModal();
        ui.showToast('Eintrag aktualisiert', 'success');
        resolve(true);
      });

      // Cancel button
      document.getElementById('edit-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(false);
      });
    });
  }

  async deleteWorklogEntry(entry) {
    const [day, month, year] = entry.date.split('.');
    const date = new Date(year, month - 1, day);
    const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const confirmed = await this.showConfirmDialog(
      'Eintrag löschen?',
      `Möchtest du den Eintrag vom ${dateStr} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`
    );

    if (!confirmed) return;

    await storage.deleteWorklogEntry(entry.id);
    ui.showToast('Eintrag gelöscht', 'success');
  }

  // ===== File Handling API =====

  setupFileHandling() {
    // File Handling API - handles .liftec files opened with the app
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async (launchParams) => {
        if (!launchParams.files || launchParams.files.length === 0) {
          return;
        }

        // Handle the first file (usually only one file is opened)
        const fileHandle = launchParams.files[0];
        try {
          const file = await fileHandle.getFile();
          const text = await file.text();
          const data = JSON.parse(text);

          // Validate data
          if (data.type !== 'liftec-timer-entry' || !data.date) {
            ui.showToast(ui.t('invalidFormat'), 'error');
            return;
          }

          // Auto-import the file
          await this.importWorklogEntry(data);
        } catch (error) {
          console.error('File handling failed:', error);
          ui.showToast(ui.t('importError'), 'error');
        }
      });
    }
  }

  // ===== Share & Import Entry =====

  async shareWorklogEntry(entry) {
    // Show choice dialog: Cloud vs File sharing
    const choice = await this.showShareChoiceDialog(entry);
    if (!choice) return;

    if (choice === 'cloud') {
      await this.shareWorklogEntryToUser(entry);
    } else {
      await this.shareWorklogEntryViaFile(entry);
    }
  }

  async showShareChoiceDialog(entry) {
    return new Promise((resolve) => {
      const isSignedIn = firebaseService.isSignedIn();

      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('share-2')}
            <span>${ui.t('shareEntry')}</span>
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            ${ui.t('entryFrom')} ${entry.date}
          </p>

          <div class="space-y-2">
            ${isSignedIn ? `
              <button id="share-cloud-btn" class="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 flex items-center justify-center gap-2">
                ${ui.icon('user-plus', 'w-5 h-5')}
                <span>${ui.t('shareToUser')}</span>
              </button>
            ` : ''}
            <button id="share-file-btn" class="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2">
              ${ui.icon('share-2', 'w-5 h-5')}
              <span>${ui.t('shareViaFile')}</span>
            </button>
            <button id="dialog-cancel" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('cancel')}
            </button>
          </div>

          ${!isSignedIn ? `
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
              ${ui.t('signInToShareCloud')}
            </p>
          ` : ''}
        </div>
      `;

      ui.showModal(content);

      if (isSignedIn) {
        document.getElementById('share-cloud-btn').addEventListener('click', () => {
          ui.hideModal();
          resolve('cloud');
        });
      }

      document.getElementById('share-file-btn').addEventListener('click', () => {
        ui.hideModal();
        resolve('file');
      });

      document.getElementById('dialog-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve(null);
      });
    });
  }

  async shareWorklogEntryToUser(entry) {
    try {
      // Load friends list
      const friends = await firebaseService.getFriends();

      if (friends.length === 0) {
        ui.showToast(ui.t('noFriendsToShare'), 'error');
        return;
      }

      return new Promise((resolve) => {
        const friendOptions = friends.map(friend =>
          `<option value="${friend.uid}">@${friend.nickname} (${friend.displayName})</option>`
        ).join('');

        const content = `
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              ${ui.icon('user-plus')}
              <span>${ui.t('shareToFriend')}</span>
            </h3>

            <div class="mb-4">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ${ui.t('selectFriend')}
              </label>
              <select id="share-friend-select" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                <option value="">${ui.t('selectOption')}</option>
                ${friendOptions}
              </select>
            </div>

            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-4">
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">${ui.t('sharingEntry')}:</p>
              <p class="text-sm font-medium text-gray-900 dark:text-white">${entry.date}</p>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                ${entry.startTime} - ${entry.endTime} (${entry.tasks?.length || 0} ${ui.t('tasks')})
              </p>
            </div>

            <div class="flex gap-2">
              <button id="share-send-btn" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">
                ${ui.t('send')}
              </button>
              <button id="dialog-cancel" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
                ${ui.t('cancel')}
              </button>
            </div>
          </div>
        `;

        ui.showModal(content);

        const select = document.getElementById('share-friend-select');

        const sendShare = async () => {
          const friendUserId = select.value;
          if (!friendUserId) {
            ui.showToast(ui.t('selectFriendFirst'), 'error');
            return;
          }

          try {
            ui.showToast(ui.t('sharing'), 'info');

            const result = await firebaseService.shareWorklogEntry(entry, friendUserId);

            ui.hideModal();
            ui.showToast(ui.t('sharedWithUser').replace('{user}', `@${result.recipientNickname}`), 'success');
            resolve(true);
          } catch (error) {
            console.error('Cloud share failed:', error);
            if (error.message.includes('only share with friends')) {
              ui.showToast(ui.t('canOnlyShareWithFriends'), 'error');
            } else {
              ui.showToast(ui.t('shareFailed'), 'error');
            }
          }
        };

        document.getElementById('share-send-btn').addEventListener('click', sendShare);

        document.getElementById('dialog-cancel').addEventListener('click', () => {
          ui.hideModal();
          resolve(false);
        });
      });
    } catch (error) {
      console.error('Failed to load friends:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  async shareWorklogEntryViaFile(entry) {
    try {
      // Create shareable data (exclude internal id)
      const shareData = {
        version: '1.0',
        type: 'liftec-timer-entry',
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        pause: entry.pause,
        travelTime: entry.travelTime,
        surcharge: entry.surcharge,
        tasks: entry.tasks || [],
        exportedBy: ui.settings.username || 'Benutzer',
        exportedAt: new Date().toISOString()
      };

      const jsonString = JSON.stringify(shareData, null, 2);
      const fileName = `liftec-timer-${entry.date.replace(/\./g, '-')}.liftec`;

      // Try Web Share API first (mobile devices with native share)
      if (navigator.share && navigator.canShare) {
        // Create a file blob
        const file = new File([jsonString], fileName, { type: 'application/vnd.liftec.timer+json' });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: ui.t('shareEntryTitle'),
            text: `${ui.t('entryFrom')} ${entry.date} - ${ui.settings.username || 'Benutzer'}`,
            files: [file]
          });
          ui.showToast(ui.t('shareSuccess'), 'success');
          return;
        }
      }

      // Fallback 1: Copy to clipboard (works well on mobile)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonString);
        ui.showToast(ui.t('copiedToClipboard'), 'success');

        // Also offer download as additional option
        this.downloadWorklogEntry(jsonString, fileName);
        return;
      }

      // Fallback 2: Download file
      this.downloadWorklogEntry(jsonString, fileName);
      ui.showToast(ui.t('downloaded'), 'success');

    } catch (error) {
      console.error('Share failed:', error);

      // Final fallback: download
      try {
        const shareData = {
          version: '1.0',
          type: 'liftec-timer-entry',
          date: entry.date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          pause: entry.pause,
          travelTime: entry.travelTime,
          surcharge: entry.surcharge,
          tasks: entry.tasks || [],
          exportedBy: ui.settings.username || 'Benutzer',
          exportedAt: new Date().toISOString()
        };
        const jsonString = JSON.stringify(shareData, null, 2);
        const fileName = `liftec-timer-${entry.date.replace(/\./g, '-')}.liftec`;
        this.downloadWorklogEntry(jsonString, fileName);
        ui.showToast(ui.t('downloaded'), 'success');
      } catch (downloadError) {
        ui.showToast(ui.t('shareFailed'), 'error');
      }
    }
  }

  downloadWorklogEntry(jsonString, fileName) {
    const blob = new Blob([jsonString], { type: 'application/vnd.liftec.timer+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async showImportEntryDialog() {
    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          ${ui.icon('download')}
          <span>${ui.t('importEntry')}</span>
        </h3>

        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          ${ui.t('importEntryDesc')}
        </p>

        <input type="file" id="import-entry-file"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white mb-4">

        <div class="flex gap-2">
          <button id="import-entry-btn" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
            ${ui.t('importEntry')}
          </button>
          <button id="import-cancel-btn" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('cancel')}
          </button>
        </div>
      </div>
    `;

    ui.showModal(content);

    document.getElementById('import-entry-btn').addEventListener('click', async () => {
      const fileInput = document.getElementById('import-entry-file');
      if (!fileInput.files || fileInput.files.length === 0) {
        ui.showToast(ui.t('noFileSelected'), 'error');
        return;
      }

      try {
        const file = fileInput.files[0];
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate data
        if (data.type !== 'liftec-timer-entry' || !data.date) {
          ui.showToast(ui.t('invalidFormat'), 'error');
          return;
        }

        ui.hideModal();
        await this.importWorklogEntry(data);
      } catch (error) {
        console.error('Import failed:', error);
        ui.showToast(ui.t('importError'), 'error');
      }
    });

    document.getElementById('import-cancel-btn').addEventListener('click', () => {
      ui.hideModal();
    });
  }

  async importWorklogEntry(data) {
    try {
      // Check if entry for this date already exists
      const allEntries = await storage.getAllWorklogEntries();
      const existingEntry = allEntries.find(e => e.date === data.date);

      if (existingEntry) {
        // Show duplicate warning with details
        const action = await this.showDuplicateEntryDialog(data, existingEntry);

        if (action === 'cancel') {
          return;
        } else if (action === 'overwrite') {
          // Delete existing entry
          await storage.deleteWorklogEntry(existingEntry.id);
        }
        // If 'keepBoth', we just continue and add the new entry
      }

      // Create new entry (without id, will be auto-generated)
      const newEntry = {
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        pause: data.pause || '00:00',
        travelTime: data.travelTime || '00:00',
        surcharge: data.surcharge || '00:00',
        tasks: data.tasks || []
      };

      await storage.addWorklogEntry(newEntry);
      ui.showToast(ui.t('entryImported'), 'success');

      // Refresh history if it's open
      await this.showHistory();
    } catch (error) {
      console.error('Import failed:', error);
      ui.showToast(ui.t('importError'), 'error');
    }
  }

  async showDuplicateEntryDialog(newData, existingEntry, senderName = null) {
    return new Promise((resolve) => {
      // Format existing entry details
      const existingTasks = existingEntry.tasks && existingEntry.tasks.length > 0
        ? existingEntry.tasks.map(t => `${t.type}: ${t.description}`).join(', ')
        : 'Keine Aufgaben';

      // Format new entry details
      const newTasks = newData.tasks && newData.tasks.length > 0
        ? newData.tasks.map(t => `${t.type}: ${t.description}`).join(', ')
        : 'Keine Aufgaben';

      // Use senderName if provided, otherwise fall back to exportedBy
      const fromName = senderName || newData.exportedBy || 'Unbekannt';

      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('warning')}
            <span>${ui.t('duplicateWarning')}</span>
          </h3>

          <p class="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            ${ui.t('entryFrom')} ${newData.date}
          </p>

          <!-- Existing Entry -->
          <div class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded">
            <p class="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">📋 Vorhandener Eintrag:</p>
            <div class="text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <p>⏰ ${existingEntry.startTime} - ${existingEntry.endTime}</p>
              <p>⏸️ Pause: ${existingEntry.pause || '00:00'}</p>
              <p>🚗 Fahrt: ${existingEntry.travelTime || '00:00'}</p>
              <p>💰 Zuschlag: ${existingEntry.surcharge || '00:00'}</p>
              <p class="truncate" title="${existingTasks}">📝 ${existingTasks}</p>
            </div>
          </div>

          <!-- New Entry -->
          <div class="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded">
            <p class="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">📥 Neuer Eintrag (von ${fromName}):</p>
            <div class="text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <p>⏰ ${newData.startTime} - ${newData.endTime}</p>
              <p>⏸️ Pause: ${newData.pause || '00:00'}</p>
              <p>🚗 Fahrt: ${newData.travelTime || '00:00'}</p>
              <p>💰 Zuschlag: ${newData.surcharge || '00:00'}</p>
              <p class="truncate" title="${newTasks}">📝 ${newTasks}</p>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <button id="duplicate-overwrite" class="w-full px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600">
              🔄 ${ui.t('overwrite')}
            </button>
            <button id="duplicate-keep-both" class="w-full px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
              ➕ ${ui.t('keepBoth')}
            </button>
            <button id="duplicate-cancel" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              ❌ ${ui.t('cancel')}
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      document.getElementById('duplicate-overwrite').addEventListener('click', () => {
        ui.hideModal();
        resolve('overwrite');
      });

      document.getElementById('duplicate-keep-both').addEventListener('click', () => {
        ui.hideModal();
        resolve('keep-both');
      });

      document.getElementById('duplicate-cancel').addEventListener('click', () => {
        ui.hideModal();
        resolve('cancel');
      });
    });
  }

  // ===== QR Code & Friend System =====

  /**
   * Show QR code for own share profile
   */
  async showMyQRCode() {
    if (!firebaseService.isSignedIn()) {
      ui.showToast(ui.t('mustBeSignedIn'), 'error');
      return;
    }

    try {
      const profile = await firebaseService.getShareProfile();

      if (!profile) {
        ui.showToast(ui.t('createProfileFirst'), 'error');
        return;
      }

      // QR Data: userId|nickname
      const qrData = `liftec-timer://add-friend/${firebaseService.currentUser.uid}|${profile.nickname}`;

      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white text-center">
            ${ui.t('myQRCode')}
          </h3>

          <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 text-center">
            <p class="text-2xl font-bold text-gray-900 dark:text-white mb-1">@${profile.nickname}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">${profile.displayName}</p>
          </div>

          <!-- QR Code Container -->
          <div id="qrcode-container" class="bg-white p-4 rounded-lg mx-auto mb-4 flex justify-center"></div>

          <p class="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
            ${ui.t('qrCodeHint')}
          </p>

          <button id="qr-close-btn" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('close')}
          </button>
        </div>
      `;

      ui.showModal(content);

      // Generate QR Code
      const qrContainer = document.getElementById('qrcode-container');
      new QRCode(qrContainer, {
        text: qrData,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });

      document.getElementById('qr-close-btn').addEventListener('click', () => {
        ui.hideModal();
      });

    } catch (error) {
      console.error('Show QR code failed:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  /**
   * Show QR scanner to add friend
   */
  async showQRScanner() {
    if (!firebaseService.isSignedIn()) {
      ui.showToast(ui.t('mustBeSignedIn'), 'error');
      return;
    }

    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white text-center">
          ${ui.t('scanQRCode')}
        </h3>

        <!-- Scanner Container -->
        <div id="qr-reader" class="mb-4 rounded-lg overflow-hidden"></div>

        <p class="text-xs text-gray-500 dark:text-gray-400 text-center mb-4">
          ${ui.t('scannerHint')}
        </p>

        <button id="scanner-close-btn" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
          ${ui.t('cancel')}
        </button>
      </div>
    `;

    ui.showModal(content);

    // Initialize QR Scanner
    const html5QrCode = new Html5Qrcode("qr-reader");

    const onScanSuccess = async (decodedText) => {
      // Stop scanner
      await html5QrCode.stop();
      ui.hideModal();

      // Parse QR data: liftec-timer://add-friend/{userId}|{nickname}
      if (decodedText.startsWith('liftec-timer://add-friend/')) {
        const data = decodedText.replace('liftec-timer://add-friend/', '');
        const [userId, nickname] = data.split('|');

        await this.confirmAddFriend(userId, nickname);
      } else {
        ui.showToast(ui.t('invalidQRCode'), 'error');
      }
    };

    const onScanError = (errorMessage) => {
      // Silent - scanning errors are normal
    };

    // Start scanning
    html5QrCode.start(
      { facingMode: "environment" }, // Use back camera
      {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      },
      onScanSuccess,
      onScanError
    ).catch(err => {
      console.error('Scanner start failed:', err);
      ui.showToast(ui.t('cameraError'), 'error');
      ui.hideModal();
    });

    // Close button
    document.getElementById('scanner-close-btn').addEventListener('click', async () => {
      await html5QrCode.stop();
      ui.hideModal();
    });
  }

  /**
   * Confirm adding a friend after QR scan
   */
  async confirmAddFriend(friendUserId, friendNickname) {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white text-center">
            ${ui.t('addFriend')}
          </h3>

          <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 text-center">
            <p class="text-xl font-bold text-gray-900 dark:text-white">@${friendNickname}</p>
          </div>

          <p class="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
            ${ui.t('addFriendConfirm')}
          </p>

          <div class="flex gap-2">
            <button id="add-friend-yes" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">
              ${ui.t('yes')}
            </button>
            <button id="add-friend-no" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('no')}
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      document.getElementById('add-friend-yes').addEventListener('click', async () => {
        try {
          await firebaseService.addFriend(friendUserId);
          ui.hideModal();
          ui.showToast(ui.t('friendAdded').replace('{nickname}', `@${friendNickname}`), 'success');
          resolve(true);
        } catch (error) {
          console.error('Add friend failed:', error);
          ui.hideModal();

          if (error.message.includes('create a share profile first')) {
            ui.showToast(ui.t('createProfileFirst'), 'error');
          } else if (error.message.includes('no share profile')) {
            ui.showToast(ui.t('friendHasNoProfile'), 'error');
          } else {
            ui.showToast(ui.t('error'), 'error');
          }
          resolve(false);
        }
      });

      document.getElementById('add-friend-no').addEventListener('click', () => {
        ui.hideModal();
        resolve(false);
      });
    });
  }

  /**
   * Show friends list with management options
   */
  async showFriendsList() {
    if (!firebaseService.isSignedIn()) {
      ui.showToast(ui.t('mustBeSignedIn'), 'error');
      return;
    }

    try {
      const friends = await firebaseService.getFriends();

      const friendsHtml = friends.length > 0
        ? friends.map(friend => `
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2">
              <div>
                <p class="text-sm font-semibold text-gray-900 dark:text-white">@${friend.nickname}</p>
                <p class="text-xs text-gray-600 dark:text-gray-400">${friend.displayName}</p>
              </div>
              <button class="remove-friend-btn text-red-500 hover:text-red-700 text-sm" data-friend-id="${friend.uid}" data-friend-nickname="${friend.nickname}">
                ${ui.icon('trash-2', 'w-5 h-5')}
              </button>
            </div>
          `).join('')
        : `<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">${ui.t('noFriends')}</p>`;

      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('users')}
            <span>${ui.t('myFriends')}</span>
          </h3>

          <div class="max-h-96 overflow-y-auto mb-4">
            ${friendsHtml}
          </div>

          <button id="friends-close-btn" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('close')}
          </button>
        </div>
      `;

      ui.showModal(content);

      // Remove friend buttons
      document.querySelectorAll('.remove-friend-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const friendId = e.currentTarget.getAttribute('data-friend-id');
          const nickname = e.currentTarget.getAttribute('data-friend-nickname');

          const confirmed = await this.showConfirmDialog(
            ui.t('removeFriend'),
            ui.t('removeFriendConfirm').replace('{nickname}', `@${nickname}`)
          );

          if (confirmed) {
            try {
              await firebaseService.removeFriend(friendId);
              ui.showToast(ui.t('friendRemoved'), 'success');
              ui.hideModal();
              // Reopen to refresh list
              await this.showFriendsList();
            } catch (error) {
              console.error('Remove friend failed:', error);
              ui.showToast(ui.t('error'), 'error');
            }
          }
        });
      });

      document.getElementById('friends-close-btn').addEventListener('click', () => {
        ui.hideModal();
      });

    } catch (error) {
      console.error('Show friends failed:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  /**
   * Show create/edit share profile dialog
   */
  async showShareProfileDialog() {
    if (!firebaseService.isSignedIn()) {
      ui.showToast(ui.t('mustBeSignedIn'), 'error');
      return;
    }

    try {
      const profile = await firebaseService.getShareProfile();
      const isEdit = !!profile;

      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            ${isEdit ? ui.t('editProfile') : ui.t('createProfile')}
          </h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ${ui.t('nickname')} *
              </label>
              <div class="flex gap-2">
                <span class="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-l-lg">@</span>
                <input
                  type="text"
                  id="profile-nickname"
                  value="${profile?.nickname || ''}"
                  placeholder="maya"
                  class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-r-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  ${isEdit ? 'disabled' : ''}
                >
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ${isEdit ? ui.t('nicknameCannotChange') : ui.t('nicknameHint')}
              </p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ${ui.t('displayName')} *
              </label>
              <input
                type="text"
                id="profile-displayname"
                value="${profile?.displayName || ui.settings.username || ''}"
                placeholder="Maya Liftec"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
            </div>
          </div>

          <div class="flex gap-2 mt-6">
            <button id="save-profile-btn" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">
              ${ui.t('save')}
            </button>
            <button id="cancel-profile-btn" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('cancel')}
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      const nicknameInput = document.getElementById('profile-nickname');
      const displayNameInput = document.getElementById('profile-displayname');

      // Real-time nickname validation (only for new profiles)
      if (!isEdit) {
        let checkTimeout;
        nicknameInput.addEventListener('input', () => {
          clearTimeout(checkTimeout);
          const nickname = nicknameInput.value.trim().toLowerCase();

          if (nickname.length < 3) {
            nicknameInput.classList.remove('border-green-500', 'border-red-500');
            return;
          }

          checkTimeout = setTimeout(async () => {
            const available = await firebaseService.checkNicknameAvailable(nickname);
            if (available) {
              nicknameInput.classList.remove('border-red-500');
              nicknameInput.classList.add('border-green-500');
            } else {
              nicknameInput.classList.remove('border-green-500');
              nicknameInput.classList.add('border-red-500');
            }
          }, 500);
        });
      }

      document.getElementById('save-profile-btn').addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim().toLowerCase();
        const displayName = displayNameInput.value.trim();

        if (!nickname || nickname.length < 3) {
          ui.showToast(ui.t('nicknameMinLength'), 'error');
          return;
        }

        if (!displayName) {
          ui.showToast(ui.t('displayNameRequired'), 'error');
          return;
        }

        try {
          if (isEdit) {
            await firebaseService.updateShareProfile({ displayName });
            ui.showToast(ui.t('profileUpdated'), 'success');
          } else {
            await firebaseService.createShareProfile(nickname, displayName);
            ui.showToast(ui.t('profileCreated'), 'success');
          }

          ui.hideModal();
        } catch (error) {
          console.error('Save profile failed:', error);

          if (error.message.includes('already taken')) {
            ui.showToast(ui.t('nicknameTaken'), 'error');
          } else {
            ui.showToast(ui.t('error'), 'error');
          }
        }
      });

      document.getElementById('cancel-profile-btn').addEventListener('click', () => {
        ui.hideModal();
      });

    } catch (error) {
      console.error('Show profile dialog failed:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  // ===== About =====

  async showAbout() {
    const content = `
      <div class="p-6 text-center">
        <h2 class="text-2xl font-bold text-primary mb-2">LIFTEC Timer</h2>
        <p class="text-gray-600 mb-4">Version ${APP_VERSION}</p>
        <p class="text-sm text-gray-600 mb-6">
          Zeiterfassung für LIFTEC<br>
          Dokumentiert Arbeitszeiten, Aufgaben und Zuschläge.
        </p>
        <button id="dialog-ok" class="w-full px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold">
          ${ui.t('close')}
        </button>
      </div>
    `;

    ui.showModal(content);

    document.getElementById('dialog-ok').addEventListener('click', () => {
      ui.hideModal();
    });
  }

  // ===== Backup & Data Management =====

  async showBackupManager() {
    const backups = await storage.getBackups();

    // Build backups list HTML
    let backupsListHTML = '';
    if (backups.length === 0) {
      backupsListHTML = `
        <div class="text-center py-6 text-gray-500 dark:text-gray-400">
          <p>${ui.t('noBackups')}</p>
        </div>
      `;
    } else {
      backupsListHTML = `
        <div class="space-y-3">
          ${backups.map(backup => {
            const date = new Date(backup.timestamp);
            const dateStr = date.toLocaleDateString(ui.settings.language === 'de' ? 'de-DE' : 'en-US');
            const timeStr = date.toLocaleTimeString(ui.settings.language === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' });

            return `
              <div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <p class="font-medium text-gray-900 dark:text-white">
                    ${ui.t('backupDate')} ${dateStr} ${timeStr}
                  </p>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    ${backup.entryCount} ${ui.t('backupSize')}
                  </p>
                </div>
                <div class="flex gap-2">
                  <button class="restore-btn px-3 py-2 text-sm bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors" data-id="${backup.id}">
                    ${ui.t('restoreBackup')}
                  </button>
                  <button class="share-btn px-3 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors" data-id="${backup.id}">
                    ${ui.t('shareBackup')}
                  </button>
                  <button class="delete-btn px-3 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors" data-id="${backup.id}">
                    ${ui.t('deleteBackup')}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const content = `
      <div class="space-y-6">
        <div class="text-center">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            ${ui.t('backupTitle')}
          </h2>
          <p class="text-gray-600 dark:text-gray-300 text-sm">
            ${ui.t('backupDescription')}
          </p>
        </div>

        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 class="font-semibold text-red-900 dark:text-red-200 mb-2">
            ${ui.t('deleteAllData')}
          </h3>
          <p class="text-sm text-red-800 dark:text-red-300 mb-4">
            ${ui.t('deleteAllDataDescription')}
          </p>
          <button id="delete-all-data-btn" class="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium">
            ${ui.t('deleteAllData')}
          </button>
        </div>

        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ${ui.t('backupsList')}
          </h3>
          ${backupsListHTML}
        </div>

        <button id="close-backup-btn" class="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium">
          ${ui.t('close')}
        </button>
      </div>
    `;

    ui.showModal(content);

    // Delete all data
    document.getElementById('delete-all-data-btn').addEventListener('click', async () => {
      await this.showDeleteAllDataDialog();
    });

    // Restore backup
    document.querySelectorAll('.restore-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const backupId = parseInt(e.target.dataset.id);
        await this.restoreBackupDialog(backupId);
      });
    });

    // Share backup
    document.querySelectorAll('.share-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const backupId = parseInt(e.target.dataset.id);
        await this.shareBackup(backupId);
      });
    });

    // Delete backup
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const backupId = parseInt(e.target.dataset.id);
        const confirmed = await this.showConfirmDialog(ui.t('confirmDelete'), ui.t('confirmDeleteMessage'));
        if (confirmed) {
          try {
            await storage.deleteBackup(backupId);
            ui.showToast(ui.t('deleted'), 'success');
            await this.showBackupManager();
          } catch (error) {
            ui.showToast(ui.t('error') + ': ' + error.message, 'error');
          }
        }
      });
    });

    // Close button
    document.getElementById('close-backup-btn').addEventListener('click', () => {
      ui.hideModal();
      this.showSettings();
    });
  }

  async showDeleteAllDataDialog() {
    // First warning
    const confirmed1 = await this.showConfirmDialog(
      ui.t('deleteAllDataWarning'),
      ui.t('deleteAllDataInfo')
    );

    if (!confirmed1) return;

    try {
      ui.showLoading();

      // Create backup automatically
      const backup = await storage.createBackup(ui.settings.username);
      ui.hideLoading();

      // Show backup created message
      const message = ui.t('backupCreated').replace('{count}', backup.entryCount);
      ui.showToast(message, 'success');

      // Second confirmation
      const confirmed2 = await this.showConfirmDialog(
        ui.t('deleteAllDataConfirm'),
        ui.t('deleteAllDataFinal').replace('{count}', backup.entryCount)
      );

      if (!confirmed2) return;

      // Delete all data
      await storage.clear('worklog');
      await storage.clear('currentSession');

      ui.showToast(ui.t('dataDeleted'), 'success');

      // Refresh UI
      await this.renderMainScreen();
      ui.hideModal();
    } catch (error) {
      ui.hideLoading();
      ui.showToast(ui.t('error') + ': ' + error.message, 'error');
    }
  }

  async restoreBackupDialog(backupId) {
    const backup = await storage.getBackup(backupId);
    if (!backup) {
      ui.showToast(ui.t('notFound'), 'error');
      return;
    }

    const confirmed = await this.showConfirmDialog(
      ui.t('restoreBackup'),
      ui.t('restoreSuccess').replace('{count}', backup.entryCount) + '\n\n' + ui.t('confirmDelete')
    );

    if (!confirmed) return;

    try {
      ui.showLoading();
      await storage.restoreBackup(backupId);
      ui.hideLoading();

      const message = ui.t('restoreSuccess').replace('{count}', backup.entryCount);
      ui.showToast(message, 'success');

      await this.renderMainScreen();
      ui.hideModal();
    } catch (error) {
      ui.hideLoading();
      ui.showToast(ui.t('error') + ': ' + error.message, 'error');
    }
  }

  async shareBackup(backupId) {
    try {
      const backup = await storage.getBackup(backupId);
      if (!backup) {
        ui.showToast(ui.t('notFound'), 'error');
        return;
      }

      // Generate CSV from backup
      const csv = await storage.backupToCSV(backup);

      // Create filename
      const date = new Date(backup.timestamp);
      const dateStr = date.toISOString().split('T')[0];
      const filename = `backup_${ui.settings.username}_${dateStr}_${backup.entryCount}.csv`;

      // Use Web Share API if available
      if (navigator.share) {
        try {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const file = new File([blob], filename, { type: 'text/csv' });

          await navigator.share({
            files: [file],
            title: ui.t('backupShareSubject').replace('{name}', ui.settings.username),
            text: ui.t('backupShareBody').replace('{date}', dateStr)
          });
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error('Share failed:', error);
            // Fallback to download
            await this.downloadBackupCSV(csv, filename);
          }
        }
      } else {
        // Fallback: download
        await this.downloadBackupCSV(csv, filename);
      }
    } catch (error) {
      ui.showToast(ui.t('error') + ': ' + error.message, 'error');
    }
  }

  async downloadBackupCSV(csv, filename) {
    try {
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });

      const link = document.createElement('a');
      if (navigator.msSaveBlob) {
        // IE 10+
        navigator.msSaveBlob(blob, filename);
      } else {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      ui.showToast(ui.t('downloaded'), 'success');
    } catch (error) {
      ui.showToast(ui.t('error') + ': ' + error.message, 'error');
    }
  }

  // ===== Version Management =====

  async loadVersionsList() {
    const versionsList = document.getElementById('versions-list');
    if (!versionsList) return;

    try {
      // Load versions.json
      const response = await fetch('versions.json?t=' + Date.now());
      if (!response.ok) throw new Error('Could not load versions');

      const data = await response.json();
      const versions = data.stableVersions || [];

      // Render versions list
      let html = '';
      versions.forEach(version => {
        const isCurrent = version.version === APP_VERSION;
        const statusBadge = isCurrent
          ? '<span class="px-2 py-1 text-xs bg-green-500 text-white rounded">Aktuell</span>'
          : '';

        html += `
          <div class="p-3 bg-white dark:bg-gray-700 rounded-lg border ${isCurrent ? 'border-green-500' : 'border-gray-200 dark:border-gray-600'}">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-gray-900 dark:text-white">v${version.version}</span>
                ${statusBadge}
              </div>
              <span class="text-xs text-gray-500 dark:text-gray-400">${version.releaseDate}</span>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-2">${version.description}</p>
            ${!isCurrent ? `
              <button
                data-version="${version.version}"
                data-tag="${version.tag}"
                class="rollback-btn w-full px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors">
                Zu dieser Version zurückkehren
              </button>
            ` : ''}
          </div>
        `;
      });

      versionsList.innerHTML = html || '<p class="text-sm text-gray-500 dark:text-gray-400">Keine Versionen verfügbar</p>';

      // Attach event listeners to rollback buttons
      document.querySelectorAll('.rollback-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const version = e.target.dataset.version;
          const tag = e.target.dataset.tag;
          await this.confirmAndRollback(version, tag);
        });
      });

    } catch (error) {
      console.error('Error loading versions:', error);
      versionsList.innerHTML = '<p class="text-sm text-red-500">Fehler beim Laden der Versionen</p>';
    }
  }

  async confirmAndRollback(version, tag) {
    const confirmed = await this.showConfirmDialog(
      `Zu Version ${version} zurückkehren?`,
      `Dies wird die App auf Version ${version} zurücksetzen. Alle Ihre Daten werden automatisch gesichert. Möchten Sie fortfahren?`
    );

    if (!confirmed) return;

    try {
      ui.showLoading('Erstelle Backup...');

      // Create automatic backup before rollback
      await storage.createBackup(`Auto-Backup vor Rollback zu v${version}`);

      ui.showLoading('Bereite Rollback vor...');

      // Store rollback info in localStorage
      localStorage.setItem('liftec-rollback-target', version);
      localStorage.setItem('liftec-rollback-tag', tag);

      // Clear service worker cache
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.unregister();
        }
      }

      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      ui.hideLoading();
      ui.showToast('Rollback wird vorbereitet...', 'info');

      // Show info dialog
      await this.showInfoDialog(
        'Rollback-Hinweis',
        `Um zu Version ${version} zurückzukehren, öffnen Sie bitte die App über den folgenden Link in einem neuen Tab:\n\n${window.location.origin}?version=${tag}\n\nAlternativ können Sie die Version manuell von GitHub herunterladen.`
      );

    } catch (error) {
      ui.hideLoading();
      ui.showToast('Rollback fehlgeschlagen: ' + error.message, 'error');
      console.error('Rollback error:', error);
    }
  }

  async showInfoDialog(title, message) {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('info-circle')}
            <span>${title}</span>
          </h3>
          <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line mb-6">${message}</p>
          <button id="info-ok" class="w-full px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
            OK
          </button>
        </div>
      `;

      ui.showModal(content);

      document.getElementById('info-ok').addEventListener('click', () => {
        ui.hideModal();
        resolve(true);
      });
    });
  }

  // ===== Notes Manager (v1.6.1) =====

  async showNotesManager() {
    try {
      // Ensure default categories exist
      await storage.initializeDefaultCategories();

      // Load categories
      let categories = await storage.getAllCategories();

      // Double check - if still no categories, something went wrong
      if (categories.length === 0) {
        console.error('No categories found after initialization');
        ui.showToast('Fehler beim Laden der Kategorien', 'error');
        return;
      }

      // Get last selected category from localStorage
      const lastCategoryId = localStorage.getItem('liftec-last-category-id');
      let currentCategoryId = categories[0].id;

      // Check if last selected category still exists
      if (lastCategoryId) {
        const lastCategory = categories.find(cat => cat.id === parseInt(lastCategoryId));
        if (lastCategory) {
          currentCategoryId = lastCategory.id;
        }
      }

      const content = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('notepad')}
            <span>Meine Notizen</span>
          </h3>
          <button id="close-notes" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            ${ui.icon('x')}
          </button>
        </div>

        <!-- Category Selector -->
        <div class="mb-4 space-y-2">
          <select id="category-selector" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            ${categories.map(cat => `<option value="${cat.id}" ${cat.id === currentCategoryId ? 'selected' : ''}>${cat.name}</option>`).join('')}
          </select>
          <div class="flex gap-2">
            <button id="add-category-btn" class="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm flex items-center justify-center gap-2">
              ${ui.icon('plus', 'w-4 h-4')}
              <span>Kategorie</span>
            </button>
            <button id="manage-categories-btn" class="flex-1 px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm flex items-center justify-center gap-2">
              ${ui.icon('settings', 'w-4 h-4')}
              <span>Verwalten</span>
            </button>
          </div>
        </div>

        <!-- Notes List -->
        <div id="notes-list" class="space-y-3 mb-4 max-h-96 overflow-y-auto">
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Lade Notizen...</p>
        </div>

        <!-- Add Note Buttons -->
        <div class="flex gap-2">
          <button id="add-text-note-btn" class="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm flex items-center justify-center gap-2">
            ${ui.icon('text', 'w-4 h-4')}
            <span>Text-Notiz</span>
          </button>
          <button id="add-checklist-note-btn" class="flex-1 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm flex items-center justify-center gap-2">
            ${ui.icon('list', 'w-4 h-4')}
            <span>Checkliste</span>
          </button>
        </div>
      </div>
    `;

    ui.showModal(content);

    // Close button
    document.getElementById('close-notes').addEventListener('click', () => {
      ui.hideModal();
    });

    // Category selector change
    document.getElementById('category-selector').addEventListener('change', (e) => {
      const categoryId = parseInt(e.target.value);
      // Save last selected category to localStorage
      localStorage.setItem('liftec-last-category-id', categoryId);
      this.loadNotesForCategory(categoryId);
    });

    // Add category
    document.getElementById('add-category-btn').addEventListener('click', () => {
      this.showAddCategoryDialog();
    });

    // Manage categories
    document.getElementById('manage-categories-btn').addEventListener('click', () => {
      this.showManageCategoriesDialog();
    });

    // Add text note
    document.getElementById('add-text-note-btn').addEventListener('click', () => {
      const categorySelector = document.getElementById('category-selector');
      if (categorySelector && categorySelector.value) {
        const categoryId = parseInt(categorySelector.value);
        this.showAddTextNoteDialog(categoryId);
      } else {
        ui.showToast('Bitte wähle eine Kategorie', 'error');
      }
    });

    // Add checklist note
    document.getElementById('add-checklist-note-btn').addEventListener('click', () => {
      const categorySelector = document.getElementById('category-selector');
      if (categorySelector && categorySelector.value) {
        const categoryId = parseInt(categorySelector.value);
        this.showAddChecklistNoteDialog(categoryId);
      } else {
        ui.showToast('Bitte wähle eine Kategorie', 'error');
      }
    });

    // Load notes for first category
    await this.loadNotesForCategory(currentCategoryId);
    } catch (error) {
      console.error('Error in showNotesManager:', error);
      ui.showToast('Fehler beim Öffnen der Notizen: ' + error.message, 'error');
    }
  }

  async loadNotesForCategory(categoryId) {
    const notesList = document.getElementById('notes-list');
    if (!notesList) return;

    const notes = await storage.getNotesByCategory(categoryId);

    if (notes.length === 0) {
      notesList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Keine Notizen in dieser Kategorie</p>';
      return;
    }

    let html = '';
    notes.forEach(note => {
      if (note.type === 'text') {
        html += this.renderTextNoteCard(note);
      } else if (note.type === 'checklist') {
        html += this.renderChecklistNoteCard(note);
      }
    });

    notesList.innerHTML = html;

    // Attach event listeners
    this.attachNoteEventListeners();
  }

  renderTextNoteCard(note) {
    const createdAt = new Date(note.createdAt);
    const timeAgo = this.getTimeAgo(createdAt);

    return `
      <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2">
            ${ui.icon('text', 'w-4 h-4 text-gray-500')}
            <span class="text-xs text-gray-500 dark:text-gray-400">${timeAgo}</span>
          </div>
          <div class="flex gap-1">
            <button class="edit-note-btn p-1 text-gray-500 hover:text-blue-600" data-note-id="${note.id}">
              ${ui.icon('edit', 'w-4 h-4')}
            </button>
            <button class="delete-note-btn p-1 text-gray-500 hover:text-red-600" data-note-id="${note.id}">
              ${ui.icon('trash', 'w-4 h-4')}
            </button>
          </div>
        </div>
        <div class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">${this.escapeHtml(note.content)}</div>
      </div>
    `;
  }

  renderChecklistNoteCard(note) {
    const createdAt = new Date(note.createdAt);
    const timeAgo = this.getTimeAgo(createdAt);
    const completedCount = note.items.filter(item => item.completed).length;

    return `
      <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2">
            ${ui.icon('list', 'w-4 h-4 text-gray-500')}
            <span class="text-xs text-gray-500 dark:text-gray-400">${timeAgo}</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">(${completedCount}/${note.items.length})</span>
          </div>
          <div class="flex gap-1">
            <button class="edit-note-btn p-1 text-gray-500 hover:text-blue-600" data-note-id="${note.id}">
              ${ui.icon('edit', 'w-4 h-4')}
            </button>
            <button class="delete-note-btn p-1 text-gray-500 hover:text-red-600" data-note-id="${note.id}">
              ${ui.icon('trash', 'w-4 h-4')}
            </button>
          </div>
        </div>
        <div class="space-y-1">
          ${note.items.map((item, idx) => `
            <div class="flex items-center gap-2">
              <button class="toggle-item-btn text-gray-500 hover:text-blue-600" data-note-id="${note.id}" data-item-idx="${idx}">
                ${item.completed ? ui.icon('check-circle', 'w-5 h-5 text-green-500') : ui.icon('circle', 'w-5 h-5')}
              </button>
              <span class="text-sm ${item.completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}">${this.escapeHtml(item.text)}</span>
            </div>
          `).join('')}
        </div>
        <button class="add-item-btn mt-2 text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1" data-note-id="${note.id}">
          ${ui.icon('plus', 'w-3 h-3')}
          <span>Item hinzufügen</span>
        </button>
      </div>
    `;
  }

  attachNoteEventListeners() {
    // Toggle checklist items
    document.querySelectorAll('.toggle-item-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const noteId = parseInt(e.currentTarget.dataset.noteId);
        const itemIdx = parseInt(e.currentTarget.dataset.itemIdx);
        await this.toggleChecklistItem(noteId, itemIdx);
      });
    });

    // Add item to checklist
    document.querySelectorAll('.add-item-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const noteId = parseInt(e.currentTarget.dataset.noteId);
        await this.addChecklistItem(noteId);
      });
    });

    // Edit note
    document.querySelectorAll('.edit-note-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const noteId = parseInt(e.currentTarget.dataset.noteId);
        await this.editNote(noteId);
      });
    });

    // Delete note
    document.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const noteId = parseInt(e.currentTarget.dataset.noteId);
        await this.deleteNote(noteId);
      });
    });
  }

  async showAddCategoryDialog() {
    const name = await this.showInputDialog('Neue Kategorie', '');
    if (!name) return;

    await storage.addCategory({ name: name.trim() });
    ui.showToast('Kategorie erstellt', 'success');
    await this.showNotesManager();
  }

  async showManageCategoriesDialog() {
    const categories = await storage.getAllCategories();

    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Kategorien verwalten</h3>
        <div class="space-y-2 mb-4">
          ${categories.map(cat => `
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span class="text-gray-900 dark:text-white">${cat.name}</span>
              <div class="flex gap-2">
                <button class="edit-category-btn px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm" data-category-id="${cat.id}">
                  Bearbeiten
                </button>
                <button class="delete-category-btn px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm" data-category-id="${cat.id}">
                  Löschen
                </button>
              </div>
            </div>
          `).join('')}
        </div>
        <button id="close-manage-categories" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg">
          Schließen
        </button>
      </div>
    `;

    ui.showModal(content);

    document.getElementById('close-manage-categories').addEventListener('click', () => {
      this.showNotesManager();
    });

    document.querySelectorAll('.edit-category-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const categoryId = parseInt(e.target.dataset.categoryId);
        await this.editCategory(categoryId);
      });
    });

    document.querySelectorAll('.delete-category-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const categoryId = parseInt(e.target.dataset.categoryId);
        await this.deleteCategory(categoryId);
      });
    });
  }

  async editCategory(categoryId) {
    const category = await storage.getCategory(categoryId);
    if (!category) return;

    const newName = await this.showInputDialog('Kategorie bearbeiten', category.name);
    if (!newName) return;

    await storage.updateCategory(categoryId, { name: newName.trim() });
    ui.showToast('Kategorie aktualisiert', 'success');
    await this.showManageCategoriesDialog();
  }

  async deleteCategory(categoryId) {
    const confirmed = await this.showConfirmDialog(
      'Kategorie löschen?',
      'Alle Notizen in dieser Kategorie werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.'
    );

    if (!confirmed) return;

    await storage.deleteCategory(categoryId);
    ui.showToast('Kategorie gelöscht', 'success');
    await this.showManageCategoriesDialog();
  }

  async showAddTextNoteDialog(categoryId) {
    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Neue Text-Notiz</h3>
        <textarea id="note-content" rows="6" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white" placeholder="Notiz schreiben..."></textarea>
        <div class="flex gap-2 mt-4">
          <button id="save-text-note" class="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg">
            Speichern
          </button>
          <button id="cancel-text-note" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg">
            Abbrechen
          </button>
        </div>
      </div>
    `;

    ui.showModal(content);

    document.getElementById('save-text-note').addEventListener('click', async () => {
      const noteContent = document.getElementById('note-content').value.trim();
      if (!noteContent) {
        ui.showToast('Bitte Text eingeben', 'error');
        return;
      }

      await storage.addNote({
        categoryId,
        type: 'text',
        content: noteContent
      });

      ui.showToast('Notiz erstellt', 'success');
      await this.showNotesManager();
    });

    document.getElementById('cancel-text-note').addEventListener('click', () => {
      this.showNotesManager();
    });
  }

  async showAddChecklistNoteDialog(categoryId) {
    await storage.addNote({
      categoryId,
      type: 'checklist',
      items: []
    });

    ui.showToast('Checkliste erstellt', 'success');
    await this.showNotesManager();
  }

  async toggleChecklistItem(noteId, itemIdx) {
    const note = await storage.getNote(noteId);
    if (!note || !note.items[itemIdx]) return;

    note.items[itemIdx].completed = !note.items[itemIdx].completed;
    await storage.updateNote(noteId, { items: note.items });

    const categoryId = note.categoryId;
    await this.loadNotesForCategory(categoryId);
  }

  async addChecklistItem(noteId) {
    const note = await storage.getNote(noteId);
    if (!note) return;

    const text = await this.showInputDialog('Neues Item', '');
    if (!text) return;

    note.items.push({ text: text.trim(), completed: false });
    await storage.updateNote(noteId, { items: note.items });

    const categoryId = note.categoryId;
    await this.loadNotesForCategory(categoryId);
  }

  async editNote(noteId) {
    const note = await storage.getNote(noteId);
    if (!note) return;

    if (note.type === 'text') {
      const newContent = await this.showInputDialog('Notiz bearbeiten', note.content, true);
      if (newContent === null) return;

      await storage.updateNote(noteId, { content: newContent.trim() });
      ui.showToast('Notiz aktualisiert', 'success');
      await this.loadNotesForCategory(note.categoryId);
    }
  }

  async deleteNote(noteId) {
    const confirmed = await this.showConfirmDialog(
      'Notiz löschen?',
      'Diese Aktion kann nicht rückgängig gemacht werden.'
    );

    if (!confirmed) return;

    const note = await storage.getNote(noteId);
    await storage.deleteNote(noteId);
    ui.showToast('Notiz gelöscht', 'success');
    await this.loadNotesForCategory(note.categoryId);
  }

  getTimeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'gerade eben';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `vor ${minutes} Min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `vor ${hours} Std`;
    const days = Math.floor(hours / 24);
    return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
  });
} else {
  const app = new App();
  app.init();
}
