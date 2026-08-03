// LIFTEC Timer - Main Application

const APP_VERSION = '1.34.1';

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

      // Einmalige Korrektur alter Stichtage (siehe migrateReferenceDates)
      await this.migrateReferenceDates();

      // Flache Sollstunden in die Satz-Historie überführen
      await this.migrateRateHistory();

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
      ui.showToast(ui.t('errorLoadingApp'), 'error');
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

          newWorker.addEventListener('statechange', async () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Service Worker detected an update - verify with version.json
              await this.verifyAndShowUpdate();
            }
          });
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  // Verify update with version.json before showing banner
  async verifyAndShowUpdate() {
    try {
      // Fetch version.json to compare versions
      const response = await fetch('./version.json?t=' + Date.now());
      const remote = await response.json();

      // Store for later reference
      this.remoteVersion = remote;

      // Only show banner if remote version is actually different
      if (remote.version !== APP_VERSION) {
        console.log(`Update detected: ${APP_VERSION} -> ${remote.version}`);

        // Check dismiss/snooze flags
        const dismissedVersion = localStorage.getItem('dismissedUpdateVersion');
        const remindLater = localStorage.getItem('remindUpdateLater');

        if (dismissedVersion === remote.version) {
          console.log('Update dismissed by user for version:', remote.version);
          return;
        }

        if (remindLater) {
          const remindTime = parseInt(remindLater);
          if (Date.now() < remindTime) {
            console.log('Update reminder postponed');
            return;
          }
        }

        // Show the banner
        this.showUpdateAvailable();
      } else {
        console.log('Service Worker updated but version unchanged:', APP_VERSION);
      }
    } catch (error) {
      console.error('Version verification failed:', error);
      // Fallback: don't show banner if we can't verify
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
    banner.className = 'fixed top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 border border-blue-200 dark:border-blue-700 transition-all';

    banner.innerHTML = `
      <div class="p-3 flex items-center gap-3">
        <button id="update-install-btn" class="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1 -m-1">
          ${ui.icon('download', 'w-5 h-5 text-blue-500')}
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            Update v${updateInfo.version}
          </span>
        </button>
        ${!updateInfo.critical ? `
          <button id="update-dismiss-btn" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            ${ui.icon('x', 'w-4 h-4')}
          </button>
        ` : ''}
      </div>
    `;

    document.body.prepend(banner);

    // Install update on click
    document.getElementById('update-install-btn').addEventListener('click', () => {
      this.performUpdate();
    });

    // Dismiss button (only if not critical)
    if (!updateInfo.critical) {
      document.getElementById('update-dismiss-btn')?.addEventListener('click', () => {
        localStorage.setItem('remindUpdateLater', String(Date.now() + 24 * 60 * 60 * 1000));
        banner.remove();
      });
    }
  }

  showUpdateDetails(updateInfo) {
    const changelogHtml = updateInfo.changelog && updateInfo.changelog.length > 0
      ? updateInfo.changelog.map(item => `<li class="text-sm text-gray-700 dark:text-gray-300">• ${item}</li>`).join('')
      : `<li class="text-sm text-gray-500">${ui.t('noDetailsAvailable')}</li>`;

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

        // Only show banner if we haven't checked in the last 5 seconds (avoid duplicate notifications on page load)
        if (!lastCheck || (now - parseInt(lastCheck)) > 5000) {
          this.showSharedEntriesBanner(sharedEntries.length);
          // Update timestamp ONLY when banner is shown
          localStorage.setItem('lastSharedEntriesCheck', String(now));
        }
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

  /**
   * Posteingang für geteilte Einträge.
   *
   * Zeigt jeden Eintrag mit voller Vorschau, damit man sieht was man annimmt,
   * bevor man es annimmt. Bereits belegte Tage werden vorab markiert.
   */
  async showSharedEntriesInbox() {
    try {
      const sharedEntries = await firebaseService.getSharedEntries();

      // Belegte Tage vorab ermitteln, damit die Karte es anzeigen kann
      const conflicts = new Map();
      for (const share of sharedEntries) {
        const existing = await storage.getWorklogEntryByDate(share.entry.date);
        if (existing) conflicts.set(share.id, existing);
      }

      const entriesHtml = sharedEntries.length > 0
        ? sharedEntries.map(share => this.renderSharedEntryCard(share, conflicts.get(share.id))).join('')
        : `
          <div class="text-center py-8">
            <div class="text-gray-400 dark:text-gray-500 mb-2">${ui.icon('inbox', 'w-10 h-10 mx-auto')}</div>
            <p class="text-sm text-gray-500 dark:text-gray-400">${ui.t('noSharedEntries')}</p>
          </div>
        `;

      const contentHtml = `<div class="space-y-3">${entriesHtml}</div>`;

      // Sammelaktionen erst ab zwei Einträgen - bei einem wären sie nur Lärm
      const acceptable = sharedEntries.filter(s => !conflicts.has(s.id)).length;
      const footerHtml = sharedEntries.length > 1 ? `
        <div class="flex gap-2">
          <button type="button" id="inbox-accept-all" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  ${acceptable === 0 ? 'disabled' : ''}>
            ${ui.icon('check', 'w-4 h-4')}
            <span>${ui.t('acceptAll')} (${acceptable})</span>
          </button>
          <button type="button" id="inbox-decline-all" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('declineAll')}
          </button>
        </div>
        ${acceptable < sharedEntries.length
          ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-2">${ui.t('acceptAllSkipsConflicts')}</p>` : ''}
      ` : '';

      ui.showModalWithHeader({
        title: `${ui.t('sharedEntriesTitle')}${sharedEntries.length ? ` (${sharedEntries.length})` : ''}`,
        icon: 'inbox',
        content: contentHtml,
        footer: footerHtml
      });

      // currentTarget statt target - in den Buttons stecken Icons, ein Klick
      // darauf hätte sonst kein data-share-id
      document.querySelectorAll('.accept-share-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          await this.acceptSharedEntry(e.currentTarget.dataset.shareId, sharedEntries);
        });
      });

      document.querySelectorAll('.decline-share-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          await this.declineSharedEntry(e.currentTarget.dataset.shareId);
        });
      });

      document.getElementById('inbox-accept-all')?.addEventListener('click', async () => {
        await this.acceptAllSharedEntries(sharedEntries, conflicts);
      });

      document.getElementById('inbox-decline-all')?.addEventListener('click', async () => {
        await this.declineAllSharedEntries(sharedEntries);
      });

    } catch (error) {
      console.error('Failed to load shared entries:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  /**
   * Vorschau eines Eintrags: Datum, Zeiten, Nebenzeiten, Tätigkeiten.
   *
   * Absender und Empfänger sehen dadurch dieselbe Darstellung - was im
   * Sende-Blatt steht, steht beim anderen genauso im Posteingang.
   */
  renderEntryPreview(entry) {
    const [d, m, y] = (entry.date || '').split('.');
    const dateObj = (d && m && y) ? new Date(y, m - 1, d) : null;
    const weekday = dateObj
      ? dateObj.toLocaleDateString('de-DE', { weekday: 'long' })
      : '';

    const net = callouts.getNetWorkHours(entry);

    // Nebenzeiten nur zeigen, wenn sie auch gesetzt sind
    const details = [];
    if (entry.pause && entry.pause !== '00:00') details.push(`${ui.t('pause')} ${entry.pause}`);
    if (entry.travelTime && entry.travelTime !== '00:00') details.push(`${ui.t('travelTime')} ${entry.travelTime}`);
    if (entry.surcharge && entry.surcharge !== '00:00') details.push(`${ui.t('surcharge')} ${entry.surcharge}`);

    const tasksHtml = (entry.tasks || []).length > 0
      ? `<div class="mt-2 space-y-1">
           ${entry.tasks.map(t => `
             <div class="flex items-start gap-2 text-sm">
               ${t.type
                 ? `<span class="flex-shrink-0 px-1.5 py-0.5 bg-primary bg-opacity-30 text-gray-900 dark:text-white rounded text-xs font-semibold" title="${TASK_TYPES[t.type] || t.type}">${t.type}</span>`
                 : ''}
               <span class="text-gray-700 dark:text-gray-300">${this.escapeHtml(t.description)}</span>
             </div>
           `).join('')}
         </div>`
      : `<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">${ui.t('noTasks')}</p>`;

    return `
      <div class="flex items-baseline justify-between gap-2">
        <div class="font-semibold text-gray-900 dark:text-white">
          ${entry.date}${weekday ? `<span class="text-sm font-normal text-gray-500 dark:text-gray-400"> · ${weekday}</span>` : ''}
        </div>
        ${net > 0 ? `<div class="text-lg font-bold text-primary flex-shrink-0">${ui.formatHours(net)}</div>` : ''}
      </div>

      ${entry.startTime && entry.endTime
        ? `<div class="text-sm text-gray-600 dark:text-gray-400">${entry.startTime} – ${entry.endTime}</div>` : ''}

      ${details.length
        ? `<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${details.join(' · ')}</div>` : ''}

      ${tasksHtml}
    `;
  }

  /**
   * Eine Karte im Posteingang - Vorschau plus Absender, Konflikt und Aktionen.
   */
  renderSharedEntryCard(share, existingEntry) {
    const conflictHtml = existingEntry
      ? `<div class="mt-2 flex items-start gap-2 text-xs text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 rounded p-2">
           ${ui.icon('warning', 'w-4 h-4 flex-shrink-0')}
           <span>${ui.t('dateAlreadyUsed')}</span>
         </div>`
      : '';

    return `
      <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          ${ui.t('sharedBy')} @${this.escapeHtml(share.fromNickname)}${share.fromName ? ` · ${this.escapeHtml(share.fromName)}` : ''}
        </div>

        ${this.renderEntryPreview(share.entry)}
        ${conflictHtml}

        <div class="flex gap-2 mt-3">
          <button class="accept-share-btn flex-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 flex items-center justify-center gap-2" data-share-id="${share.id}">
            ${ui.icon('check', 'w-4 h-4')}
            <span>${ui.t('acceptShare')}</span>
          </button>
          <button class="decline-share-btn px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600" data-share-id="${share.id}">
            ${ui.t('declineShare')}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Übernimmt einen geteilten Eintrag in den Verlauf.
   * Reine Datenoperation ohne UI - damit sie auch für die Sammelaktion taugt.
   *
   * @returns {'imported'|'skipped'} skipped, wenn der Nutzer abbricht
   */
  async importSharedEntry(share, existingEntry) {
    const entry = { ...share.entry };

    // Sollstunden nach den Einstellungen des EMPFÄNGERS, nicht des Absenders
    if (ui.settings?.workTimeTracking?.enabled && entry.date) {
      const [d, m, y] = entry.date.split('.');
      entry.targetHours = timeAccount.getDailyTargetHours(new Date(y, m - 1, d), ui.settings);
    }

    if (existingEntry) {
      const choice = await this.showDuplicateEntryDialog(
        entry, existingEntry, `@${share.fromNickname} (${share.fromName})`
      );

      if (choice === 'cancel') return 'skipped';

      if (choice === 'overwrite') {
        await storage.updateWorklogEntry({ ...entry, id: existingEntry.id });
      } else {
        await storage.addWorklogEntry(entry);
      }
    } else {
      await storage.addWorklogEntry(entry);
    }

    await firebaseService.deleteSharedEntry(share.id);
    return 'imported';
  }

  async acceptSharedEntry(shareId, sharedEntries) {
    try {
      const share = sharedEntries.find(s => s.id === shareId);
      if (!share) return;

      const existing = await storage.getWorklogEntryByDate(share.entry.date);
      const result = await this.importSharedEntry(share, existing);

      if (result === 'skipped') {
        await this.showSharedEntriesInbox();
        return;
      }

      await this.recalculateVacationDays();
      await this.recalculateTimeAccountBalance();

      ui.showToast(ui.t('entryImported'), 'success');
      await this.refreshInbox();

    } catch (error) {
      console.error('Failed to accept shared entry:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  /**
   * Nimmt alle Einträge an, deren Datum noch frei ist.
   *
   * Einträge mit belegtem Datum bleiben bewusst liegen: Bei einer
   * Sammelaktion soll nicht für jeden Konflikt ein Dialog aufpoppen, und
   * stillschweigend überschreiben wäre das Letzte, was man will.
   */
  async acceptAllSharedEntries(sharedEntries, conflicts) {
    try {
      const free = sharedEntries.filter(s => !conflicts.has(s.id));
      if (free.length === 0) return;

      let imported = 0;
      for (const share of free) {
        await this.importSharedEntry(share, null);
        imported++;
      }

      await this.recalculateVacationDays();
      await this.recalculateTimeAccountBalance();

      const skipped = sharedEntries.length - imported;
      ui.showToast(
        skipped > 0
          ? ui.t('acceptAllDone').replace('{imported}', imported).replace('{skipped}', skipped)
          : ui.t('acceptAllDoneAll').replace('{imported}', imported),
        'success'
      );

      await this.refreshInbox();

    } catch (error) {
      console.error('Failed to accept all shared entries:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  async declineSharedEntry(shareId) {
    try {
      await firebaseService.deleteSharedEntry(shareId);
      ui.showToast(ui.t('shareDeclined'), 'success');
      await this.refreshInbox();

    } catch (error) {
      console.error('Failed to decline shared entry:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  async declineAllSharedEntries(sharedEntries) {
    try {
      const confirmed = await this.showConfirmDialog(
        ui.t('declineAll'),
        ui.t('declineAllConfirm').replace('{count}', sharedEntries.length)
      );
      if (!confirmed) return;

      for (const share of sharedEntries) {
        await firebaseService.deleteSharedEntry(share.id);
      }

      ui.showToast(ui.t('shareDeclined'), 'success');
      await this.refreshInbox();

    } catch (error) {
      console.error('Failed to decline all shared entries:', error);
      ui.showToast(ui.t('error'), 'error');
    }
  }

  /**
   * Nach einer Aktion: Posteingang neu aufbauen oder schliessen, wenn leer.
   */
  async refreshInbox() {
    const remaining = await firebaseService.getSharedEntries();

    if (remaining.length === 0) {
      ui.hideModal();
    } else {
      await this.showSharedEntriesInbox();
    }

    if (this.currentView === 'history') {
      await this.showHistory();
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
            ui.t('hardRefreshTitle'),
            ui.t('hardRefreshMessage')
          );

          if (!confirmed) return;

          try {
            ui.showToast('Aktualisiere...', 'info');
            await this.performHardRefresh();
          } catch (error) {
            console.error('Hard refresh error:', error);
            ui.showToast(ui.t('errorUpdating'), 'error');
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

    // Search FAB (Floating Action Button) v1.19.1
    const searchFab = document.getElementById('search-fab');
    if (searchFab) {
      searchFab.addEventListener('click', async () => {
        await this.showSearch();
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
          ui.showToast(ui.t('errorUpdating'), 'error');
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

    // Step 3: Perform full sync from cloud (if signed in)
    if (firebaseService && firebaseService.isSignedIn()) {
      const success = await firebaseService.fullSync();

      if (!success) {
        console.warn('⚠️ Cloud sync failed, but continuing with local data');
      }
    } else {
      console.log('ℹ️ Not signed in, skipping cloud sync');
    }

    ui.showToast(ui.t('dataReloadedSuccess'), 'success');

    // Step 4: Force reload from server (not cache)
    setTimeout(() => {
      window.location.href = window.location.href;
    }, 1000);
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

    // Add event listener for callout button (only shown during active on-call)
    const calloutBtn = document.getElementById('callout-btn');
    if (calloutBtn) {
      calloutBtn.addEventListener('click', () => this.showCalloutDialog(onCallStatus));
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
          <span>${ui.t('recordAbsence')}</span>
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

  // ===== Zeitkonto-Anzeige =====

  timeAccountColorClass(balance) {
    return balance >= 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  }

  formatTimeAccountValue(balance) {
    return `${balance >= 0 ? '+' : ''}${ui.formatHours(balance)}`;
  }

  /**
   * Schreibt den Saldo in die Anzeige. Wird beim Aufbau und im Sekundentakt
   * benutzt, damit beim Vorzeichenwechsel auch die Farbe mitgeht.
   */
  paintTimeAccount(element, balance) {
    const text = this.formatTimeAccountValue(balance);

    // Der Text ändert sich nur einmal pro Minute - nicht jede Sekunde neu setzen
    if (element.textContent === text) return;
    element.textContent = text;

    // Über classList statt className: die Elemente tragen noch andere Klassen
    // (live-balance, font-semibold), die nicht verschwinden dürfen
    const positive = balance >= 0;
    element.classList.toggle('text-green-600', positive);
    element.classList.toggle('dark:text-green-400', positive);
    element.classList.toggle('text-red-600', !positive);
    element.classList.toggle('dark:text-red-400', !positive);
  }

  /**
   * data-base-Attribut für ein mitlaufendes Element.
   *
   * Nur wenn die laufende Session in den Zeitraum fällt - sonst bekommt das
   * Element keine Basis und der Sekundentakt lässt es in Ruhe. In der
   * Statistik darf eine vergangene Woche nicht mitticken.
   */
  liveBaseAttr(summary, value) {
    return summary.hasRunningSession
      ? ` data-base="${value - summary.runningHours}"`
      : '';
  }

  /**
   * Schreibt alle mitlaufenden Werte fort.
   *
   * Jedes Element trägt in data-base seinen Wert OHNE die laufende Session,
   * hier kommt nur die verstrichene Zeit dazu. Fehlt data-base, gehört das
   * Element nicht zum laufenden Zeitraum und bleibt stehen - so tickt in der
   * Statistik eine vergangene Woche nicht mit.
   */
  updateLiveValues(elapsedHours) {
    document.querySelectorAll('.live-hours').forEach(element => {
      const base = parseFloat(element.dataset.base);
      if (isNaN(base)) return;

      const text = callouts.hoursToHHMM(base + elapsedHours);
      if (element.textContent !== text) element.textContent = text;
    });

    document.querySelectorAll('.live-balance').forEach(element => {
      const base = parseFloat(element.dataset.base);
      if (!isNaN(base)) this.paintTimeAccount(element, base + elapsedHours);
    });
  }

  // ===== Duration Updater =====

  startDurationUpdater() {
    // Update every second
    this.durationInterval = setInterval(() => {
      if (this.session) {
        const elapsedHours = (Date.now() - new Date(this.session.start).getTime()) / 3600000;

        // Zeitkonto und Wochen-/Monatskacheln laufen mit, solange der Dialog offen ist
        this.updateLiveValues(elapsedHours);

        const durationElement = document.querySelector('.duration');
        const labelElement = document.querySelector('#hero-time-display .text-xs');

        if (durationElement) {
          // Check if we should show duration or start time
          const showStartTime = ui.settings?.heroTimeDisplay === 'startTime';
          if (showStartTime) {
            // For start time, we don't need to update every second (it's static)
            const startTimeObj = ui.formatStartTime(this.session.start);
            durationElement.textContent = startTimeObj.time;
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
    const startTime = new Date(this.session.start);
    const now = new Date();
    const hoursSinceStart = (now - startTime) / 3600000;

    // Calculate default end time
    let defaultEndTime;
    if (hoursSinceStart >= 24) {
      // If 24+ hours passed, use start date with 17:00
      defaultEndTime = new Date(startTime);
      defaultEndTime.setHours(17, 0, 0, 0);
    } else {
      // Use start date with current time
      defaultEndTime = new Date(startTime);
      defaultEndTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
    }

    // Show end time picker
    const endTime = await this.showDateTimePicker('Endzeit wählen', defaultEndTime);
    if (!endTime) return;

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

    // Bei Büro-Aufgaben nachfragen. Der gewählte Satz wird am Eintrag
    // gespeichert, damit der Bearbeiten-Dialog ihn später übernehmen kann.
    if (this.hasOfficeTask(this.session.tasks)) {
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
      // Den verwendeten Satz mitspeichern, sonst kann der Bearbeiten-Dialog
      // einen hier abweichend gewählten Wert später nicht rekonstruieren
      surchargePercent,
      tasks: this.session.tasks
    };

    // Add targetHours if work time tracking is enabled
    if (ui.settings?.workTimeTracking?.enabled) {
      entry.targetHours = timeAccount.getDailyTargetHours(startTime, ui.settings);
      entry.entryType = 'work';
    }

    await storage.addWorklogEntry(entry);
    await storage.deleteCurrentSession();

    // Recalculate vacation and time account holistically
    await this.recalculateVacationDays();
    await this.recalculateTimeAccountBalance();

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

      // Check if it's a holiday
      const holidayInfo = austrianHolidays.isHoliday(dateStr);
      const isHoliday = holidayInfo.isHoliday;
      const holidayName = isHoliday ? holidayInfo.name : null;

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
        isHoliday,
        holidayName,
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
            let title = '';

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
            } else if (dayInfo.isHoliday) {
              // Highlight holidays even without entry
              bgClass = 'bg-red-100 dark:bg-red-900';
              textClass = 'text-red-900 dark:text-red-100';
              title = dayInfo.holidayName[ui.settings.language || 'de'];
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
                      data-is-holiday="${dayInfo.isHoliday || false}"
                      ${title ? `title="${title}"` : ''}>
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

    // Click on day to show entry details or create new entry
    document.querySelectorAll('.calendar-day').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const date = e.currentTarget.dataset.date;
        const isHoliday = e.currentTarget.dataset.isHoliday === 'true';
        const entry = entries.find(e => e.date === date);

        ui.hideModal();

        if (entry) {
          // Existing entry - edit it
          await this.editWorklogEntry(entry);
        } else {
          // No entry - create new empty entry for this date
          // If it's a holiday, create as absence entry with 'Feiertag' task
          // Otherwise create as empty work entry
          const newEntry = {
            date: date,
            startTime: '',
            endTime: '',
            pause: '00:00',
            travelTime: '00:00',
            surcharge: '00:00',
            // Standardsatz explizit setzen. Ohne ihn würde die Vorbelegung im
            // Bearbeiten-Dialog den leeren Zuschlag als "Büro-Tag" deuten
            // und auf 0 % gehen.
            surchargePercent: ui.settings?.surchargePercent || 0,
            tasks: isHoliday ? [{ type: '', description: 'Feiertag' }] : [],
            entryType: 'work'
          };
          await this.editWorklogEntry(newEntry);
        }

        // Refresh calendar after editing
        await this.showCalendarView(source);
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
   * Calculate on-call time for a period.
   * Bereitschaft = Fensterdauer - überlappende Arbeitszeit - überlappende Einsätze.
   * Die eigentliche Rechnung liegt in callouts.calculateOnCallHours() - dort gibt
   * es genau eine Implementierung, die auch Nachtschichten korrekt behandelt.
   * @param {string} startDate - Start date in DD.MM.YYYY format
   * @param {string} startTime - Start time in HH:MM format
   * @param {string} endDate - End date in DD.MM.YYYY format
   * @param {string} endTime - End time in HH:MM format
   * @returns {number} On-call hours
   */
  async calculateOnCallTime(startDate, startTime, endDate, endTime) {
    try {
      const start = this.parseDateTime(startDate, startTime);
      const end = this.parseDateTime(endDate, endTime);

      return await callouts.calculateOnCallHours(start, end);
    } catch (error) {
      console.error('Error calculating on-call time:', error);
      return 0;
    }
  }

  // ===== Bereitschaftseinsätze (Callouts) =====

  /**
   * Findet die Bereitschaftsperiode, die einen Zeitpunkt abdeckt.
   * Damit bekommt auch ein nachträglich erfasster Einsatz die richtige
   * Zuordnung, ohne dass der Nutzer sie auswählen muss.
   */
  async findOnCallPeriodForDateTime(dateTime) {
    try {
      const periods = await storage.getAllOnCallPeriods();

      for (const period of periods) {
        if (!period.startDate || !period.startTime) continue;

        const start = this.parseDateTime(period.startDate, period.startTime);
        const end = period.endDate
          ? this.parseDateTime(period.endDate, period.endTime)
          : new Date();

        if (dateTime >= start && dateTime <= end) {
          return period.id;
        }
      }
    } catch (error) {
      console.error('Error looking up on-call period:', error);
    }

    return null;
  }

  /**
   * Dialog zum Erfassen von Bereitschaftseinsätzen.
   * Funktioniert während einer laufenden Bereitschaft und nachträglich -
   * das Datum ist frei wählbar. Die Zuordnung zur Bereitschaftsperiode
   * passiert automatisch anhand des gewählten Zeitpunkts.
   */
  async showCalloutDialog(onCallStatus) {
    const status = (onCallStatus && onCallStatus.active)
      ? onCallStatus
      : await this.getOnCallStatus();

    const isActive = !!(status && status.active);

    const escapeHtml = (value) => this.escapeHtml(value);

    const now = new Date();
    const todayValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Einsätze des gewählten Monats rendern (aktualisiert sich mit dem Datum)
    const renderList = async () => {
      const container = document.getElementById('callout-list');
      if (!container) return;

      const dateValue = document.getElementById('callout-date')?.value || todayValue;
      const [listYear, listMonth] = dateValue.split('-').map(Number);
      const segments = await callouts.getCalloutsForMonth(listYear, listMonth);

      if (segments.length === 0) {
        container.innerHTML = `<p class="text-sm text-gray-500 dark:text-gray-400">${ui.t('calloutNone')}</p>`;
        return;
      }

      // Segmente eines über Mitternacht laufenden Einsatzes zusammenfassen
      const groups = new Map();
      for (const segment of segments) {
        if (!groups.has(segment.groupId)) groups.set(segment.groupId, []);
        groups.get(segment.groupId).push(segment);
      }

      container.innerHTML = Array.from(groups.entries()).map(([groupId, group]) => {
        const first = group[0];
        const last = group[group.length - 1];
        const hours = group.reduce((sum, s) => sum + callouts.getCalloutHours(s), 0);
        const range = group.length > 1
          ? `${first.date} ${first.startTime} – ${last.date} ${last.endTime}`
          : `${first.date} ${first.startTime} – ${first.endTime}`;

        return `
          <div class="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
            <div class="min-w-0">
              <div class="text-sm text-gray-900 dark:text-white truncate">${range}</div>
              ${first.description ? `<div class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(first.description)}</div>` : ''}
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-sm font-semibold text-primary">${ui.hoursToHHMM(hours)}</span>
              <button class="callout-delete-btn text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1" data-group="${groupId}" title="${ui.t('delete')}">
                ${ui.icon('trash')}
              </button>
            </div>
          </div>
        `;
      }).join('');

      container.querySelectorAll('.callout-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const groupId = e.currentTarget.dataset.group;
          await callouts.deleteCallout(groupId);
          ui.showToast(ui.t('calloutDeleted'), 'success');
          await renderList();
        });
      });
    };

    const contentHtml = `
      <div class="space-y-4">
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div>
            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">${ui.t('calloutDate')}</label>
            <input type="date" id="callout-date" value="${todayValue}"
              class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
          </div>

          <div class="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">${ui.t('calloutFrom')}</label>
              <input type="time" id="callout-start"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">${ui.t('calloutTo')}</label>
              <input type="time" id="callout-end"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
            </div>
          </div>

          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">${ui.t('calloutOvernightHint')}</p>

          <div class="mt-3">
            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">${ui.t('calloutDescription')}</label>
            <input type="text" id="callout-description" placeholder="${ui.t('calloutDescription')}"
              class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
          </div>
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400">${ui.t('calloutNoDoubleEntry')}</p>

        <div>
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">${ui.t('calloutRecorded')}</div>
          <div id="callout-list" class="space-y-2"></div>
        </div>
      </div>
    `;

    const footerHtml = `
      <button type="button" id="callout-save" class="w-full px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 flex items-center justify-center gap-2">
        ${ui.icon('check', 'w-4 h-4')}
        <span>${ui.t('calloutSave')}</span>
      </button>
    `;

    ui.showModalWithHeader({
      title: isActive
        ? `${ui.t('calloutTitle')} · ${ui.t('onCall')} #${status.id}`
        : ui.t('calloutTitle'),
      icon: 'plus',
      content: contentHtml,
      footer: footerHtml
    });

    // Liste folgt dem gewählten Monat
    document.getElementById('callout-date').addEventListener('change', () => renderList());

    await renderList();

    document.getElementById('callout-save').addEventListener('click', async () => {
      const dateValue = document.getElementById('callout-date').value;
      const startTime = document.getElementById('callout-start').value;
      const endTime = document.getElementById('callout-end').value;
      const description = document.getElementById('callout-description').value.trim();

      if (!dateValue || !startTime || !endTime) {
        ui.showToast(ui.t('calloutInvalidTime'), 'error');
        return;
      }

      if (startTime === endTime) {
        ui.showToast(ui.t('calloutZeroDuration'), 'error');
        return;
      }

      // 'YYYY-MM-DD' -> 'DD.MM.YYYY'
      const [year, month, day] = dateValue.split('-');
      const dateStr = `${day}.${month}.${year}`;

      // Passende Bereitschaftsperiode automatisch ermitteln - so bekommt auch
      // ein nachträglich erfasster Einsatz die richtige Zuordnung
      const periodId = await this.findOnCallPeriodForDateTime(
        this.parseDateTime(dateStr, startTime)
      );

      try {
        await callouts.addCallout({
          onCallPeriodId: periodId,
          date: dateStr,
          startTime,
          endTime,
          description
        });

        ui.showToast(ui.t('calloutSaved'), 'success');

        // Eingabefelder für den nächsten Einsatz leeren
        document.getElementById('callout-start').value = '';
        document.getElementById('callout-end').value = '';
        document.getElementById('callout-description').value = '';

        await renderList();
      } catch (error) {
        console.error('Error saving callout:', error);
        ui.showToast(ui.t('error'), 'error');
      }
    });
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

  /**
   * Erkennt Büro-Aufgaben. Bei ihnen wird beim Session-Ende nach dem
   * Zuschlags-Prozentsatz gefragt, statt still den Standardsatz zu nehmen.
   * Eine Aufgabe ohne Typ zählt ebenfalls als Büro.
   */
  /**
   * Vorbelegung des Zuschlags-Prozentsatzes im Bearbeiten-Dialog.
   *
   * Reihenfolge ist wichtig: Ein gespeicherter Satz gewinnt immer. Fehlt er
   * (Altbestand vor v1.24.0), ist ein Zuschlag von 00:00 als Absicht zu lesen -
   * das war ein Büro-Tag und darf beim Öffnen nicht auf 80 % hochspringen.
   */
  getInitialSurchargePercent(entry, settings) {
    if (typeof entry.surchargePercent === 'number') {
      return entry.surchargePercent;
    }

    if (!entry.surcharge || entry.surcharge === '00:00') {
      return 0;
    }

    return settings?.surchargePercent || 0;
  }

  hasOfficeTask(tasks) {
    return (tasks || []).some(t =>
      t.type === '' ||
      (t.description || '').toLowerCase().includes('office') ||
      (t.description || '').toLowerCase().includes('büro')
    );
  }

  /**
   * Priorität einer Abwesenheitsart.
   * Reihenfolge: Arbeitszeit > Feiertag > Krankenstand > Urlaub > Zeitausgleich
   */
  getAbsencePriority(absenceType) {
    const priorities = {
      'Feiertag': 4,
      'Krankenstand': 3,
      'Urlaub': 2,
      'Zeitausgleich': 1
    };
    return priorities[absenceType] || 0;
  }

  /**
   * Priorität eines bestehenden Eintrags. Erfasste Arbeitszeit schlägt jede
   * Abwesenheit und wird deshalb nie automatisch überschrieben.
   */
  getEntryPriority(entry) {
    if (entry.startTime && entry.endTime) {
      return 100;
    }
    return this.getAbsencePriority(entry.tasks?.[0]?.description);
  }

  async showAbsenceEntry() {
    // Step 1: Choose absence type
    const absenceType = await this.showAbsenceTypeDialog();
    if (!absenceType) return;

    // Step 2: Choose date range (von-bis in one dialog)
    const dateRange = await this.showDateRangePicker();
    if (!dateRange) return;

    const { startDate, endDate } = dateRange;

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
        const newPriority = this.getAbsencePriority(absenceType);

        // Only delete conflicting entries with LOWER priority
        for (const conflict of conflicts) {
          const conflictPriority = this.getEntryPriority(conflict);

          if (conflictPriority < newPriority) {
            await storage.deleteWorklogEntry(conflict.id);
          }
        }
      }
    }

    // Step 5: Save absence entries (skip days with higher priority existing entries)
    const entries = [];
    const currentDate = new Date(startDate);

    const newPriority = this.getAbsencePriority(absenceType);

    while (currentDate <= endDate) {
      const dateStr = formatDate(currentDate);

      // Check if this date is a holiday
      const holidayCheck = austrianHolidays.isHoliday(dateStr);
      const isHoliday = holidayCheck.isHoliday;

      // Skip if this is an official holiday AND we're trying to enter Urlaub/Krankenstand/Zeitausgleich
      // (Only allow Feiertag entries on official holidays)
      if (isHoliday && absenceType !== 'Feiertag') {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Skip weekends (Saturday=6, Sunday=0) unless we're entering a Feiertag
      const dayOfWeek = currentDate.getDay();

      if ((dayOfWeek === 0 || dayOfWeek === 6) && absenceType !== 'Feiertag') {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Check if this day already has an entry with higher priority
      const existing = await storage.getWorklogEntryByDate(dateStr);
      if (existing) {
        const existingPriority = this.getEntryPriority(existing);

        if (existingPriority >= newPriority) {
          // Skip this day - higher or equal priority already exists
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
      }

      // Get target hours for this day to set vacationDays correctly
      const targetHours = timeAccount.getDailyTargetHours(currentDate, ui.settings);

      // Determine entry type based on absence type
      const entryTypeMap = {
        'Urlaub': 'vacation',
        'Krankenstand': 'sick',
        'Feiertag': 'holiday',
        'Zeitausgleich': 'timeoff'
      };

      const entry = {
        date: dateStr,
        startTime: '',
        endTime: '',
        pause: '',
        travelTime: '',
        surcharge: '',
        tasks: [{ type: '', description: absenceType }],
        entryType: entryTypeMap[absenceType] || '',
        targetHours: targetHours,  // Store daily target hours for this day
        // Set vacationDays: 1 if Urlaub on workday, 0 otherwise
        vacationDays: (absenceType === 'Urlaub' && targetHours > 0) ? 1 : 0
      };

      entries.push(entry);
      await storage.addWorklogEntry(entry);

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Recalculate vacation and time account holistically
    await this.recalculateVacationDays();
    await this.recalculateTimeAccountBalance();

    await this.renderMainScreen();
    ui.showToast(ui.t('absenceEntriesSaved').replace('{count}', entries.length), 'success');
  }

  /**
   * Stichtag ('YYYY-MM-DD') als lokales Datum parsen.
   * new Date('2025-08-01') würde als UTC gelesen und in Österreich um Stunden
   * verschoben - deshalb hier explizit als Lokalzeit aufbauen.
   * Gibt null zurück, wenn kein gültiger Stichtag gesetzt ist.
   */
  /**
   * Einmalige Korrektur alter Stichtage.
   *
   * Bis v1.20.9 wurde der Stichtag mit toISOString() geschrieben. Das rechnet
   * nach UTC und machte in Österreich (UTC+1/+2) aus dem 1. eines Monats den
   * letzten Tag des Vormonats. Beim Lesen hob ein zweiter Fehler das wieder
   * auf: die Schleife startete einen Tag nach dem Stichtag. Beide Fehler sind
   * jetzt behoben - dadurch wäre ein alter, verschobener Stichtag um einen Tag
   * zu früh und würde einen zusätzlichen Tag in den Saldo rechnen.
   *
   * Ein Stichtag ist per Definition immer der 1. eines Monats (der Dialog
   * erzeugt ihn als "erster Tag des Folgemonats"). Alles andere stammt aus der
   * alten Schreibweise und wird um einen Tag nach vorne gerückt.
   */
  async migrateReferenceDates() {
    const wtt = ui.settings?.workTimeTracking;
    if (!wtt) return;

    const shiftIfLegacy = (value) => {
      const date = timeAccount.parseReferenceDate(value);
      if (!date || date.getDate() === 1) return null;  // schon korrekt
      date.setDate(date.getDate() + 1);
      return this.formatReferenceDate(date);
    };

    let changed = false;

    const fixedTimeAccount = shiftIfLegacy(wtt.timeAccount?.referenceDate);
    if (fixedTimeAccount) {
      console.log(`Stichtag Zeitkonto migriert: ${wtt.timeAccount.referenceDate} -> ${fixedTimeAccount}`);
      wtt.timeAccount.referenceDate = fixedTimeAccount;
      changed = true;
    }

    const fixedVacation = shiftIfLegacy(wtt.vacation?.referenceDate);
    if (fixedVacation) {
      console.log(`Stichtag Urlaub migriert: ${wtt.vacation.referenceDate} -> ${fixedVacation}`);
      wtt.vacation.referenceDate = fixedVacation;
      changed = true;
    }

    if (changed) {
      await storage.saveSettings(ui.settings);
    }
  }

  // ===== Statistik =====

  /**
   * Wochen- bzw. Monatsübersicht.
   *
   * Nach dem Muster von renderCalendarView(): Der Zeitraum ist ein
   * Funktionsparameter, Blättern ruft die Funktion rekursiv auf, Listener
   * werden nach jedem Render neu gebunden.
   */
  async showStatistics(mode = 'month', refDate = new Date()) {
    const isWeek = mode === 'week';
    const bounds = isWeek
      ? statistics.getWeekBounds(refDate)
      : callouts.getMonthBounds(refDate.getFullYear(), refDate.getMonth() + 1);

    const summary = await statistics.calculatePeriodSummary(
      bounds.start, bounds.end, ui.settings, this.session
    );

    // Titel
    let periodLabel;
    if (isWeek) {
      const last = new Date(bounds.end.getTime() - 1);
      const short = (d) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
      periodLabel = `KW ${statistics.getWeekNumber(bounds.start)} · ${short(bounds.start)}–${short(last)}${last.getFullYear()}`;
    } else {
      periodLabel = `${ui.t('monthNames')[refDate.getMonth()]} ${refDate.getFullYear()}`;
    }

    const hhmm = (h) => callouts.hoursToHHMM(h);
    const money = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const balanceColor = summary.balance >= 0
      ? 'text-green-600 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
    const balanceSign = summary.balance >= 0 ? '+' : '';

    const livedot = summary.hasRunningOnCall
      ? '<span class="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1"></span>'
      : '';

    const tile = (label, value, extraClass = '') => `
      <div>
        <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">${label}</div>
        <div class="text-sm font-semibold ${extraClass || 'text-gray-900 dark:text-white'}">${value}</div>
      </div>
    `;

    const tabClass = (active) => active
      ? 'flex-1 px-3 py-2 text-sm rounded-lg border bg-primary border-primary text-gray-900 font-semibold'
      : 'flex-1 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary';

    const contentHtml = `
      <div class="space-y-4">
        <!-- Umschalter -->
        <div class="flex gap-2">
          <button id="stats-mode-week" class="${tabClass(isWeek)}">${ui.t('week')}</button>
          <button id="stats-mode-month" class="${tabClass(!isWeek)}">${ui.t('month')}</button>
        </div>

        <!-- Navigation -->
        <div class="flex items-center justify-between">
          <button id="stats-prev" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 btn-press">
            ${ui.icon('chevron-left', 'w-6 h-6')}
          </button>
          <div class="text-base font-semibold text-gray-900 dark:text-white text-center">${periodLabel}</div>
          <button id="stats-next" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 btn-press">
            ${ui.icon('chevron-right', 'w-6 h-6')}
          </button>
        </div>

        <!-- Saldo -->
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4 border border-blue-200 dark:border-gray-600">
          <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">${ui.t('balance')}</div>
          <div class="text-3xl font-bold"><span class="live-balance ${balanceColor}"${this.liveBaseAttr(summary, summary.balance)}>${balanceSign}${hhmm(summary.balance)}</span></div>
          <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            ${ui.t('actual')} <span class="live-hours"${this.liveBaseAttr(summary, summary.actualHours)}>${hhmm(summary.actualHours)}</span> · ${ui.t('target')} ${hhmm(summary.targetHours)}
          </div>
        </div>

        <!-- Bereitschaft & Einsätze -->
        ${ui.settings?.onCallEnabled ? `
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">${ui.t('onCall')}</div>
              <div class="text-2xl font-bold text-gray-900 dark:text-white flex items-center">${hhmm(summary.onCallHours)}${livedot}</div>
            </div>
            <div>
              <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">${ui.t('callouts')}</div>
              <div class="text-2xl font-bold text-gray-900 dark:text-white">${summary.calloutCount} × ${hhmm(summary.calloutHours)}</div>
            </div>
          </div>
          ${summary.onCallEuro !== null ? `
            <div class="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300">
              ${money(summary.onCallEuro)} €${summary.onCallZaHours !== null
                ? `  ≙  ${hhmm(summary.onCallZaHours)} ${ui.t('timeAccount')}` : ''}
            </div>` : ''}
        </div>
        ` : ''}

        <!-- Tageszähler -->
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div class="grid grid-cols-2 gap-y-3 gap-x-4">
            ${tile(ui.t('entryTypeWork'), summary.workDays)}
            ${tile(ui.t('entryTypeVacation'), summary.vacationDays)}
            ${tile(ui.t('entryTypeSick'), summary.sickDays)}
            ${tile(ui.t('entryTypeHoliday'), summary.holidayDays)}
            ${tile(ui.t('entryTypeTimeOff'), summary.timeoffDays)}
            ${tile(ui.t('missingDays'), summary.missingDays,
                   summary.missingDays > 0 ? 'text-red-600 dark:text-red-400' : '')}
          </div>
          ${summary.missingDays > 0
            ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-3">${ui.t('missingDaysHint')}</p>` : ''}
        </div>

        <!-- Resturlaub -->
        <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <span class="text-sm text-gray-600 dark:text-gray-400">${ui.t('remainingVacation')}</span>
          <span class="text-lg font-bold text-blue-600 dark:text-blue-400">
            ${ui.settings?.workTimeTracking?.vacation?.remainingDays ?? 0} ${ui.t('days')}
          </span>
        </div>
      </div>
    `;

    ui.showModalWithHeader({
      title: ui.t('statistics'),
      icon: 'chart-bar',
      content: contentHtml
    });

    // Listener nach jedem Render neu binden
    document.getElementById('stats-mode-week').addEventListener('click',
      () => this.showStatistics('week', refDate));
    document.getElementById('stats-mode-month').addEventListener('click',
      () => this.showStatistics('month', refDate));

    document.getElementById('stats-prev').addEventListener('click', () => {
      const d = new Date(refDate);
      isWeek ? d.setDate(d.getDate() - 7) : d.setMonth(d.getMonth() - 1, 1);
      this.showStatistics(mode, d);
    });

    document.getElementById('stats-next').addEventListener('click', () => {
      const d = new Date(refDate);
      isWeek ? d.setDate(d.getDate() + 7) : d.setMonth(d.getMonth() + 1, 1);
      this.showStatistics(mode, d);
    });
  }
  // ===== Sollstunden & Sätze =====

  /**
   * Sätze absteigend nach Gültigkeitsdatum, jüngster zuerst.
   */
  getSortedRates() {
    const history = ui.settings?.workTimeTracking?.rateHistory || [];
    return [...history].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  }

  /**
   * 'YYYY-MM-DD' -> 'DD.MM.YYYY' für die Anzeige
   */
  formatValidFrom(value) {
    const parts = String(value || '').split('-');
    if (parts.length !== 3) return value || '';
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  /**
   * Liste der Sätze in den Einstellungen aufbauen.
   * Wird nach jeder Änderung erneut aufgerufen, Listener kommen dabei neu.
   */
  renderRatesList() {
    const container = document.getElementById('rates-list');
    if (!container) return;

    const rates = this.getSortedRates();

    if (rates.length === 0) {
      container.innerHTML = `<p class="text-sm text-gray-500 dark:text-gray-400">${ui.t('ratesNone')}</p>`;
      return;
    }

    const fmtMoney = (v) => Number(v || 0).toFixed(2).replace('.', ',');

    container.innerHTML = rates.map((rate, index) => {
      const weekly = Object.values(rate.dailyTargetHours || {})
        .reduce((sum, h) => sum + (Number(h) || 0), 0);

      const money = [];
      if (rate.onCallRate > 0) money.push(`${fmtMoney(rate.onCallRate)} €/h ${ui.t('onCall')}`);
      if (rate.hourlyWage > 0) money.push(`${fmtMoney(rate.hourlyWage)} € ${ui.t('hourlyWageShort')}`);

      return `
        <div class="flex items-center justify-between gap-2 bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-900 dark:text-white">
              ${ui.t('validFrom')} ${this.formatValidFrom(rate.validFrom)}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
              ${ui.formatHours(weekly)}/${ui.t('week')}${money.length ? ' · ' + money.join(' · ') : ''}
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button class="rate-edit-btn text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1" data-index="${index}" title="${ui.t('edit')}">
              ${ui.icon('edit')}
            </button>
            ${rates.length > 1 ? `
            <button class="rate-delete-btn text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1" data-index="${index}" title="${ui.t('delete')}">
              ${ui.icon('trash')}
            </button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.rate-edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const rate = this.getSortedRates()[parseInt(e.currentTarget.dataset.index)];
        const saved = await this.showRateDialog(rate);
        if (saved) this.renderRatesList();
      });
    });

    container.querySelectorAll('.rate-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const rate = this.getSortedRates()[parseInt(e.currentTarget.dataset.index)];
        const history = ui.settings.workTimeTracking.rateHistory;

        ui.settings.workTimeTracking.rateHistory = history.filter(r => r.validFrom !== rate.validFrom);
        await storage.saveSettings(ui.settings);
        await this.recalculateTimeAccountBalance();

        ui.showToast(ui.t('rateDeleted'), 'success');
        this.renderRatesList();
      });
    });
  }

  /**
   * Dialog zum Anlegen oder Bearbeiten eines Satzes.
   * Gibt true zurück, wenn gespeichert wurde.
   *
   * Das Gültig-ab-Datum ist der Schlüssel: Ein Satz gilt ab diesem Tag, bis
   * ein jüngerer greift. Wird ein Satz rückwirkend eingefügt, rechnen sich
   * die betroffenen Monate danach automatisch neu.
   */
  async showRateDialog(existingRate) {
    const isNew = !existingRate;
    const rate = existingRate || {
      validFrom: this.formatReferenceDate(new Date()),
      dailyTargetHours: { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 },
      onCallRate: 0,
      hourlyWage: 0
    };

    const days = [
      ['monday', ui.t('monday')], ['tuesday', ui.t('tuesday')], ['wednesday', ui.t('wednesday')],
      ['thursday', ui.t('thursday')], ['friday', ui.t('friday')],
      ['saturday', ui.t('saturday')], ['sunday', ui.t('sunday')]
    ];

    const contentHtml = `
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">${ui.t('validFrom')}</label>
          <input type="date" id="rate-valid-from" value="${rate.validFrom}"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${ui.t('validFromHint')}</p>
        </div>

        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">${ui.t('dailyTarget')}</div>
          <div class="space-y-2">
            ${days.map(([key, label]) => `
              <div class="flex items-center justify-between gap-3">
                <label class="text-sm text-gray-600 dark:text-gray-400">${label}</label>
                <input type="text" id="rate-${key}" value="${ui.formatHours(rate.dailyTargetHours?.[key] || 0)}" inputmode="text"
                  class="w-24 px-2 py-1.5 text-sm text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
              </div>
            `).join('')}
          </div>
          <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">${ui.t('weeklyTarget')}</span>
            <span id="rate-weekly-total" class="text-sm font-bold text-primary">0</span>
          </div>
        </div>

        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">${ui.t('rateMoney')}</div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">${ui.t('onCallRate')}</label>
              <input type="text" id="rate-oncall" value="${rate.onCallRate || 0}" inputmode="decimal"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">${ui.t('hourlyWage')}</label>
              <input type="text" id="rate-wage" value="${rate.hourlyWage || 0}" inputmode="decimal"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
            </div>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">${ui.t('rateMoneyHint')}</p>
        </div>
      </div>
    `;

    const footerHtml = `
      <button type="button" id="rate-save" class="w-full px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 flex items-center justify-center gap-2">
        ${ui.icon('check', 'w-4 h-4')}
        <span>${ui.t('save')}</span>
      </button>
    `;

    return new Promise((resolve) => {
      ui.showModalWithHeader({
        title: isNew ? ui.t('rateAdd') : ui.t('rateEdit'),
        icon: 'clock',
        content: contentHtml,
        footer: footerHtml,
        onClose: () => { ui.hideModal(); resolve(false); }
      });

      const updateTotal = () => {
        const total = days.reduce((sum, [key]) =>
          sum + this.parseTimeInput(document.getElementById(`rate-${key}`)?.value), 0);
        document.getElementById('rate-weekly-total').textContent =
          ui.formatHours(total);
      };

      days.forEach(([key]) => {
        document.getElementById(`rate-${key}`)?.addEventListener('input', updateTotal);
      });
      updateTotal();

      document.getElementById('rate-save').addEventListener('click', async () => {
        const validFrom = document.getElementById('rate-valid-from').value;

        if (!validFrom) {
          ui.showToast(ui.t('validFromMissing'), 'error');
          return;
        }

        const dailyTargetHours = {};
        for (const [key] of days) {
          dailyTargetHours[key] = this.parseTimeInput(document.getElementById(`rate-${key}`).value);
        }

        const newRate = {
          validFrom,
          dailyTargetHours,
          onCallRate: this.parseDaysInput(document.getElementById('rate-oncall').value),
          hourlyWage: this.parseDaysInput(document.getElementById('rate-wage').value)
        };

        const history = ui.settings.workTimeTracking.rateHistory || [];

        // Ein Datum darf nur einmal vorkommen. Beim Bearbeiten wird der alte
        // Eintrag ersetzt, auch wenn das Datum geändert wurde.
        const without = history.filter(r =>
          r.validFrom !== validFrom &&
          (isNew || r.validFrom !== existingRate.validFrom)
        );

        ui.settings.workTimeTracking.rateHistory = [...without, newRate];
        await storage.saveSettings(ui.settings);

        // Sollstunden geändert -> der Saldo muss neu gerechnet werden
        await this.recalculateTimeAccountBalance();

        ui.hideModal();
        ui.showToast(ui.t('rateSaved'), 'success');
        resolve(true);
      });
    });
  }

  /**
   * Überführt die flachen Sollstunden in die Satz-Historie.
   *
   * Bis v1.24.0 gab es genau einen Satz Sollstunden, der für ALLE Zeiträume
   * galt. Wer seine Wochenstunden änderte, verschob damit rückwirkend die
   * Fehltags-Schuld aller Altmonate. Ab jetzt hat jeder Satz ein Gültig-ab-
   * Datum; der migrierte Alteintrag gilt ab 2000, deckt also alles Bisherige
   * unverändert ab.
   */
  async migrateRateHistory() {
    const wtt = ui.settings?.workTimeTracking;
    if (!wtt) return;

    if (Array.isArray(wtt.rateHistory) && wtt.rateHistory.length > 0) {
      return; // schon migriert
    }

    wtt.rateHistory = [{
      validFrom: '2000-01-01',
      dailyTargetHours: { ...(wtt.dailyTargetHours || {}) },
      onCallRate: 0,     // 0 = nicht gepflegt, Euro-Anzeige bleibt aus
      hourlyWage: 0
    }];

    // Die flache Variante entfernen, damit es keine zweite Quelle gibt
    delete wtt.dailyTargetHours;

    console.log('Sollstunden in die Satz-Historie überführt');
    await storage.saveSettings(ui.settings);
  }

  /**
   * Date -> 'YYYY-MM-DD' in Lokalzeit.
   * NICHT toISOString() verwenden - das rechnet nach UTC und macht in
   * Österreich aus dem 1. eines Monats den 31. des Vormonats.
   */
  formatReferenceDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Recalculate vacation remaining days holistically
  async recalculateVacationDays() {
    if (!ui.settings?.workTimeTracking?.enabled) {
      return; // Work time tracking not enabled
    }

    const vacation = ui.settings.workTimeTracking.vacation;
    const referenceDate = timeAccount.parseReferenceDate(vacation.referenceDate);

    // Ohne Stichtag gibt es keine Basis zum Rechnen (Onboarding nicht abgeschlossen)
    if (!referenceDate) {
      console.warn('recalculateVacationDays: kein Stichtag gesetzt, übersprungen');
      return;
    }

    const referenceRemaining = vacation.referenceRemaining !== undefined && vacation.referenceRemaining !== null
      ? vacation.referenceRemaining
      : (vacation.annualDays || 25);

    // Get all entries from reference date onwards (Stichtag inklusive)
    const allEntries = await storage.getAllWorklogEntries();
    const entriesAfterReference = allEntries.filter(entry => {
      const [d, m, y] = entry.date.split('.');
      const entryDate = new Date(y, m - 1, d);
      return entryDate >= referenceDate;
    });

    // Calculate vacation days used
    let vacationUsed = 0;
    for (const entry of entriesAfterReference) {
      // Count explicit vacationDays field (respects targetHours check)
      if (entry.vacationDays && entry.vacationDays > 0) {
        vacationUsed += entry.vacationDays;
      }
    }

    // Set remaining days = reference - used
    ui.settings.workTimeTracking.vacation.remainingDays = referenceRemaining - vacationUsed;
    await storage.saveSettings(ui.settings);
  }


  // Recalculate time account balance holistically
  async recalculateTimeAccountBalance() {
    if (!ui.settings?.workTimeTracking?.enabled) {
      return; // Work time tracking not enabled
    }

    const balance = await statistics.calculateTimeAccountBalance(ui.settings);

    if (balance === null) {
      console.warn('recalculateTimeAccountBalance: kein Stichtag gesetzt, übersprungen');
      return;
    }

    ui.settings.workTimeTracking.timeAccount.currentBalance = balance;
    await storage.saveSettings(ui.settings);
  }

  /**
   * Zeitkonto-Saldo für die Anzeige, inklusive der laufenden Session.
   *
   * Bewusst frisch gerechnet statt aus currentBalance gelesen: der
   * gespeicherte Wert stammt vom letzten Speichern eines Eintrags. Startet
   * man morgens eine Session, ohne vorher etwas gespeichert zu haben, fehlt
   * darin das Tagessoll von heute - der angezeigte Saldo wäre um ein volles
   * Tagessoll zu hoch.
   *
   * @returns {Promise<{base: number, balance: number}|null>}
   *   base = Saldo ohne die laufende Session, damit die Anzeige nur noch
   *   die verstrichene Zeit addieren muss und nicht jede Sekunde neu rechnet
   */
  async getLiveTimeAccountBalance() {
    const base = await statistics.calculateTimeAccountBalance(ui.settings);
    if (base === null) return null;

    const running = this.session
      ? (Date.now() - new Date(this.session.start).getTime()) / 3600000
      : 0;

    return { base, balance: base + running };
  }

  async showAbsenceTypeDialog() {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('calendar')}
            <span>${ui.t('recordAbsence')}</span>
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${ui.t('chooseAbsenceType')}:</p>
          <div class="space-y-2">
            <button class="absence-type-btn w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2" data-type="Urlaub">
              ${ui.icon('sun')}
              <span>${ui.t('entryTypeVacation')}</span>
            </button>
            <button class="absence-type-btn w-full px-4 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 flex items-center justify-center gap-2" data-type="Zeitausgleich">
              ${ui.icon('clock')}
              <span>${ui.t('entryTypeTimeOff')}</span>
            </button>
            <button class="absence-type-btn w-full px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 flex items-center justify-center gap-2" data-type="Krankenstand">
              ${ui.icon('heart-pulse')}
              <span>${ui.t('entryTypeSick')}</span>
            </button>
          </div>
          <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('cancel')}
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
            <span>${ui.t('choosePeriod')}</span>
          </h3>
          <div class="space-y-2">
            <button id="period-single" class="w-full px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
              ${ui.icon('calendar-day')}
              <span>${ui.t('singleDay')}</span>
            </button>
            <button id="period-range" class="w-full px-4 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 flex items-center justify-center gap-2">
              ${ui.icon('calendar-range')}
              <span>${ui.t('dateRange')}</span>
            </button>
          </div>
          <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('cancel')}
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

  showDateRangePicker() {
    return new Promise(async (resolve) => {
      const today = new Date();
      let startDate = null;
      let endDate = null;
      let currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Load all worklog entries to show existing entries
      const allEntries = await storage.getAllWorklogEntries();

      const renderCalendar = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = (firstDay.getDay() + 6) % 7;

        const monthNames = ui.t('monthNames');
        const weekdayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

        let calendarDays = [];

        for (let i = 0; i < startDayOfWeek; i++) {
          calendarDays.push({ empty: true });
        }

        for (let day = 1; day <= daysInMonth; day++) {
          const date = new Date(year, month, day);
          const dateStr = ui.formatDate(date);
          const isToday = date.toDateString() === today.toDateString();

          let isStart = false;
          let isEnd = false;
          let inRange = false;

          if (startDate) {
            isStart = date.toDateString() === startDate.toDateString();
            if (endDate) {
              isEnd = date.toDateString() === endDate.toDateString();
              inRange = date >= startDate && date <= endDate;
            }
          }

          // Check if there's an existing entry for this day
          const entry = allEntries.find(e => e.date === dateStr);
          let entryType = null;
          if (entry && entry.tasks && entry.tasks.length > 0) {
            const task = entry.tasks[0];
            if (task.type === '' && task.description) {
              entryType = task.description; // Urlaub, Krankenstand, etc.
            } else {
              entryType = 'work';
            }
          }

          calendarDays.push({
            day,
            date,
            dateStr,
            isToday,
            isStart,
            isEnd,
            inRange,
            entryType
          });
        }

        const calendarHTML = `
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
              ${ui.icon('calendar')}
              <span>${ui.t('choosePeriod')}</span>
            </h3>

            <div class="flex items-center justify-between mb-4">
              <button id="prev-month" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 btn-press">
                ${ui.icon('chevron-left', 'w-6 h-6')}
              </button>
              <h4 class="text-base font-semibold text-gray-900 dark:text-white">
                ${monthNames[month]} ${year}
              </h4>
              <button id="next-month" class="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-2 btn-press">
                ${ui.icon('chevron-right', 'w-6 h-6')}
              </button>
            </div>

            <div class="grid grid-cols-7 gap-1 mb-2">
              ${weekdayNames.map(d => `<div class="text-center text-xs font-semibold text-gray-600 dark:text-gray-400 py-1">${d}</div>`).join('')}
            </div>

            <div class="grid grid-cols-7 gap-1 mb-4">
              ${calendarDays.map(dayInfo => {
                if (dayInfo.empty) {
                  return '<div class="aspect-square"></div>';
                }

                let bgClass = 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700';
                let textClass = 'text-gray-900 dark:text-white';
                let ringClass = '';

                // Set background color based on existing entry type
                if (dayInfo.entryType) {
                  switch (dayInfo.entryType) {
                    case 'work':
                      bgClass = 'bg-green-100 dark:bg-green-900 hover:bg-green-200 dark:hover:bg-green-800';
                      textClass = 'text-green-900 dark:text-green-100';
                      break;
                    case 'Urlaub':
                      bgClass = 'bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800';
                      textClass = 'text-blue-900 dark:text-blue-100';
                      break;
                    case 'Krankenstand':
                      bgClass = 'bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800';
                      textClass = 'text-red-900 dark:text-red-100';
                      break;
                    case 'Zeitausgleich':
                      bgClass = 'bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800';
                      textClass = 'text-purple-900 dark:text-purple-100';
                      break;
                    case 'Feiertag':
                      bgClass = 'bg-yellow-100 dark:bg-yellow-900 hover:bg-yellow-200 dark:hover:bg-yellow-800';
                      textClass = 'text-yellow-900 dark:text-yellow-100';
                      break;
                  }
                }

                // Overlay range selection with ring/border
                if (dayInfo.isStart || dayInfo.isEnd) {
                  ringClass = 'ring-4 ring-primary font-bold';
                } else if (dayInfo.inRange) {
                  ringClass = 'ring-2 ring-primary/50';
                }

                // Today indicator
                if (dayInfo.isToday && !ringClass) {
                  ringClass = 'ring-2 ring-blue-500';
                }

                return `
                  <button class="range-day aspect-square ${bgClass} ${textClass} ${ringClass} rounded-lg flex items-center justify-center text-sm font-semibold transition-all btn-press"
                          data-year="${dayInfo.date.getFullYear()}"
                          data-month="${dayInfo.date.getMonth()}"
                          data-day="${dayInfo.date.getDate()}">
                    ${dayInfo.day}
                  </button>
                `;
              }).join('')}
            </div>

            <div class="mb-4 min-h-6">
              ${startDate && !endDate ? `
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Von: <strong>${ui.formatDate(startDate)}</strong> - Wähle End-Datum
                </p>
              ` : startDate && endDate ? `
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  <strong>${ui.formatDate(startDate)}</strong> bis <strong>${ui.formatDate(endDate)}</strong>
                </p>
              ` : `
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Wähle Start-Datum
                </p>
              `}
            </div>

            <div class="flex space-x-3">
              <button id="dialog-cancel" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
                ${ui.t('cancel')}
              </button>
              <button id="dialog-ok" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg hover:bg-primary-dark ${!startDate || !endDate ? 'opacity-50 cursor-not-allowed' : ''}"
                      ${!startDate || !endDate ? 'disabled' : ''}>
                ${ui.t('ok')}
              </button>
            </div>
          </div>
        `;

        ui.showModal(calendarHTML);

        document.getElementById('prev-month').addEventListener('click', () => {
          currentMonth.setMonth(currentMonth.getMonth() - 1);
          renderCalendar();
        });

        document.getElementById('next-month').addEventListener('click', () => {
          currentMonth.setMonth(currentMonth.getMonth() + 1);
          renderCalendar();
        });

        document.querySelectorAll('.range-day').forEach(btn => {
          btn.addEventListener('click', () => {
            const clickedDate = new Date(
              parseInt(btn.dataset.year),
              parseInt(btn.dataset.month),
              parseInt(btn.dataset.day)
            );

            if (!startDate || (startDate && endDate)) {
              startDate = clickedDate;
              endDate = null;
            } else {
              if (clickedDate >= startDate) {
                endDate = clickedDate;
              } else {
                endDate = startDate;
                startDate = clickedDate;
              }
            }

            renderCalendar();
          });
        });

        document.getElementById('dialog-ok').addEventListener('click', () => {
          if (startDate && endDate) {
            ui.hideModal();
            resolve({ startDate, endDate });
          }
        });

        document.getElementById('dialog-cancel').addEventListener('click', () => {
          ui.hideModal();
          resolve(null);
        });
      };

      renderCalendar();
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
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pause</label>
            <div class="flex items-center space-x-4">
              <button id="pause-minus" class="w-12 h-12 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-bold text-xl hover:bg-gray-300 dark:hover:bg-gray-600 btn-press">−</button>
              <div class="flex-1 text-center">
                <span id="pause-display" class="text-3xl font-bold text-gray-900 dark:text-white">${ui.formatHours(pauseValue)}</span>
              </div>
              <button id="pause-plus" class="w-12 h-12 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-bold text-xl hover:bg-gray-300 dark:hover:bg-gray-600 btn-press">+</button>
            </div>
          </div>

          <!-- Travel Picker -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fahrtzeit</label>
            <div class="flex items-center space-x-4">
              <button id="travel-minus" class="w-12 h-12 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-bold text-xl hover:bg-gray-300 dark:hover:bg-gray-600 btn-press">−</button>
              <div class="flex-1 text-center">
                <span id="travel-display" class="text-3xl font-bold text-gray-900 dark:text-white">${ui.formatHours(travelValue)}</span>
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
        document.getElementById('pause-display').textContent = ui.formatHours(pauseValue);
        document.getElementById('travel-display').textContent = ui.formatHours(travelValue);
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

  /**
   * Shows save dialog with 3 options: Save, Discard, Back
   * @returns {Promise<string>} 'save', 'discard', or 'back'
   */
  showSaveDialog() {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Änderungen speichern?</h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">Du hast nicht gespeicherte Änderungen. Was möchtest du tun?</p>
          <div class="flex flex-col gap-3">
            <button id="dialog-save" class="w-full px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 flex items-center justify-center gap-2">
              ${ui.icon('check')}
              <span>Speichern</span>
            </button>
            <button id="dialog-discard" class="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center gap-2">
              ${ui.icon('trash')}
              <span>Verwerfen</span>
            </button>
            <button id="dialog-back" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
              Zurück
            </button>
          </div>
        </div>
      `;

      ui.showModal(content);

      document.getElementById('dialog-save').addEventListener('click', () => {
        ui.hideModal();
        resolve('save');
      });

      document.getElementById('dialog-discard').addEventListener('click', () => {
        ui.hideModal();
        resolve('discard');
      });

      document.getElementById('dialog-back').addEventListener('click', () => {
        ui.hideModal();
        resolve('back');
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
    const contentHtml = `
        <div class="space-y-2">
          <button id="menu-settings" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-3">
            ${ui.icon('settings')}
            <span>${ui.t('settings')}</span>
          </button>
          <button id="menu-history" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-3">
            ${ui.icon('history')}
            <span>${ui.t('recordings')}</span>
          </button>
          ${ui.settings?.workTimeTracking?.enabled ? `
          <button id="menu-statistics" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-3">
            ${ui.icon('chart-bar')}
            <span>${ui.t('statistics')}</span>
          </button>
          ` : ''}
          ${ui.settings?.onCallEnabled ? `
          <button id="menu-callouts" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-3">
            ${ui.icon('plus')}
            <span>${ui.t('callouts')}</span>
          </button>
          ` : ''}
          <button id="menu-about" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg flex items-center gap-3">
            ${ui.icon('info')}
            <span>Info</span>
          </button>
        </div>
    `;

    ui.showModalWithHeader({
      title: ui.t('menu'),
      icon: 'menu',
      content: contentHtml
    });

    document.getElementById('menu-settings').addEventListener('click', () => {
      ui.hideModal();
      this.showSettings();
    });

    document.getElementById('menu-history').addEventListener('click', () => {
      ui.hideModal();
      this.showHistory();
    });

    document.getElementById('menu-statistics')?.addEventListener('click', () => {
      ui.hideModal();
      this.showStatistics();
    });

    document.getElementById('menu-callouts')?.addEventListener('click', () => {
      ui.hideModal();
      this.showCalloutDialog();
    });

    document.getElementById('menu-about').addEventListener('click', () => {
      ui.hideModal();
      this.showAbout();
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
        const statusText = isAnonymous ? ui.t('signedInAnonymously') : `${ui.t('signedInAs')} ${userEmail}`;
        const isSyncActive = firebaseService.syncEnabled && settings.cloudSync !== false;
        const syncStatusText = isSyncActive ? ui.t('syncActive') : ui.t('syncDisabled');
        const syncStatusColor = isSyncActive ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400';
        syncStatusHTML = `
          <div class="mt-2 text-sm ${syncStatusColor}">
            ● ${statusText} (${syncStatusText})
          </div>
        `;

        // Last sync time
        const lastSync = firebaseService.getLastSyncTime();
        if (lastSync) {
          const timeSince = Math.floor((Date.now() - lastSync.getTime()) / 1000 / 60); // minutes
          const timeText = timeSince < 1 ? ui.t('justNow') :
                         timeSince < 60 ? ui.t('minutesAgo').replace('{minutes}', timeSince) :
                         ui.t('hoursAgo').replace('{hours}', Math.floor(timeSince / 60));
          lastSyncHTML = `
            <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              ${ui.t('lastSync')} ${timeText}
            </div>
          `;
        } else {
          lastSyncHTML = `
            <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              ${ui.t('noSyncYet')}
            </div>
          `;
        }
      } else {
        syncStatusHTML = `
          <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            ${ui.t('notSignedIn')}
          </div>
        `;
      }
    }

    // Auto-save function
    const saveSettings = async () => {
      const workTimeTrackingEnabled = document.getElementById('setting-worktime-enabled')?.checked || false;
      const wasEnabled = ui.settings.workTimeTracking?.enabled || false;
      const onboardingDone = ui.settings.workTimeTracking?.onboardingCompleted || false;

      // Erstaktivierung: noch NICHT aktiv schalten. Ohne abgeschlossenes
      // Onboarding gibt es keinen Stichtag, und die Saldo-Berechnung hätte
      // keine Basis. Schritt 3 des Onboardings setzt enabled auf true.
      const needsOnboarding = workTimeTrackingEnabled && !wasEnabled && !onboardingDone;

      const newSettings = {
        username: document.getElementById('setting-username')?.value || '',
        language: document.getElementById('setting-language')?.value || 'de',
        surchargePercent: parseInt(document.getElementById('setting-surcharge')?.value || 0),
        emailSubject: document.getElementById('setting-email-subject')?.value || '',
        emailBody: document.getElementById('setting-email-body')?.value || '',
        onCallEnabled: document.getElementById('setting-oncall-enabled')?.checked || false,
        workTimeTracking: {
          ...(ui.settings.workTimeTracking || {}),
          enabled: needsOnboarding ? false : workTimeTrackingEnabled
        }
      };

      await storage.saveSettings(newSettings);
      ui.settings = newSettings;
      ui.i18n = ui.getI18N();

      ui.hideModal();

      // If workTimeTracking was just enabled for the first time, show onboarding
      if (needsOnboarding) {
        this.showWorkTimeTrackingOnboarding();
      } else {
        ui.showToast(ui.t('settingsSaved'), 'success');
        await this.renderMainScreen();
      }
    };

    const contentHtml = `
        <div class="space-y-4">
          <!-- Cloud Sync Section -->
          ${firebaseService && firebaseService.isInitialized ? `
            <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
              <button class="collapsible-header w-full flex items-center justify-between text-left" data-target="cloud-sync-content">
                <div class="flex items-center gap-2">
                  ${ui.icon('cloud')}
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white">${ui.t('cloudSyncTitle')}</h4>
                </div>
                ${ui.icon('chevron-down', 'w-5 h-5 collapsible-icon transition-transform')}
              </button>
              <div id="cloud-sync-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary">

              ${syncStatusHTML}
              ${lastSyncHTML}

              ${isSignedIn ? `
                <div class="mt-3 space-y-2">
                  <button id="firebase-manual-sync" class="w-full px-3 py-2 bg-primary text-gray-900 rounded-lg text-sm font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
                    <span id="sync-button-text">${ui.t('syncNow')}</span>
                    <span id="sync-button-spinner" class="hidden">
                      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                  </button>
                  <button id="firebase-hard-refresh" class="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">
                    <span id="refresh-button-text">${ui.t('hardRefresh')}</span>
                    <span id="refresh-button-spinner" class="hidden">
                      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                  </button>
                  <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    ${ui.t('autoSyncInfo')}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 italic">
                    ${ui.t('hardRefreshInfo')}
                  </p>
                </div>
              ` : ''}

              <div class="mt-3 space-y-2">
                ${!isSignedIn ? `
                  <button id="firebase-login-anon" class="w-full px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">
                    ${ui.t('signInAnonymous')}
                  </button>
                  <button id="firebase-login-email" class="w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
                    ${ui.t('signInWithEmail')}
                  </button>
                ` : isAnonymous ? `
                  <button id="firebase-link-email" class="w-full px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600">
                    ${ui.t('linkEmailToAccount')}
                  </button>
                  <button id="firebase-logout" class="w-full px-3 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600">
                    ${ui.t('signOut')}
                  </button>
                ` : `
                  <button id="firebase-logout" class="w-full px-3 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600">
                    ${ui.t('signOut')}
                  </button>
                `}
              </div>

              ${isSignedIn ? `
                <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                  ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
                  <span>${ui.t('syncAutoInfo')}</span>
                </p>
              ` : `
                <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                  ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
                  <span>${ui.t('syncSignInInfo')}</span>
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
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white">${ui.t('appUpdates')}</h4>
              </div>
              ${ui.icon('chevron-down', 'w-5 h-5 collapsible-icon transition-transform')}
            </button>
            <div id="update-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary">

            <div class="space-y-2">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">${ui.t('currentVersion')}</span>
                <span class="font-semibold text-gray-900 dark:text-white">v${APP_VERSION}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">${ui.t('availableVersion')}</span>
                <span id="remote-version-display" class="font-semibold text-gray-900 dark:text-white">-</span>
              </div>
            </div>

            <button id="check-update-btn" class="w-full mt-3 px-3 py-2 bg-primary text-gray-900 rounded-lg text-sm font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
              ${ui.icon('refresh')}
              <span>${ui.t('checkForUpdates')}</span>
            </button>

            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
              ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
              <span>${ui.t('autoUpdateCheckInfo')}</span>
            </p>
            </div>
          </div>

          <!-- Version Rollback Section -->
          <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
            <button class="collapsible-header w-full flex items-center justify-between text-left" data-target="version-rollback-content">
              <div class="flex items-center gap-2">
                ${ui.icon('clock')}
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white">${ui.t('versionManagement')}</h4>
              </div>
              ${ui.icon('chevron-down', 'w-5 h-5 collapsible-icon transition-transform')}
            </button>
            <div id="version-rollback-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary">

            <div id="versions-list" class="space-y-2">
              <p class="text-sm text-gray-600 dark:text-gray-400">${ui.t('loadingVersions')}</p>
            </div>

            <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
              ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
              <span>${ui.t('versionRestoreInfo')}</span>
            </p>
            </div>
          </div>

          <!-- Sharing & Friends Section -->
          ${firebaseService && firebaseService.isInitialized && isSignedIn ? `
            <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
              <button class="collapsible-header w-full flex items-center justify-between text-left" data-target="sharing-content">
                <div class="flex items-center gap-2">
                  ${ui.icon('users')}
                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white">${ui.t('sharingAndFriends')}</h4>
                </div>
                ${ui.icon('chevron-down', 'w-5 h-5 collapsible-icon transition-transform')}
              </button>
              <div id="sharing-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary">

                <div class="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                  ${[
                    { id: 'manage-profile-btn', icon: 'user', label: ui.t('myShareProfile') },
                    { id: 'show-qr-btn', icon: 'qr-code', label: ui.t('showMyQRCode') },
                    { id: 'scan-qr-btn', icon: 'camera', label: ui.t('scanFriendQR') },
                    { id: 'manage-friends-btn', icon: 'users', label: ui.t('manageFriends') }
                  ].map(item => `
                    <button type="button" id="${item.id}" class="w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700">
                      <span class="text-gray-500 dark:text-gray-400 flex-shrink-0">${ui.icon(item.icon, 'w-5 h-5')}</span>
                      <span class="flex-1 text-sm font-medium text-gray-900 dark:text-white">${item.label}</span>
                      ${ui.icon('chevron-right', 'w-4 h-4 text-gray-400 flex-shrink-0')}
                    </button>
                  `).join('')}
                </div>

                <p class="mt-3 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                  ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
                  <span>${ui.t('sharingInfo')}</span>
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

          <!-- Work Time Tracking Feature Toggle -->
          <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
            <label class="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" id="setting-worktime-enabled" ${settings.workTimeTracking?.enabled ? 'checked' : ''}
                class="w-4 h-4 text-primary focus:ring-primary rounded">
              <div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">${ui.t('workTimeTrackingShort')}</span>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${ui.t('workTimeTrackingDesc')}</p>
              </div>
            </label>
          </div>

          <!-- Sollstunden & Sätze -->
          ${settings.workTimeTracking?.enabled ? `
          <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
            <button class="collapsible-header w-full flex items-center justify-between text-left" data-target="rates-content">
              <div class="flex items-center gap-2">
                ${ui.icon('clock')}
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white">${ui.t('ratesTitle')}</h4>
              </div>
              ${ui.icon('chevron-down', 'w-5 h-5 collapsible-icon transition-transform')}
            </button>
            <div id="rates-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary">
              <div id="rates-list" class="space-y-2"></div>
              <button id="rate-add-btn" class="w-full mt-3 px-3 py-2 bg-primary text-gray-900 rounded-lg text-sm font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
                ${ui.icon('plus')}
                <span>${ui.t('rateAdd')}</span>
              </button>
              <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">${ui.t('ratesHint')}</p>
            </div>
          </div>
          ` : ''}

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
                  <span>${ui.t('placeholderInfo')}</span>
                </p>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Text</label>
                <textarea id="setting-email-body" rows="3"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white">${settings.emailBody}</textarea>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-start gap-1">
                  ${ui.icon('info-circle', 'flex-shrink-0 mt-0.5')}
                  <span>${ui.t('placeholderInfo')}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
        <button id="settings-backups" class="w-full px-4 py-3 mt-6 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700">
          ${ui.t('backupTitle')}
        </button>
    `;

    ui.showModalWithHeader({
      title: ui.t('settings'),
      icon: 'settings',
      content: contentHtml,
      onClose: saveSettings
    });

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
            buttonText.textContent = ui.t('syncing');
            buttonSpinner.classList.remove('hidden');
            manualSyncBtn.disabled = true;

            // Perform full sync
            const success = await firebaseService.fullSync();

            if (success) {
              ui.showToast(ui.t('syncSuccess'), 'success');
              // Refresh settings to show new sync time
              await this.showSettings();
            } else {
              ui.showToast(ui.t('syncFailed'), 'error');
            }
          } catch (error) {
            ui.showToast(ui.t('syncError') + ' ' + error.message, 'error');
          } finally {
            // Hide spinner
            buttonText.textContent = ui.t('syncNow');
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
            ui.t('hardRefreshTitle'),
            ui.t('hardRefreshMessage')
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
            ui.showToast(ui.t('errorReloading') + ' ' + error.message, 'error');
            buttonText.textContent = ui.t('hardRefresh');
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

    // ===== Sollstunden & Sätze =====
    this.renderRatesList();

    document.getElementById('rate-add-btn')?.addEventListener('click', async () => {
      const saved = await this.showRateDialog(null);
      if (saved) this.renderRatesList();
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
        ui.showToast(ui.t('errorChecking'), 'error');
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

    document.getElementById('settings-backups').addEventListener('click', () => {
      ui.hideModal();
      this.showBackupManager();
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

    // Kennzahlen für die aktuelle Woche und den aktuellen Monat.
    // Bewusst über dieselbe Funktion wie die Statistik-Ansicht - vorher lief
    // hier eine eigene Schleife, die nach oben offen war (zukünftige Einträge
    // zählten mit) und jeden Eintrag als Arbeitstag wertete, auch Urlaub.
    const now = new Date();
    const week = statistics.getWeekBounds(now);
    const month = callouts.getMonthBounds(now.getFullYear(), now.getMonth() + 1);

    const weekSummary = await statistics.calculatePeriodSummary(
      week.start, week.end, ui.settings, this.session
    );
    const monthSummary = await statistics.calculatePeriodSummary(
      month.start, month.end, ui.settings, this.session
    );

    const isSessionActive = !!this.session;

    // Work Time Tracking Widget (if enabled)
    let wttWidgetHtml = '';
    if (ui.settings.workTimeTracking?.enabled) {
      // Frisch rechnen, nicht den gespeicherten Saldo lesen - siehe
      // getLiveTimeAccountBalance()
      const live = await this.getLiveTimeAccountBalance();
      const timeAccountBalance = live ? live.balance : 0;
      const vacationDays = ui.settings.workTimeTracking.vacation.remainingDays || 0;

      const timeAccountLiveIndicator = isSessionActive ? `<span class="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1"></span>` : '';

      wttWidgetHtml = `
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4 mb-4 border border-blue-200 dark:border-gray-600">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">${ui.t('timeAccount')}</div>
              <div class="text-2xl font-bold flex items-center">
                <!-- data-base = Saldo ohne die laufende Session. Der Sekundentakt
                     addiert nur noch die verstrichene Zeit dazu. -->
                <span class="live-balance ${this.timeAccountColorClass(timeAccountBalance)}" data-base="${live ? live.base : 0}">${this.formatTimeAccountValue(timeAccountBalance)}</span>
                ${timeAccountLiveIndicator}
              </div>
            </div>
            <div>
              <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">${ui.t('remainingVacation')}</div>
              <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">${vacationDays} ${ui.t('days')}</div>
            </div>
          </div>
          <button id="wtt-adjust-btn" class="mt-3 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1">
            ${ui.icon('settings', 'w-3 h-3')}
            <span>${ui.t('adjustTimeAccount')}</span>
          </button>
        </div>
      `;
    }

    // Statistics HTML
    const liveIndicator = isSessionActive ? `<span class="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1"></span>` : '';
    // Die Kacheln führen in die Statistik - aber nur mit aktivierter
    // Arbeitszeiterfassung. Ohne sie gäbe es dort kein Soll und der Saldo
    // würde bloss die Iststunden wiederholen.
    const statsLinked = ui.settings?.workTimeTracking?.enabled;
    const tileTag = statsLinked ? 'button' : 'div';
    const tileArrow = statsLinked
      ? `<span class="absolute top-3 right-3 text-gray-500 dark:text-gray-400">${ui.icon('chevron-right', 'w-4 h-4')}</span>`
      : '';

    // Untere Zeile der Kachel: mit Arbeitszeiterfassung der Saldo, sonst
    // nur die Zahl der Arbeitstage - ohne Soll wäre ein Saldo bedeutungslos
    const liveBase = (summary, value) => this.liveBaseAttr(summary, value);

    const tileFooter = (summary) => {
      if (!statsLinked) {
        return `<div class="text-xs text-gray-500 mt-1">${summary.workDays} ${summary.workDays === 1 ? 'Tag' : 'Tage'}</div>`;
      }

      const color = summary.balance >= 0
        ? 'text-green-600 dark:text-green-400'
        : 'text-red-600 dark:text-red-400';
      const sign = summary.balance >= 0 ? '+' : '';

      return `
        <div class="text-xs mt-1">
          <span class="live-balance font-semibold ${color}"${liveBase(summary, summary.balance)}>${sign}${callouts.hoursToHHMM(summary.balance)}</span>
          <span class="text-gray-500"> · ${ui.t('target')} ${callouts.hoursToHHMM(summary.targetHours)}</span>
        </div>
      `;
    };

    const statsHtml = `
      ${wttWidgetHtml}
      <div class="grid grid-cols-2 gap-3 mb-4">
        <${tileTag} ${statsLinked ? 'id="stats-week-tile"' : ''} class="relative bg-primary bg-opacity-20 rounded-lg p-4 text-left w-full${statsLinked ? ' hover:bg-opacity-30 transition-colors btn-press' : ''}">
          ${tileArrow}
          <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">${ui.t('thisWeek')}</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-white flex items-center"><span class="live-hours"${liveBase(weekSummary, weekSummary.actualHours)}>${callouts.hoursToHHMM(weekSummary.actualHours)}</span>${liveIndicator}</div>
          ${tileFooter(weekSummary)}
        </${tileTag}>
        <${tileTag} ${statsLinked ? 'id="stats-month-tile"' : ''} class="relative bg-blue-100 dark:bg-blue-900 rounded-lg p-4 text-left w-full${statsLinked ? ' hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors btn-press' : ''}">
          ${tileArrow}
          <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">${ui.t('thisMonth')}</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-white flex items-center"><span class="live-hours"${liveBase(monthSummary, monthSummary.actualHours)}>${callouts.hoursToHHMM(monthSummary.actualHours)}</span>${liveIndicator}</div>
          ${tileFooter(monthSummary)}
        </${tileTag}>
      </div>
    `;

    // Entries HTML with calculated hours
    const entriesHtml = entries.map(entry => {
      // Parse date from DD.MM.YYYY format
      const [day, month, year] = entry.date.split('.');
      const date = new Date(year, month - 1, day);
      const dateStr = date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

      // Check if this date is a holiday
      const holidayInfo = austrianHolidays.isHoliday(entry.date);
      const holidayBadge = holidayInfo.isHoliday
        ? `<span class="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs rounded-full" title="${holidayInfo.name[ui.settings.language || 'de']}">${ui.t('holiday')}</span>`
        : '';

      const taskList = entry.tasks && entry.tasks.length > 0
        ? entry.tasks.map(t => `${t.type}: ${t.description}`).join('<br>')
        : '';

      const workHours = callouts.getNetWorkHours(entry);

      return `
        <div class="history-entry border-b border-gray-200 dark:border-gray-700 py-3 last:border-0" data-entry-id="${entry.id}">
          <div class="flex justify-between items-start mb-1">
            <div class="flex items-center gap-2 min-w-0">
              <input type="checkbox" class="entry-checkbox hidden w-5 h-5 flex-shrink-0 accent-primary" data-id="${entry.id}">
              <span class="font-medium text-gray-900 dark:text-white">${dateStr}${holidayBadge}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-primary">${ui.formatHours(workHours)}</span>
              <div class="entry-actions flex items-center gap-2">
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

    const contentHtml = `
      ${statsHtml}

      <div class="mb-3">
        <div class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">${ui.t('allEntries')} (${entries.length})</div>
      </div>

      <div class="border-t border-gray-200 dark:border-gray-700">
        ${entriesHtml}
      </div>
    `;

    // Mehrfachauswahl nur mit Cloud - der Datei-Weg kennt pro Datei einen Eintrag
    const canShareMultiple = firebaseService.isSignedIn();

    const footerHtml = canShareMultiple ? `
      <div id="history-footer-normal">
        <button type="button" id="history-select-btn" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center gap-2">
          ${ui.icon('share-2', 'w-5 h-5')}
          <span>${ui.t('shareMultiple')}</span>
        </button>
      </div>
      <div id="history-footer-select" class="hidden flex gap-2">
        <button type="button" id="history-share-selected" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2" disabled>
          ${ui.icon('share-2', 'w-5 h-5')}
          <span>${ui.t('shareEntry')} (<span id="history-selected-count">0</span>)</span>
        </button>
        <button type="button" id="history-cancel-select" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">
          ${ui.t('cancel')}
        </button>
      </div>
    ` : '';

    ui.showModalWithHeader({
      title: ui.t('recordings'),
      icon: 'history',
      content: contentHtml,
      footer: footerHtml
    });

    if (canShareMultiple) {
      this.setupHistorySelection(entries);
    }

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

    // Kacheln führen in die Statistik, jeweils in die passende Ansicht
    document.getElementById('stats-week-tile')?.addEventListener('click', () => {
      ui.hideModal();
      this.showStatistics('week');
    });

    document.getElementById('stats-month-tile')?.addEventListener('click', () => {
      ui.hideModal();
      this.showStatistics('month');
    });

    // Add event listener for time account adjustment button (if exists)
    const wttAdjustBtn = document.getElementById('wtt-adjust-btn');
    if (wttAdjustBtn) {
      wttAdjustBtn.addEventListener('click', () => {
        ui.hideModal();
        this.showTimeAccountAdjustment();
      });
    }
  }

  /**
   * Auswahlmodus in den Aufzeichnungen, um mehrere Einträge auf einmal
   * zu teilen.
   *
   * Die Kästchen stehen von Anfang an im Markup und werden nur ein- und
   * ausgeblendet. So überlebt eine getroffene Auswahl das Umschalten und
   * die Liste muss nicht neu gebaut werden.
   */
  setupHistorySelection(entries) {
    const checkboxes = [...document.querySelectorAll('.entry-checkbox')];
    const footerNormal = document.getElementById('history-footer-normal');
    const footerSelect = document.getElementById('history-footer-select');
    const shareBtn = document.getElementById('history-share-selected');
    const countEl = document.getElementById('history-selected-count');

    let selectionMode = false;

    const selectedIds = () => checkboxes.filter(cb => cb.checked).map(cb => parseInt(cb.dataset.id));

    const updateCount = () => {
      const count = selectedIds().length;
      countEl.textContent = count;
      shareBtn.disabled = count === 0;
    };

    const setMode = (on) => {
      selectionMode = on;
      checkboxes.forEach(cb => {
        cb.classList.toggle('hidden', !on);
        if (!on) cb.checked = false;
      });
      document.querySelectorAll('.entry-actions').forEach(el => el.classList.toggle('hidden', on));
      footerNormal.classList.toggle('hidden', on);
      footerSelect.classList.toggle('hidden', !on);
      updateCount();
    };

    document.getElementById('history-select-btn').addEventListener('click', () => setMode(true));
    document.getElementById('history-cancel-select').addEventListener('click', () => setMode(false));

    // Im Auswahlmodus zählt die ganze Zeile als Ziel - ein kleines Kästchen
    // mit dem Daumen zu treffen ist auf dem Handy nichts
    document.querySelectorAll('.history-entry').forEach(row => {
      row.addEventListener('click', (e) => {
        if (!selectionMode) return;

        const checkbox = row.querySelector('.entry-checkbox');
        // Traf der Klick das Kästchen selbst, hat es schon umgeschaltet
        if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
        updateCount();
      });
    });

    shareBtn.addEventListener('click', async () => {
      const ids = selectedIds();
      const selected = entries.filter(entry => ids.includes(entry.id));
      if (selected.length === 0) return;

      await this.shareWorklogEntries(selected);
    });
  }

  async editWorklogEntry(entry) {
    return new Promise((resolve) => {
      const isWTTEnabled = ui.settings.workTimeTracking?.enabled || false;

      // Check if this date is a holiday
      const holidayInfo = austrianHolidays.isHoliday(entry.date);
      const isHoliday = holidayInfo.isHoliday;

      // Check if this is an absence entry (Urlaub, Krankenstand, Feiertag, Zeitausgleich)
      // These are stored as tasks with type='' and description contains the absence type
      const isAbsenceEntry = entry.tasks && entry.tasks.length > 0 &&
                             entry.tasks[0].type === '' &&
                             ['Urlaub', 'Krankenstand', 'Feiertag', 'Zeitausgleich'].includes(entry.tasks[0].description);

      // Map absence type to WTT entryType
      let mappedEntryType = entry.entryType || 'work';
      if (isAbsenceEntry) {
        const absenceType = entry.tasks[0].description;
        const absenceMapping = {
          'Urlaub': 'vacation',
          'Krankenstand': 'sick',
          'Feiertag': 'holiday',
          // 'timeoff' - identisch zur Massenerfassung in showAbsenceEntry().
          // Früher stand hier 'unpaid', wodurch derselbe Eintrag je nach
          // Codepfad zwei verschiedene Typen hatte.
          'Zeitausgleich': 'timeoff'
        };
        mappedEntryType = absenceMapping[absenceType] || 'vacation';
      }

      const currentEntryType = mappedEntryType;

      // Store original values for change detection
      // Normalize tasks same way as checkForChanges does
      const normalizedOriginalTasks = (entry.tasks || [])
        .map(t => ({
          type: (t.type || '').trim() || '',
          description: (t.description || '').trim() || ''
        }))
        .filter(t => t.description);

      const originalValues = {
        entryType: currentEntryType,
        date: entry.date,
        startTime: entry.startTime || '',
        endTime: entry.endTime || '',
        pause: entry.pause || '00:00',
        travelTime: entry.travelTime || '00:00',
        surcharge: entry.surcharge || '00:00',
        tasks: JSON.stringify(normalizedOriginalTasks)
      };

      let hasChanges = false;

      // Parse date for header display
      const [day, month, year] = entry.date.split('.');
      const entryDateObj = new Date(year, month - 1, day);
      const weekdayName = entryDateObj.toLocaleDateString('de-DE', { weekday: 'long' });
      const dateDisplay = `${weekdayName}, ${entry.date}`;

      // Alle Typen, die eine eigene Kachel haben. Ein Typ ohne Kachel würde
      // beim Speichern auf 'work' zurückfallen - genau dadurch verlor ein
      // Feiertag früher seine Soll-Nullung und kostete plötzlich ein Tagessoll.
      const TILE_TYPES = ['work', 'vacation', 'sick', 'holiday', 'timeoff'];
      const selectedTileType = TILE_TYPES.includes(currentEntryType) ? currentEntryType : 'work';

      const initialSurchargePercent = this.getInitialSurchargePercent(entry, ui.settings);

      const contentHtml = `
        <div class="space-y-4">
          <!-- Header: Date Display -->
          <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-lg p-4 border border-blue-200 dark:border-gray-600">
            <div class="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Datum</div>
            <div class="text-xl font-bold text-gray-900 dark:text-white">${dateDisplay}</div>
            ${isHoliday ? `<div class="text-xs text-blue-600 dark:text-blue-400 mt-1">${ui.icon('star', 'w-3 h-3 inline')} ${holidayInfo.name}</div>` : ''}
          </div>

          ${isWTTEnabled ? `
          <!-- Type Selection Tiles -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Art des Eintrags</label>
            <div class="grid grid-cols-3 gap-2" id="entry-type-tiles">
              <button type="button" class="entry-type-tile px-2 py-2.5 rounded-lg border-2 transition-all ${selectedTileType === 'work' ? 'bg-green-500 border-green-600 text-white' : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-green-400'}" data-type="work">
                ${ui.icon('briefcase', 'w-4 h-4 mx-auto mb-0.5')}
                <div class="text-xs font-semibold">Arbeitstag</div>
              </button>
              <button type="button" class="entry-type-tile px-2 py-2.5 rounded-lg border-2 transition-all ${selectedTileType === 'vacation' ? 'bg-blue-500 border-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-blue-400'}" data-type="vacation">
                ${ui.icon('sun', 'w-4 h-4 mx-auto mb-0.5')}
                <div class="text-xs font-semibold">Urlaub</div>
              </button>
              <button type="button" class="entry-type-tile px-2 py-2.5 rounded-lg border-2 transition-all ${selectedTileType === 'sick' ? 'bg-red-500 border-red-600 text-white' : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-red-400'}" data-type="sick">
                ${ui.icon('heart', 'w-4 h-4 mx-auto mb-0.5')}
                <div class="text-xs font-semibold">Krankenstand</div>
              </button>
              <button type="button" class="entry-type-tile px-2 py-2.5 rounded-lg border-2 transition-all ${selectedTileType === 'holiday' ? 'bg-purple-500 border-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-purple-400'}" data-type="holiday">
                ${ui.icon('calendar', 'w-4 h-4 mx-auto mb-0.5')}
                <div class="text-xs font-semibold">Feiertag</div>
              </button>
              <button type="button" class="entry-type-tile px-2 py-2.5 rounded-lg border-2 transition-all ${selectedTileType === 'timeoff' ? 'bg-amber-500 border-amber-600 text-white' : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-amber-400'}" data-type="timeoff">
                ${ui.icon('clock', 'w-4 h-4 mx-auto mb-0.5')}
                <div class="text-xs font-semibold">Zeitausgleich</div>
              </button>
            </div>
          </div>
          ` : ''}

          <!-- Time Fields (conditional) -->
          <div id="edit-time-card" style="display: ${selectedTileType === 'work' ? 'block' : 'none'}">
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">${ui.icon('clock', 'w-4 h-4 inline mr-1')} Arbeitszeiten</div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Start</label>
                  <input type="time" id="edit-start" value="${entry.startTime || ''}"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Ende</label>
                  <input type="time" id="edit-end" value="${entry.endTime || ''}"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Pause</label>
                  <input type="time" id="edit-pause" value="${entry.pause || '00:00'}"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Fahrt</label>
                  <input type="time" id="edit-travel" value="${entry.travelTime || '00:00'}"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">${ui.t('surchargePercent')}</label>
                  <input type="number" id="edit-surcharge-percent" min="0" max="200" step="1"
                    value="${initialSurchargePercent}"
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Zuschlag</label>
                  <input type="time" id="edit-surcharge" value="${entry.surcharge || '00:00'}" readonly
                    class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-not-allowed">
                </div>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">${ui.icon('info', 'w-3 h-3 inline')} ${ui.t('surchargeFromPercent')}</p>
            </div>
          </div>

          <!-- Tasks -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">${ui.icon('list', 'w-4 h-4 inline mr-1')} Aufgaben</label>
            <div id="edit-tasks-list" class="space-y-2 mb-2">
              ${entry.tasks && entry.tasks.length > 0 ? entry.tasks.map((task, idx) => `
                <div class="flex gap-1.5 items-center">
                  <select class="task-type flex-none w-16 px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                    <option value="">-</option>
                    ${Object.keys(TASK_TYPES).map(key =>
                      `<option value="${key}" ${task.type === key ? 'selected' : ''}>${key}</option>`
                    ).join('')}
                  </select>
                  <input type="text" class="task-desc flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    value="${task.description || ''}" placeholder="Beschreibung">
                  <button type="button" class="remove-task-btn flex-none text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1.5" data-index="${idx}">
                    ${ui.icon('trash', 'w-4 h-4')}
                  </button>
                </div>
              `).join('') : '<p class="text-sm text-gray-500 dark:text-gray-400 py-3 text-center">Keine Aufgaben</p>'}
            </div>
            <button type="button" id="add-task-to-entry" class="w-full px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2">
              ${ui.icon('plus', 'w-4 h-4')}
              <span>Aufgabe hinzufügen</span>
            </button>
          </div>
        </div>
      `;

      const footerHtml = `
        <div class="flex gap-2">
          <button type="button" id="edit-share" class="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2">
            ${ui.icon('share-2', 'w-4 h-4')}
            <span>Teilen</span>
          </button>
          <button type="button" id="edit-save" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 flex items-center justify-center gap-2">
            ${ui.icon('check', 'w-4 h-4')}
            <span>Speichern</span>
          </button>
        </div>
      `;

      // Check for changes function
      const checkForChanges = () => {
        const currentTasks = Array.from(document.querySelectorAll('#edit-tasks-list .flex'))
          .map(el => ({
            type: el.querySelector('.task-type')?.value.trim() || '',
            description: el.querySelector('.task-desc')?.value.trim() || ''
          }))
          .filter(t => t.description);

        // Get selected tile type instead of dropdown
        let currentEntryType = 'work';
        if (isWTTEnabled) {
          const selectedTile = document.querySelector('.entry-type-tile.bg-green-500, .entry-type-tile.bg-blue-500, .entry-type-tile.bg-red-500, .entry-type-tile.bg-purple-500, .entry-type-tile.bg-amber-500');
          currentEntryType = selectedTile?.getAttribute('data-type') || 'work';
        }

        const currentStartTime = document.getElementById('edit-start')?.value || '';
        const currentEndTime = document.getElementById('edit-end')?.value || '';
        const currentPause = document.getElementById('edit-pause')?.value || '00:00';
        const currentTravelTime = document.getElementById('edit-travel')?.value || '00:00';
        const currentSurcharge = document.getElementById('edit-surcharge')?.value || '00:00';

        hasChanges = (
          currentEntryType !== originalValues.entryType ||
          currentStartTime !== originalValues.startTime ||
          currentEndTime !== originalValues.endTime ||
          currentPause !== originalValues.pause ||
          currentTravelTime !== originalValues.travelTime ||
          currentSurcharge !== originalValues.surcharge ||
          JSON.stringify(currentTasks) !== originalValues.tasks
        );
      };

      // Handle close with smart save
      const handleClose = async () => {
        checkForChanges();

        if (!hasChanges) {
          ui.hideModal();
          resolve(false);
          return;
        }

        const action = await this.showSaveDialog();

        if (action === 'save') {
          // Trigger save
          document.getElementById('edit-save').click();
        } else if (action === 'discard') {
          ui.hideModal();
          resolve(false);
        } else {
          // 'back' - reopen the edit dialog
          await this.editWorklogEntry(entry);
          resolve(false);
        }
      };

      ui.showModalWithHeader({
        title: 'Eintrag bearbeiten',
        icon: 'edit',
        content: contentHtml,
        footer: footerHtml,
        onClose: handleClose
      });

      // Type tiles click handlers (show/hide time card)
      if (isWTTEnabled) {
        const tiles = document.querySelectorAll('.entry-type-tile');
        const timeCard = document.getElementById('edit-time-card');
        const startTimeInput = document.getElementById('edit-start');
        const endTimeInput = document.getElementById('edit-end');

        // Farbschema je Eintragsart - muss zu den Kacheln im HTML passen
        const TILE_COLORS = {
          work:     { bg: 'bg-green-500',  border: 'border-green-600',  hover: 'hover:border-green-400' },
          vacation: { bg: 'bg-blue-500',   border: 'border-blue-600',   hover: 'hover:border-blue-400' },
          sick:     { bg: 'bg-red-500',    border: 'border-red-600',    hover: 'hover:border-red-400' },
          holiday:  { bg: 'bg-purple-500', border: 'border-purple-600', hover: 'hover:border-purple-400' },
          timeoff:  { bg: 'bg-amber-500',  border: 'border-amber-600',  hover: 'hover:border-amber-400' }
        };
        const ALL_TILE_CLASSES = Object.values(TILE_COLORS)
          .flatMap(c => [c.bg, c.border, c.hover]);

        tiles.forEach(tile => {
          tile.addEventListener('click', (e) => {
            const selectedType = tile.getAttribute('data-type');

            // Update tile visual states
            tiles.forEach(t => {
              const type = t.getAttribute('data-type');
              t.classList.remove(...ALL_TILE_CLASSES, 'text-white');
              t.classList.add('bg-gray-100', 'dark:bg-gray-800', 'border-gray-300', 'dark:border-gray-600', 'text-gray-600', 'dark:text-gray-400');

              if (TILE_COLORS[type]) {
                t.classList.add(TILE_COLORS[type].hover);
              }
            });

            // Highlight selected tile
            tile.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'border-gray-300', 'dark:border-gray-600', 'text-gray-600', 'dark:text-gray-400', ...ALL_TILE_CLASSES);
            if (TILE_COLORS[selectedType]) {
              tile.classList.add(TILE_COLORS[selectedType].bg, TILE_COLORS[selectedType].border, 'text-white');
            }

            // Show/hide time card
            if (selectedType === 'work') {
              timeCard.style.display = 'block';
              // If changing to work and no times set, provide defaults
              if (!startTimeInput.value && !endTimeInput.value) {
                startTimeInput.value = '08:00';
                endTimeInput.value = '17:00';
              }
            } else {
              timeCard.style.display = 'none';
            }
          });
        });
      }

      // Prozentsatz aus dem Feld lesen und auf 0-200 begrenzen
      const readSurchargePercent = () => {
        const raw = document.getElementById('edit-surcharge-percent')?.value;
        return Math.min(200, Math.max(0, parseFloat(raw) || 0));
      };

      // Auto-calculate surcharge when time fields change
      const calculateSurcharge = () => {
        const startTime = document.getElementById('edit-start')?.value;
        const endTime = document.getElementById('edit-end')?.value;
        const pause = document.getElementById('edit-pause')?.value || '00:00';
        const travelTime = document.getElementById('edit-travel')?.value || '00:00';
        const surchargeInput = document.getElementById('edit-surcharge');

        if (!startTime || !endTime || !surchargeInput) return;

        // Calculate net work hours
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        const [pauseHour, pauseMin] = pause.split(':').map(Number);
        const [travelHour, travelMin] = travelTime.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        let endMinutes = endHour * 60 + endMin;
        const pauseMinutes = pauseHour * 60 + pauseMin;
        const travelMinutes = travelHour * 60 + travelMin;

        // Nachtschicht: Ende liegt am Folgetag
        if (endMinutes < startMinutes) {
          endMinutes += 24 * 60;
        }

        // Die Schmutzzulage wird nur für Arbeitszeit OHNE Fahrt bezahlt,
        // die Fahrtzeit wird also abgezogen. Muss identisch zu endSession()
        // sein - dort steht dieselbe Formel.
        let workMinutes = endMinutes - startMinutes - pauseMinutes - travelMinutes;
        if (workMinutes < 0) workMinutes = 0;

        const netHours = workMinutes / 60;

        // Der Prozentsatz kommt aus dem Feld. Früher wurde hier aus den
        // Aufgaben auf "Büro" geschlossen und hart 0 % gesetzt - dadurch
        // verlor ein per Session mit abweichendem Satz erfasster Tag seinen
        // Wert, sobald er bearbeitet wurde. Ausserdem galt eine gerade erst
        // hinzugefügte, noch leere Aufgabenzeile bereits als Büro.
        const surchargePercent = readSurchargePercent();
        // Auf halbe Stunden runden - genau wie in endSession(). Vorher wurde
        // hier minutengenau gerundet, wodurch ein bearbeiteter Tag einen
        // anderen Zuschlag bekam als ein per Session-Ende erfasster.
        const surchargeHours = Math.round(netHours * (surchargePercent / 100) * 2) / 2;
        const surchargeMinutes = Math.round(surchargeHours * 60);

        const surchHours = Math.floor(surchargeMinutes / 60);
        const surchMins = surchargeMinutes % 60;

        surchargeInput.value = `${String(surchHours).padStart(2, '0')}:${String(surchMins).padStart(2, '0')}`;
      };

      // Attach listeners to time fields
      ['edit-start', 'edit-end', 'edit-pause', 'edit-travel', 'edit-surcharge-percent'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
          input.addEventListener('change', calculateSurcharge);
          input.addEventListener('input', calculateSurcharge);
        }
      });

      // Attach listeners to task fields for surcharge recalculation
      const attachTaskListeners = () => {
        document.querySelectorAll('#edit-tasks-list .task-type, #edit-tasks-list .task-desc').forEach(input => {
          input.addEventListener('change', calculateSurcharge);
          input.addEventListener('input', calculateSurcharge);
        });
      };
      attachTaskListeners(); // Initial attach

      // Zuschlag einmal beim Öffnen berechnen.
      // Ohne das behält ein Eintrag seinen gespeicherten Wert, solange kein
      // Zeitfeld angefasst wird - ein mit falscher Formel erfasster Zuschlag
      // liesse sich dann durch Öffnen und Speichern gar nicht korrigieren.
      if (isWTTEnabled ? selectedTileType === 'work' : true) {
        calculateSurcharge();
      }

      // Add task button
      document.getElementById('add-task-to-entry').addEventListener('click', () => {
        const tasksList = document.getElementById('edit-tasks-list');
        const existingTasks = tasksList.querySelectorAll('.flex');
        const newIndex = existingTasks.length;

        const newTaskHtml = `
          <div class="flex gap-1.5 items-center">
            <select class="task-type flex-none w-16 px-1.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
              <option value="">-</option>
              ${Object.keys(TASK_TYPES).map(key => `<option value="${key}">${key}</option>`).join('')}
            </select>
            <input type="text" class="task-desc flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              value="" placeholder="Beschreibung">
            <button type="button" class="remove-task-btn flex-none text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1.5" data-index="${newIndex}">
              ${ui.icon('trash', 'w-4 h-4')}
            </button>
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
              tasksList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 py-3 text-center">Keine Aufgaben</p>';
            }
            calculateSurcharge(); // Recalculate after removal
          });
        });

        // Re-attach task listeners for surcharge recalculation
        attachTaskListeners();
        calculateSurcharge(); // Calculate after adding task
      });

      // Remove task buttons
      document.querySelectorAll('.remove-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.currentTarget.closest('.flex').remove();
          const tasksList = document.getElementById('edit-tasks-list');
          if (tasksList.querySelectorAll('.flex').length === 0) {
            tasksList.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 py-3 text-center">Keine Aufgaben</p>';
          }
          calculateSurcharge(); // Recalculate after removal
        });
      });

      // Share button
      document.getElementById('edit-share').addEventListener('click', async () => {
        await this.shareWorklogEntry(entry);
      });

      // Save button
      document.getElementById('edit-save').addEventListener('click', async () => {
        const taskElements = document.querySelectorAll('#edit-tasks-list .flex');
        const tasks = Array.from(taskElements).map(el => ({
          type: el.querySelector('.task-type').value.trim(),
          description: el.querySelector('.task-desc').value.trim()
        })).filter(t => t.description); // Only keep tasks with descriptions

        // Get entry type from selected tile (not dropdown)
        let entryType = 'work';
        if (isWTTEnabled) {
          const selectedTile = document.querySelector('.entry-type-tile.bg-green-500, .entry-type-tile.bg-blue-500, .entry-type-tile.bg-red-500, .entry-type-tile.bg-purple-500, .entry-type-tile.bg-amber-500');
          entryType = selectedTile?.getAttribute('data-type') || 'work';
        }
        const oldEntryType = entry.entryType || 'work';

        // Base updated entry (date not editable in new UI)
        const updatedEntry = {
          ...entry,
          tasks: tasks,
          entryType: entryType
        };

        // Handle work time tracking calculations
        if (isWTTEnabled && ui.settings.workTimeTracking) {
          const [d, m, y] = entry.date.split('.');
          const entryDate = new Date(y, m - 1, d);

          // Preserve historical targetHours! Only set if missing (legacy entries)
          if (!entry.targetHours) {
            updatedEntry.targetHours = timeAccount.getDailyTargetHours(entryDate, ui.settings);
          }
          // else: keep original entry.targetHours (already in updatedEntry via spread)

          updatedEntry.entryType = entryType;

          if (entryType === 'vacation' || entryType === 'sick' || entryType === 'holiday') {
            // Vacation/sick/holiday days: no work time, counts as fulfilled
            updatedEntry.startTime = '';
            updatedEntry.endTime = '';
            updatedEntry.pause = '';
            updatedEntry.travelTime = '';
            updatedEntry.surcharge = '';
            updatedEntry.surchargePercent = 0;
            updatedEntry.actualHours = updatedEntry.targetHours;
            // Vacation only counts if this day has target hours (not weekends)
            updatedEntry.vacationDays = (entryType === 'vacation' && updatedEntry.targetHours > 0) ? 1 : 0;
          } else if (entryType === 'timeoff' || entryType === 'unpaid') {
            // Zeitausgleich / unbezahlter Urlaub: keine Arbeitszeit, Soll bleibt
            // stehen -> der Tag verbraucht angesammelte Überstunden
            updatedEntry.startTime = '';
            updatedEntry.endTime = '';
            updatedEntry.pause = '';
            updatedEntry.travelTime = '';
            updatedEntry.surcharge = '';
            updatedEntry.surchargePercent = 0;
            updatedEntry.actualHours = 0;
            updatedEntry.vacationDays = 0;
          } else {
            // Normal work entry
            updatedEntry.startTime = document.getElementById('edit-start').value;
            updatedEntry.endTime = document.getElementById('edit-end').value;
            updatedEntry.pause = document.getElementById('edit-pause').value;
            updatedEntry.travelTime = document.getElementById('edit-travel').value;
            updatedEntry.surcharge = document.getElementById('edit-surcharge').value;
            updatedEntry.surchargePercent = readSurchargePercent();
            updatedEntry.actualHours = timeAccount.getActualHours(updatedEntry, ui.settings);
            updatedEntry.vacationDays = 0;
          }
        } else {
          // No WTT: keep original time fields
          updatedEntry.startTime = document.getElementById('edit-start').value;
          updatedEntry.endTime = document.getElementById('edit-end').value;
          updatedEntry.pause = document.getElementById('edit-pause').value;
          updatedEntry.travelTime = document.getElementById('edit-travel').value;
          updatedEntry.surcharge = document.getElementById('edit-surcharge').value;
          updatedEntry.surchargePercent = readSurchargePercent();
        }

        // Check if this is a new entry (no ID) or existing entry (has ID)
        if (entry.id) {
          // Existing entry - update it
          await storage.updateWorklogEntry(updatedEntry);
          // Recalculate vacation and time account holistically
          await this.recalculateVacationDays();
          await this.recalculateTimeAccountBalance();
          ui.hideModal();
          ui.showToast('Eintrag aktualisiert', 'success');
        } else {
          // New entry - add it
          await storage.addWorklogEntry(updatedEntry);
          // Recalculate vacation and time account holistically
          await this.recalculateVacationDays();
          await this.recalculateTimeAccountBalance();
          ui.hideModal();
          ui.showToast('Eintrag erstellt', 'success');
        }
        resolve(true);
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
    // Recalculate vacation and time account holistically
    await this.recalculateVacationDays();
    await this.recalculateTimeAccountBalance();
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
    const isSignedIn = firebaseService.isSignedIn();

    if (isSignedIn) {
      // Signed in → direkt zu Freunde-Auswahl
      await this.shareWorklogEntriesToUser([entry]);
    } else {
      // Nicht signed in → direkt zu File-Share
      await this.shareWorklogEntryViaFile(entry);
    }
  }

  /**
   * Mehrere Einträge auf einmal teilen.
   *
   * Nur über die Cloud: der Datei-Weg kennt pro Datei genau einen Eintrag,
   * und der Empfänger könnte eine Sammeldatei gar nicht lesen.
   */
  async shareWorklogEntries(entries) {
    if (!entries || entries.length === 0) return;

    if (!firebaseService.isSignedIn()) {
      ui.showToast(ui.t('mustBeSignedIn'), 'error');
      return;
    }

    await this.shareWorklogEntriesToUser(entries);
  }

  /**
   * Einträge an einen Friend senden.
   *
   * Vorgeschlagen wird immer der zuletzt verwendete Empfänger - in der Praxis
   * geht fast alles an dieselbe Person. Gewechselt wird nur, wenn man den
   * Empfänger antippt; bei genau einem Friend gibt es nichts zu wechseln.
   */
  async shareWorklogEntriesToUser(entries) {
    let friends;
    try {
      friends = await firebaseService.getFriends();
    } catch (error) {
      console.error('Failed to load friends:', error);
      ui.showToast(ui.t('loadFriendsFailed'), 'error');
      return false;
    }

    if (friends.length === 0) {
      await this.showNoFriendsDialog();
      return false;
    }

    friends.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || ''));

    // Zuletzt verwendeter Empfänger - fehlt er oder wurde er entfernt,
    // greift der erste Friend alphabetisch
    let recipient = friends.find(f => f.uid === ui.settings.lastShareRecipient) || friends[0];

    // Der Empfängerwechsel führt zurück ins Blatt, deshalb die Schleife
    while (true) {
      const action = await this.showShareConfirmDialog(entries, recipient, friends.length > 1);

      if (action === 'cancel') return false;

      if (action === 'change') {
        const picked = await this.showRecipientPicker(friends, recipient.uid);
        if (picked) recipient = picked;
        continue;
      }

      return await this.sendSharedEntries(entries, recipient);
    }
  }

  /**
   * Bestätigungsblatt vor dem Senden.
   *
   * Ein Eintrag bekommt die volle Vorschau, mehrere eine Liste mit Summe -
   * bei zehn Tagen zählt, ob die richtigen dabei sind, nicht jede Tätigkeit.
   *
   * @returns {Promise<'send'|'change'|'cancel'>}
   */
  showShareConfirmDialog(entries, recipient, canChange) {
    return new Promise((resolve) => {
      const previewHtml = entries.length === 1
        ? this.renderEntryPreview(entries[0])
        : this.renderEntryListPreview(entries);

      const content = `
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          ${previewHtml}
        </div>

        <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-4 mb-2">${ui.t('recipient')}</p>

        <button type="button" id="share-recipient-btn"
                class="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-left ${canChange ? 'hover:bg-gray-50 dark:hover:bg-gray-700' : 'cursor-default'}"
                ${canChange ? '' : 'disabled'}>
          <span class="text-gray-500 dark:text-gray-400 flex-shrink-0">${ui.icon('user', 'w-5 h-5')}</span>
          <span class="flex-1 min-w-0">
            <span class="block font-semibold text-gray-900 dark:text-white truncate">@${this.escapeHtml(recipient.nickname)}</span>
            ${recipient.displayName
              ? `<span class="block text-xs text-gray-500 dark:text-gray-400 truncate">${this.escapeHtml(recipient.displayName)}</span>` : ''}
          </span>
          ${canChange ? ui.icon('chevron-right', 'w-5 h-5 text-gray-400 flex-shrink-0') : ''}
        </button>
      `;

      const footer = `
        <button type="button" id="share-send-btn" class="w-full px-4 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 flex items-center justify-center gap-2">
          ${ui.icon('share-2', 'w-5 h-5')}
          <span>${ui.t('send')}</span>
        </button>
      `;

      ui.showModalWithHeader({
        title: ui.t('shareToFriend'),
        icon: 'share-2',
        content,
        footer,
        onClose: () => {
          ui.hideModal();
          resolve('cancel');
        }
      });

      if (canChange) {
        document.getElementById('share-recipient-btn').addEventListener('click', () => {
          ui.hideModal();
          resolve('change');
        });
      }

      document.getElementById('share-send-btn').addEventListener('click', () => {
        resolve('send');
      });
    });
  }

  /**
   * Empfängerliste. Aufgelöst mit dem gewählten Friend oder null bei Abbruch.
   */
  showRecipientPicker(friends, currentUid) {
    return new Promise((resolve) => {
      const content = `
        <div class="space-y-2">
          ${friends.map(friend => `
            <button type="button" class="recipient-btn w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
              friend.uid === currentUid
                ? 'border-primary bg-primary bg-opacity-10'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
            }" data-uid="${friend.uid}">
              <span class="text-gray-500 dark:text-gray-400 flex-shrink-0">${ui.icon('user', 'w-5 h-5')}</span>
              <span class="flex-1 min-w-0">
                <span class="block font-semibold text-gray-900 dark:text-white truncate">@${this.escapeHtml(friend.nickname)}</span>
                ${friend.displayName
                  ? `<span class="block text-xs text-gray-500 dark:text-gray-400 truncate">${this.escapeHtml(friend.displayName)}</span>` : ''}
              </span>
              ${friend.uid === currentUid ? ui.icon('check', 'w-5 h-5 text-primary flex-shrink-0') : ''}
            </button>
          `).join('')}
        </div>
      `;

      ui.showModalWithHeader({
        title: ui.t('selectFriend'),
        icon: 'users',
        content,
        onClose: () => {
          ui.hideModal();
          resolve(null);
        }
      });

      document.querySelectorAll('.recipient-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const uid = e.currentTarget.dataset.uid;
          resolve(friends.find(f => f.uid === uid) || null);
        });
      });
    });
  }

  /**
   * Hinweis statt blosser Fehlermeldung, wenn noch kein Friend da ist -
   * mit dem Weg dorthin gleich daneben.
   */
  showNoFriendsDialog() {
    return new Promise((resolve) => {
      const content = `
        <div class="text-center py-4">
          <div class="text-gray-400 dark:text-gray-500 mb-3">${ui.icon('users', 'w-10 h-10 mx-auto')}</div>
          <p class="font-semibold text-gray-900 dark:text-white mb-1">${ui.t('noFriendsToShare')}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">${ui.t('noFriendsHint')}</p>
        </div>
      `;

      const footer = `
        <button type="button" id="no-friends-scan-btn" class="w-full px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
          ${ui.icon('camera', 'w-5 h-5')}
          <span>${ui.t('scanFriendQR')}</span>
        </button>
      `;

      ui.showModalWithHeader({
        title: ui.t('shareToFriend'),
        icon: 'share-2',
        content,
        footer,
        onClose: () => {
          ui.hideModal();
          resolve();
        }
      });

      document.getElementById('no-friends-scan-btn').addEventListener('click', () => {
        ui.hideModal();
        resolve();
        this.showQRScanner();
      });
    });
  }

  /**
   * Vorschau mehrerer Einträge: Datum und Stunden je Zeile, oben die Summe.
   */
  renderEntryListPreview(entries) {
    const sorted = [...entries].sort((a, b) =>
      a.date.split('.').reverse().join('-').localeCompare(b.date.split('.').reverse().join('-'))
    );

    const total = sorted.reduce((sum, entry) => sum + callouts.getNetWorkHours(entry), 0);

    return `
      <div class="flex items-baseline justify-between gap-2 mb-2">
        <div class="font-semibold text-gray-900 dark:text-white">${sorted.length} ${ui.t('entriesLabel')}</div>
        <div class="text-lg font-bold text-primary flex-shrink-0">${ui.formatHours(total)}</div>
      </div>

      <div class="space-y-1">
        ${sorted.map(entry => {
          const [d, m, y] = (entry.date || '').split('.');
          const dateObj = (d && m && y) ? new Date(y, m - 1, d) : null;
          const weekday = dateObj ? dateObj.toLocaleDateString('de-DE', { weekday: 'short' }) : '';
          const net = callouts.getNetWorkHours(entry);

          return `
            <div class="flex justify-between gap-2 text-sm">
              <span class="text-gray-700 dark:text-gray-300 truncate">
                ${entry.date}${weekday ? `<span class="text-gray-500 dark:text-gray-400"> · ${weekday}</span>` : ''}
              </span>
              <span class="text-gray-500 dark:text-gray-400 flex-shrink-0">${net > 0 ? ui.formatHours(net) : '–'}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async sendSharedEntries(entries, recipient) {
    try {
      ui.hideModal();
      const result = await firebaseService.shareWorklogEntries(entries, recipient.uid);

      // Merken, damit beim nächsten Mal derselbe Empfänger vorgeschlagen wird
      ui.settings.lastShareRecipient = recipient.uid;
      await storage.saveSettings(ui.settings);

      ui.showToast(
        entries.length === 1
          ? ui.t('sharedWithUser').replace('{user}', `@${result.recipientNickname}`)
          : ui.t('sharedMultipleWithUser')
              .replace('{count}', entries.length)
              .replace('{user}', `@${result.recipientNickname}`),
        'success'
      );
      return true;
    } catch (error) {
      console.error('Cloud share failed:', error);
      if (error.message && error.message.includes('only share with friends')) {
        ui.showToast(ui.t('canOnlyShareWithFriends'), 'error');
      } else {
        ui.showToast(ui.t('shareFailed'), 'error');
      }
      return false;
    }
  }

  async shareWorklogEntryViaFile(entry) {
    try {
      // Create shareable data (exclude internal id, include WTT fields)
      // NOTE: targetHours is NOT shared - will be recalculated by recipient
      const shareData = {
        version: '1.1',
        type: 'liftec-timer-entry',
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        pause: entry.pause,
        travelTime: entry.travelTime,
        surcharge: entry.surcharge,
        surchargePercent: entry.surchargePercent,
        tasks: entry.tasks || [],
        // Work Time Tracking fields (v1.1+)
        entryType: entry.entryType,
        vacationDays: entry.vacationDays,
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
          version: '1.1',
          type: 'liftec-timer-entry',
          date: entry.date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          pause: entry.pause,
          travelTime: entry.travelTime,
          surcharge: entry.surcharge,
          surchargePercent: entry.surchargePercent,
          tasks: entry.tasks || [],
          // Work Time Tracking fields (v1.1+)
          // NOTE: targetHours not included - recipient will calculate from their settings
          entryType: entry.entryType,
          vacationDays: entry.vacationDays,
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
        surchargePercent: data.surchargePercent ?? (ui.settings?.surchargePercent || 0),
        tasks: data.tasks || []
      };

      // Calculate targetHours based on recipient's settings (not shared value!)
      if (ui.settings?.workTimeTracking?.enabled && data.date) {
        const [d, m, y] = data.date.split('.');
        const entryDate = new Date(y, m - 1, d);
        newEntry.targetHours = timeAccount.getDailyTargetHours(entryDate, ui.settings);

        // Copy WTT fields if present in v1.1+ format
        if (data.entryType) newEntry.entryType = data.entryType;
        if (data.vacationDays !== undefined) newEntry.vacationDays = data.vacationDays;
      }

      await storage.addWorklogEntry(newEntry);
      await this.recalculateVacationDays();
      await this.recalculateTimeAccountBalance();
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
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 text-center border border-gray-200 dark:border-gray-700">
          <p class="text-2xl font-bold text-gray-900 dark:text-white mb-1">@${this.escapeHtml(profile.nickname)}</p>
          <p class="text-sm text-gray-600 dark:text-gray-400">${this.escapeHtml(profile.displayName)}</p>
        </div>

        <!-- Der QR-Code braucht weissen Grund zum Scannen, der Rahmen lässt ihn
             im Dunkelmodus wie eine Karte wirken statt wie ein Loch -->
        <div id="qrcode-container" class="bg-white p-4 rounded-xl border border-gray-200 dark:border-gray-500 w-fit mx-auto mb-4 flex justify-center"></div>

        <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
          ${ui.t('qrCodeHint')}
        </p>
      `;

      ui.showModalWithHeader({
        title: ui.t('myQRCode'),
        icon: 'qr-code',
        content,
        footer: `
          <button type="button" id="qr-close-btn" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('close')}
          </button>
        `
      });

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
      <!-- Festes Seitenverhältnis, damit das Blatt beim Kamerastart nicht springt -->
      <div id="qr-reader" class="aspect-square w-full rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 mb-4"></div>

      <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
        ${ui.t('scannerHint')}
      </p>
    `;

    // Initialize QR Scanner
    let html5QrCode;

    // Die Kamera muss auf jedem Weg aus dem Dialog stoppen, sonst läuft sie weiter
    const stopScanner = async () => {
      try {
        await html5QrCode?.stop();
      } catch (error) {
        // Bereits gestoppt oder nie gestartet - nichts zu tun
      }
    };

    ui.showModalWithHeader({
      title: ui.t('scanQRCode'),
      icon: 'camera',
      content,
      footer: `
        <button type="button" id="scanner-close-btn" class="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">
          ${ui.t('cancel')}
        </button>
      `,
      onClose: async () => {
        await stopScanner();
        ui.hideModal();
      }
    });

    html5QrCode = new Html5Qrcode("qr-reader");

    const onScanSuccess = async (decodedText) => {
      await stopScanner();
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
      await stopScanner();
      ui.hideModal();
    });
  }

  /**
   * Confirm adding a friend after QR scan
   */
  async confirmAddFriend(friendUserId, friendNickname) {
    return new Promise((resolve) => {
      const content = `
        <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
          <span class="text-gray-500 dark:text-gray-400 flex-shrink-0">${ui.icon('user', 'w-8 h-8')}</span>
          <span class="min-w-0">
            <span class="block text-xl font-bold text-gray-900 dark:text-white truncate">@${this.escapeHtml(friendNickname)}</span>
          </span>
        </div>

        <p class="text-sm text-gray-600 dark:text-gray-400 mt-4">
          ${ui.t('addFriendConfirm')}
        </p>
      `;

      ui.showModalWithHeader({
        title: ui.t('addFriend'),
        icon: 'user',
        content,
        footer: `
          <div class="flex gap-2">
            <button type="button" id="add-friend-yes" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">
              ${ui.t('yes')}
            </button>
            <button type="button" id="add-friend-no" class="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('no')}
            </button>
          </div>
        `,
        onClose: () => {
          ui.hideModal();
          resolve(false);
        }
      });

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

      const content = friends.length > 0
        ? `<div class="space-y-2">
             ${friends.map(friend => `
               <div class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                 <span class="text-gray-500 dark:text-gray-400 flex-shrink-0">${ui.icon('user', 'w-5 h-5')}</span>
                 <div class="flex-1 min-w-0">
                   <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">@${this.escapeHtml(friend.nickname)}</p>
                   <p class="text-xs text-gray-600 dark:text-gray-400 truncate">${this.escapeHtml(friend.displayName)}</p>
                 </div>
                 <button type="button" class="remove-friend-btn text-red-500 hover:text-red-700 p-1 flex-shrink-0" data-friend-id="${friend.uid}" data-friend-nickname="${this.escapeHtml(friend.nickname)}" title="${ui.t('removeFriend')}">
                   ${ui.icon('trash', 'w-5 h-5')}
                 </button>
               </div>
             `).join('')}
           </div>`
        : `<div class="text-center py-8">
             <div class="text-gray-400 dark:text-gray-500 mb-2">${ui.icon('users', 'w-10 h-10 mx-auto')}</div>
             <p class="text-sm text-gray-500 dark:text-gray-400">${ui.t('noFriends')}</p>
             <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${ui.t('noFriendsHint')}</p>
           </div>`;

      ui.showModalWithHeader({
        title: ui.t('myFriends'),
        icon: 'users',
        content,
        footer: `
          <div class="flex gap-2">
            <button type="button" id="friends-scan-btn" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
              ${ui.icon('camera', 'w-5 h-5')}
              <span>${ui.t('scanFriendQR')}</span>
            </button>
            <button type="button" id="friends-close-btn" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('close')}
            </button>
          </div>
        `
      });

      document.getElementById('friends-scan-btn').addEventListener('click', () => {
        ui.hideModal();
        this.showQRScanner();
      });

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
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ${ui.t('nickname')} *
            </label>
            <div class="flex">
              <span class="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-l-lg border border-r-0 border-gray-300 dark:border-gray-600">@</span>
              <input
                type="text"
                id="profile-nickname"
                value="${this.escapeHtml(profile?.nickname || '')}"
                placeholder="maya"
                class="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-r-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
              value="${this.escapeHtml(profile?.displayName || ui.settings.username || '')}"
              placeholder="Maya Liftec"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
          </div>
        </div>
      `;

      ui.showModalWithHeader({
        title: isEdit ? ui.t('editProfile') : ui.t('createProfile'),
        icon: 'user',
        content,
        footer: `
          <div class="flex gap-2">
            <button type="button" id="save-profile-btn" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">
              ${ui.t('save')}
            </button>
            <button type="button" id="cancel-profile-btn" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">
              ${ui.t('cancel')}
            </button>
          </div>
        `
      });

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

        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 class="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            ${ui.icon('download', 'w-5 h-5 inline mr-1')} CSV importieren
          </h3>
          <p class="text-sm text-blue-800 dark:text-blue-300 mb-4">
            Worklog-Einträge aus einer CSV-Datei importieren
          </p>
          <button id="import-csv-btn" class="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2">
            ${ui.icon('upload', 'w-5 h-5')}
            <span>${ui.t('importCSV')}</span>
          </button>
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

    // CSV Import
    document.getElementById('import-csv-btn').addEventListener('click', () => {
      ui.hideModal();
      this.showImportMenu();
    });

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
                ${ui.t('restoreThisVersion')}
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
      versionsList.innerHTML = `<p class="text-sm text-red-500">${ui.t('errorLoadingVersions')}</p>`;
    }
  }

  async confirmAndRollback(version, tag) {
    const confirmed = await this.showConfirmDialog(
      ui.t('restoreVersionConfirm').replace('{version}', version),
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


  // ===== Search Function (v1.19.1) =====

  async showSearch() {
    const content = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            ${ui.icon('search', 'w-5 h-5')}
            <span>Einträge durchsuchen</span>
          </h3>
          <button id="close-search" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            ${ui.icon('x')}
          </button>
        </div>

        <!-- Search Input -->
        <div class="mb-4">
          <input type="text" id="search-input"
            class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="Suchbegriff eingeben..."
            autofocus>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Sucht in Aufgabenbeschreibungen (Groß-/Kleinschreibung egal)</p>
        </div>

        <!-- Search Results -->
        <div id="search-results" class="space-y-2 max-h-96 overflow-y-auto">
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Gib einen Suchbegriff ein um zu starten</p>
        </div>
      </div>
    `;

    ui.showModal(content);

    // Close button
    document.getElementById('close-search').addEventListener('click', () => {
      ui.hideModal();
    });

    // Search input with debounce
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();

      if (query.length === 0) {
        document.getElementById('search-results').innerHTML =
          '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Gib einen Suchbegriff ein um zu starten</p>';
        return;
      }

      if (query.length < 2) {
        document.getElementById('search-results').innerHTML =
          '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Mindestens 2 Zeichen eingeben</p>';
        return;
      }

      searchTimeout = setTimeout(() => this.performSearch(query), 300);
    });
  }

  async performSearch(query) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Suche läuft...</p>';

    try {
      const allEntries = await storage.getAllWorklogEntries();
      const queryLower = query.toLowerCase();

      // Filter entries that have tasks matching the search query
      const matches = [];
      for (const entry of allEntries) {
        if (!entry.tasks || entry.tasks.length === 0) continue;

        const matchingTasks = entry.tasks.filter(task =>
          task.description && task.description.toLowerCase().includes(queryLower)
        );

        if (matchingTasks.length > 0) {
          matches.push({ entry, matchingTasks });
        }
      }

      if (matches.length === 0) {
        resultsContainer.innerHTML =
          '<p class="text-sm text-gray-500 dark:text-gray-400 text-center py-8">Keine Ergebnisse gefunden</p>';
        return;
      }

      // Sort by date (newest first)
      matches.sort((a, b) => {
        const [dA, mA, yA] = a.entry.date.split('.');
        const [dB, mB, yB] = b.entry.date.split('.');
        const dateA = new Date(yA, mA - 1, dA);
        const dateB = new Date(yB, mB - 1, dB);
        return dateB - dateA;
      });

      // Render results
      let html = `<div class="text-sm text-gray-600 dark:text-gray-400 mb-3">${matches.length} Ergebnis${matches.length !== 1 ? 'se' : ''} gefunden</div>`;

      matches.forEach(({ entry, matchingTasks }) => {
        const [day, month, year] = entry.date.split('.');
        const dateObj = new Date(year, month - 1, day);
        const weekday = dateObj.toLocaleDateString('de-DE', { weekday: 'short' });

        html += `
          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer transition-colors"
               data-entry-id="${entry.id}">
            <div class="flex items-center justify-between mb-2">
              <div class="font-semibold text-gray-900 dark:text-white">
                ${weekday}, ${entry.date}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                ${matchingTasks.length} Treffer
              </div>
            </div>
            <div class="space-y-1">
              ${matchingTasks.map(task => {
                const highlightedDesc = this.highlightSearchTerm(task.description, query);
                return `
                  <div class="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                    <span class="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5">${task.type || '-'}</span>
                    <span class="flex-1">${highlightedDesc}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      });

      resultsContainer.innerHTML = html;

      // Add click handlers to open edit dialog
      resultsContainer.querySelectorAll('[data-entry-id]').forEach(el => {
        el.addEventListener('click', async () => {
          const entryId = parseInt(el.getAttribute('data-entry-id'));
          const entry = allEntries.find(e => e.id === entryId);
          if (entry) {
            ui.hideModal();
            await this.editWorklogEntry(entry);
          }
        });
      });

    } catch (error) {
      console.error('Search error:', error);
      resultsContainer.innerHTML =
        '<p class="text-sm text-red-500 text-center py-4">Fehler bei der Suche</p>';
    }
  }

  highlightSearchTerm(text, query) {
    if (!text || !query) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-600 px-0.5 rounded">$1</mark>');
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

  /**
   * Macht Text HTML-sicher. Bewusst ohne DOM, damit die Funktion auch in
   * Template-Strings und ohne document funktioniert.
   */
  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ===== Work Time Tracking & Vacation Onboarding =====

  // Helper: Parse time input (supports hh:mm, h,h, and h.h formats)
  parseTimeInput(value) {
    if (value === null || value === undefined || value === '') return 0;
    let str = String(value).trim();

    // Vorzeichen getrennt behandeln: bei "-04:48" wäre sonst nur die
    // Stundenzahl negativ und die Minuten würden gegengerechnet (-3,2 statt -4,8)
    const negative = str.startsWith('-');
    if (negative || str.startsWith('+')) str = str.slice(1);

    let hours;
    if (str.includes(':')) {
      // HH:MM
      const [h, m] = str.split(':').map(s => parseInt(s, 10) || 0);
      hours = h + (m / 60);
    } else {
      // Dezimal, auch mit Komma (8,5)
      hours = parseFloat(str.replace(',', '.')) || 0;
    }

    return negative ? -hours : hours;
  }

  // Helper: Parse a number of days (NICHT als Uhrzeit interpretieren).
  // parseTimeInput würde aus "25:30" 25,5 Tage machen - hier zählt nur die Zahl.
  parseDaysInput(value) {
    if (value === null || value === undefined || value === '') return 0;
    const normalized = String(value).trim().replace(',', '.');
    return parseFloat(normalized) || 0;
  }

  async showWorkTimeTrackingOnboarding() {
    let currentStep = 1;
    const totalSteps = 3;

    // Temporary storage for onboarding data
    let onboardingData = {
      dailyHours: { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 },
      timeAccountBalance: 0,
      remainingVacation: 25,
      annualVacation: 25
    };

    const showStep = (step) => {
      if (step === 1) {
        this.showWTTOnboardingStep1(onboardingData, () => showStep(2));
      } else if (step === 2) {
        this.showWTTOnboardingStep2(onboardingData, () => showStep(3), () => showStep(1));
      } else if (step === 3) {
        this.showWTTOnboardingStep3(onboardingData, () => showStep(2));
      }
    };

    showStep(1);
  }

  showWTTOnboardingStep1(data, onNext) {
    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">${ui.t('wttOnboardingTitle')}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">${ui.t('wttOnboardingWelcome')}</p>

        <div class="mb-6">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs text-gray-500">${ui.t('onboardingStep').replace('{current}', '1').replace('{total}', '3')}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="bg-primary h-2 rounded-full transition-all" style="width: 33%"></div>
          </div>
        </div>

        <h4 class="font-semibold text-gray-900 dark:text-white mb-2">${ui.t('wttOnboardingStep1Title')}</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${ui.t('wttOnboardingStep1Desc')}</p>

        <div class="space-y-3 mb-6">
          ${['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => `
            <div class="flex items-center justify-between">
              <label class="text-sm text-gray-700 dark:text-gray-300 w-32">${ui.t(day)}</label>
              <div class="flex items-center gap-2">
                <input type="text" id="wtt-${day}" value="${ui.formatHours(data.dailyHours[day] || 0)}" placeholder="08:30"
                  class="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm">
                
              </div>
            </div>
          `).join('')}
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Eingabe als HH:MM, z. B. 08:30</p>

        <div class="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
          <div class="flex justify-between items-center">
            <span class="font-semibold text-gray-900 dark:text-white">${ui.t('wttWeeklyTotal')}:</span>
            <span id="weekly-total" class="text-lg font-bold text-primary">00:00</span>
          </div>
        </div>

        <div class="flex gap-3">
          <button id="wtt-step1-next" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
            ${ui.t('onboardingNext')}
          </button>
        </div>
      </div>
    `;

    ui.showModal(content);

    // Update weekly total
    const updateTotal = () => {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const total = days.reduce((sum, day) => {
        const value = this.parseTimeInput(document.getElementById(`wtt-${day}`).value);
        return sum + value;
      }, 0);
      document.getElementById('weekly-total').textContent = ui.formatHours(total);
    };

    // Add event listeners to all inputs
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
      const input = document.getElementById(`wtt-${day}`);
      input.addEventListener('input', updateTotal);
    });

    updateTotal();

    document.getElementById('wtt-step1-next').addEventListener('click', () => {
      // Save data
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
        data.dailyHours[day] = this.parseTimeInput(document.getElementById(`wtt-${day}`).value);
      });
      onNext();
    });
  }

  showWTTOnboardingStep2(data, onNext, onBack) {
    // Generate last 12 months for selection
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        label: date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      });
    }

    let selectedMonth = data.referenceMonth || months[0].value;

    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">${ui.t('wttOnboardingTitle')}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">${ui.t('wttOnboardingWelcome')}</p>

        <div class="mb-6">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs text-gray-500">${ui.t('onboardingStep').replace('{current}', '2').replace('{total}', '3')}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="bg-primary h-2 rounded-full transition-all" style="width: 67%"></div>
          </div>
        </div>

        <h4 class="font-semibold text-gray-900 dark:text-white mb-2">${ui.t('wttOnboardingStep2Title')}</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${ui.t('wttOnboardingStep2Desc')}</p>

        <div class="space-y-4 mb-6">
          <!-- Month Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">${ui.t('payrollMonth')}</label>
            <div class="grid grid-cols-3 gap-2" id="month-selector">
              ${months.map((m, idx) => `
                <button class="month-btn px-3 py-2 text-sm rounded-lg border transition-all ${idx === 0 ? 'bg-primary border-primary text-gray-900 font-semibold' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary'}"
                  data-month="${m.value}">
                  ${m.label}
                </button>
              `).join('')}
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">${ui.t('payrollMonthHelp')}</p>
          </div>

          <!-- Time Account Balance -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">${ui.t('wttCurrentBalance')}</label>
            <div class="flex items-center gap-2">
              <input type="text" id="wtt-balance" value="${ui.formatHours(data.timeAccountBalance || 0)}" placeholder="08:30 oder -04:48"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Eingabe als HH:MM, z. B. 08:30 oder -04:48</p>
          </div>

          <!-- Remaining Vacation -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">${ui.t('wttRemainingVacation')}</label>
            <div class="flex items-center gap-2">
              <input type="text" id="wtt-vacation-remaining" value="${data.remainingVacation || '25'}" placeholder="25 oder 25,5"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <span class="text-sm text-gray-500">${ui.t('days')}</span>
            </div>
          </div>

          <!-- Annual Vacation -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">${ui.t('wttAnnualVacation')}</label>
            <div class="flex items-center gap-2">
              <input type="text" id="wtt-vacation-annual" value="${data.annualVacation || '25'}" placeholder="25"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <span class="text-sm text-gray-500">${ui.t('days')}</span>
            </div>
          </div>
        </div>

        <div class="flex gap-3">
          <button id="wtt-step2-back" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('back')}
          </button>
          <button id="wtt-step2-next" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
            ${ui.t('onboardingNext')}
          </button>
        </div>
      </div>
    `;

    ui.showModal(content);

    // Month selection handler
    document.querySelectorAll('.month-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.month-btn').forEach(b => {
          b.className = 'month-btn px-3 py-2 text-sm rounded-lg border transition-all bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary';
        });
        e.currentTarget.className = 'month-btn px-3 py-2 text-sm rounded-lg border transition-all bg-primary border-primary text-gray-900 font-semibold';
        selectedMonth = e.currentTarget.dataset.month;
      });
    });

    document.getElementById('wtt-step2-back').addEventListener('click', () => {
      onBack();
    });

    document.getElementById('wtt-step2-next').addEventListener('click', () => {
      // Save data with parsing
      data.timeAccountBalance = this.parseTimeInput(document.getElementById('wtt-balance').value);
      data.remainingVacation = this.parseDaysInput(document.getElementById('wtt-vacation-remaining').value);
      data.annualVacation = parseInt(document.getElementById('wtt-vacation-annual').value) || 25;
      data.referenceMonth = selectedMonth;
      onNext();
    });
  }

  async showWTTOnboardingStep3(data, onBack) {
    const weeklyTotal = Object.values(data.dailyHours).reduce((sum, h) => sum + h, 0);

    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-2 text-gray-900 dark:text-white">${ui.t('wttOnboardingTitle')}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">${ui.t('wttOnboardingWelcome')}</p>

        <div class="mb-6">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs text-gray-500">${ui.t('onboardingStep').replace('{current}', '3').replace('{total}', '3')}</span>
          </div>
          <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div class="bg-primary h-2 rounded-full transition-all" style="width: 100%"></div>
          </div>
        </div>

        <h4 class="font-semibold text-gray-900 dark:text-white mb-2">${ui.t('wttOnboardingStep3Title')}</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${ui.t('wttOnboardingStep3Desc')}</p>

        <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 mb-6 space-y-2">
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">${ui.t('weeklyTarget')}:</span>
            <span class="font-semibold text-gray-900 dark:text-white">${ui.formatHours(weeklyTotal)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">${ui.t('timeAccount')}:</span>
            <span class="font-semibold text-gray-900 dark:text-white">${data.timeAccountBalance >= 0 ? '+' : ''}${ui.formatHours(data.timeAccountBalance)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">${ui.t('remainingVacation')}:</span>
            <span class="font-semibold text-gray-900 dark:text-white">${data.remainingVacation} ${ui.t('days')}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600 dark:text-gray-400">${ui.t('annualVacation')}:</span>
            <span class="font-semibold text-gray-900 dark:text-white">${data.annualVacation} ${ui.t('days')}</span>
          </div>
        </div>

        <div class="flex gap-3">
          <button id="wtt-step3-back" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('back')}
          </button>
          <button id="wtt-step3-finish" class="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600">
            ${ui.t('onboardingFinish')} ✓
          </button>
        </div>
      </div>
    `;

    ui.showModal(content);

    document.getElementById('wtt-step3-back').addEventListener('click', () => {
      onBack();
    });

    document.getElementById('wtt-step3-finish').addEventListener('click', async () => {
      // Calculate reference date from selected month (first day of NEXT month)
      let referenceDate = null;
      let referenceDateStr = null;
      if (data.referenceMonth) {
        const [year, month] = data.referenceMonth.split('-').map(Number);
        referenceDate = new Date(year, month, 1); // First day of next month (month is 1-based in input, becomes correct in Date constructor)
        referenceDateStr = this.formatReferenceDate(referenceDate);
      }

      // Save all settings
      const settings = ui.settings;
      settings.workTimeTracking = {
        enabled: true,
        onboardingCompleted: true,
        weeklyTargetHours: weeklyTotal,
        // Erster Satz, gültig ab 2000 - deckt damit auch Einträge ab, die
        // vor dem Stichtag liegen. Weitere Sätze legt man in den
        // Einstellungen mit eigenem Gültig-ab-Datum an.
        rateHistory: [{
          validFrom: '2000-01-01',
          dailyTargetHours: data.dailyHours,
          onCallRate: 0,
          hourlyWage: 0
        }],
        timeAccount: {
          currentBalance: data.timeAccountBalance,
          lastUpdated: new Date().toISOString(),
          lastManualAdjustment: new Date().toISOString(),
          referenceDate: referenceDateStr,
          referenceBalance: data.timeAccountBalance
        },
        vacation: {
          annualDays: data.annualVacation,
          remainingDays: data.remainingVacation,
          referenceDate: referenceDateStr,
          referenceRemaining: data.remainingVacation
        }
      };

      await storage.saveSettings(settings);
      ui.settings = settings;

      // Saldo und Resturlaub direkt auf Basis der vorhandenen Einträge
      // hochrechnen, sonst zeigt das Widget bis zum nächsten gespeicherten
      // Eintrag den reinen Lohnzettel-Stand
      await this.recalculateVacationDays();
      await this.recalculateTimeAccountBalance();

      ui.hideModal();
      ui.showToast(ui.t('workTimeTracking') + ' aktiviert!', 'success');
      await this.renderMainScreen();
    });
  }

  // ===== Time Account Manual Adjustment =====

  async showTimeAccountAdjustment() {
    // Generate last 12 months for selection
    const months = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        label: date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
        value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      });
    }

    const currentVacation = ui.settings.workTimeTracking.vacation.remainingDays || 0;
    let selectedMonth = months[0].value; // Current month by default

    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">${ui.t('adjustTimeAccount')}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${ui.t('adjustmentDescription')}</p>

        <div class="space-y-4 mb-6">
          <!-- Month Selection -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">${ui.t('payrollMonth')}</label>
            <div class="grid grid-cols-3 gap-2" id="month-selector">
              ${months.map((m, idx) => `
                <button class="month-btn px-3 py-2 text-sm rounded-lg border transition-all ${idx === 0 ? 'bg-primary border-primary text-gray-900 font-semibold' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary'}"
                  data-month="${m.value}">
                  ${m.label}
                </button>
              `).join('')}
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">${ui.t('payrollMonthHelp')}</p>
          </div>

          <!-- Time Account Balance -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">${ui.t('timeAccountFromPayroll')}</label>
            <div class="flex items-center gap-2">
              <input type="text" id="payroll-balance" value="00:00" placeholder="08:30 oder -04:48"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Eingabe als HH:MM, z. B. 08:30 oder -04:48</p>
          </div>

          <!-- Vacation Days -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">${ui.t('vacationFromPayroll')}</label>
            <div class="flex items-center gap-2">
              <input type="text" id="payroll-vacation" value="${currentVacation}" placeholder="25 oder 25,5"
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              <span class="text-sm text-gray-500">${ui.t('days')}</span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${ui.t('vacationHelp')}</p>
          </div>

          <!-- Summary Box -->
          <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div class="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">${ui.t('adjustmentSummary')}:</div>
            <div class="text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <div>${ui.t('referenceDateLabel')}: <span id="selected-month-display" class="font-semibold">${months[0].label}</span></div>
              <div>${ui.t('calculationInfo')}</div>
            </div>
          </div>
        </div>

        <div class="flex gap-3">
          <button id="adjustment-cancel" class="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600">
            ${ui.t('cancel')}
          </button>
          <button id="adjustment-save" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark">
            ${ui.t('save')}
          </button>
        </div>
      </div>
    `;

    ui.showModal(content);

    // Month selection handler
    document.querySelectorAll('.month-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.month-btn').forEach(b => {
          b.className = 'month-btn px-3 py-2 text-sm rounded-lg border transition-all bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary';
        });
        e.currentTarget.className = 'month-btn px-3 py-2 text-sm rounded-lg border transition-all bg-primary border-primary text-gray-900 font-semibold';
        selectedMonth = e.currentTarget.dataset.month;

        // Update display
        const monthObj = months.find(m => m.value === selectedMonth);
        document.getElementById('selected-month-display').textContent = monthObj.label;
      });
    });

    document.getElementById('adjustment-cancel').addEventListener('click', () => {
      ui.hideModal();
    });

    document.getElementById('adjustment-save').addEventListener('click', async () => {
      const balanceInput = this.parseTimeInput(document.getElementById('payroll-balance').value);
      const vacationInput = this.parseDaysInput(document.getElementById('payroll-vacation').value);

      // Calculate reference date (first day of NEXT month)
      const [year, month] = selectedMonth.split('-').map(Number);
      const referenceDate = new Date(year, month, 1); // First day of next month
      const referenceDateStr = this.formatReferenceDate(referenceDate);

      // Update settings with reference values
      const settings = ui.settings;
      settings.workTimeTracking.timeAccount.referenceDate = referenceDateStr;
      settings.workTimeTracking.timeAccount.referenceBalance = balanceInput;
      settings.workTimeTracking.timeAccount.lastManualAdjustment = new Date().toISOString();

      settings.workTimeTracking.vacation.referenceDate = referenceDateStr;
      settings.workTimeTracking.vacation.referenceRemaining = vacationInput;

      await storage.saveSettings(settings);
      ui.settings = settings;

      // Neuberechnung über die zentralen Funktionen. Früher rechnete dieser
      // Dialog selbst - mit einem anderen Algorithmus als
      // recalculateTimeAccountBalance(). Dadurch sprang der Saldo, sobald
      // danach irgendein Eintrag gespeichert wurde. Jetzt gibt es nur noch
      // eine Wahrheit.
      await this.recalculateVacationDays();
      await this.recalculateTimeAccountBalance();

      ui.hideModal();
      ui.showToast(ui.t('adjustmentSaved'), 'success');

      // Refresh history to show new balance
      await this.showHistory();
    });
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
