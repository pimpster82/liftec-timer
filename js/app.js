// LIFTEC Timer - Main Application

const APP_VERSION = '1.2.0';

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
    banner.className = 'fixed top-0 left-0 right-0 bg-blue-600 text-white p-4 shadow-lg z-50 animate-slide-down';

    const changelogHtml = updateInfo.changelog
      ? `<ul class="text-sm mt-2 space-y-1 list-disc list-inside">${updateInfo.changelog.map(item => `<li>${item}</li>`).join('')}</ul>`
      : '';

    banner.innerHTML = `
      <div class="max-w-4xl mx-auto">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              ${ui.icon('arrow-down-circle')}
              <strong class="text-lg">Update verfügbar: v${updateInfo.version}</strong>
              ${updateInfo.critical ? '<span class="bg-red-500 px-2 py-0.5 rounded text-xs ml-2">Wichtig</span>' : ''}
            </div>
            <p class="text-sm opacity-90">Veröffentlicht am ${updateInfo.releaseDate}</p>
            ${changelogHtml}
          </div>
          <button id="update-banner-close" class="ml-4 text-white hover:text-gray-200" ${updateInfo.critical ? 'disabled style="display:none"' : ''}>
            ${ui.icon('x')}
          </button>
        </div>
        <div class="flex gap-2 mt-4">
          <button id="update-now-btn" class="px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100">
            Jetzt aktualisieren
          </button>
          ${!updateInfo.critical ? `
            <button id="update-later-btn" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-400">
              Später erinnern
            </button>
            <button id="update-dismiss-btn" class="px-4 py-2 text-white hover:bg-blue-500 rounded-lg">
              Nicht mehr anzeigen
            </button>
          ` : ''}
        </div>
      </div>
    `;

    document.body.prepend(banner);

    // Event listeners
    document.getElementById('update-now-btn').addEventListener('click', () => {
      this.performUpdate();
    });

    if (!updateInfo.critical) {
      document.getElementById('update-banner-close')?.addEventListener('click', () => {
        banner.remove();
      });

      document.getElementById('update-later-btn')?.addEventListener('click', () => {
        // Remind in 24 hours
        localStorage.setItem('remindUpdateLater', String(Date.now() + 24 * 60 * 60 * 1000));
        banner.remove();
        ui.showToast('Erinnerung in 24 Stunden', 'info');
      });

      document.getElementById('update-dismiss-btn')?.addEventListener('click', () => {
        localStorage.setItem('dismissedUpdateVersion', updateInfo.version);
        banner.remove();
        ui.showToast('Update-Benachrichtigung deaktiviert', 'info');
      });
    }
  }

  async performUpdate() {
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
          ${ui.icon('calendar', 'icon-md')}
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
        if (durationElement) {
          durationElement.textContent = ui.formatDuration(this.session.start);
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

    // Get pause and travel time
    const pause = await this.showInputDialog('Pause (in Stunden, z.B. 0.5)', '0');
    if (pause === null) return;

    const travel = await this.showInputDialog('Fahrtzeit (in Stunden)', '0');
    if (travel === null) return;

    const pauseHours = parseFloat(pause.replace(',', '.')) || 0;
    const travelHours = parseFloat(travel.replace(',', '.')) || 0;

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
   */
  async getOnCallStatus() {
    try {
      return await storage.getOnCallStatus();
    } catch (error) {
      console.error('Error getting on-call status:', error);
      return {
        id: 'active',
        active: false,
        startDate: null,
        startTime: null,
        endDate: null,
        endTime: null
      };
    }
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

      // Save to storage
      await storage.startOnCall(startDate, startTime);

      // Update UI
      await this.renderMainScreen();
      ui.showToast(ui.t('onCallActive'), 'success');
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

      const confirmed = await this.showConfirmDialog(
        ui.t('onCallEnded'),
        `${summary}\n${total}`
      );

      // Only save on-call if user confirmed
      if (confirmed) {
        ui.hideModal();  // Close dialog first
        // Now save end time to storage
        await storage.endOnCall(endDate, endTime);
        await storage.clearOnCall();
        // Update UI
        await this.renderMainScreen();
        ui.showToast(ui.t('onCallEnded'), 'success');
      }
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

      // Sum up actual work hours (surcharge field contains the total billable hours)
      let workHours = 0;
      for (const entry of entries) {
        if (entry.surcharge) {
          // Convert HH:MM to hours
          const [hours, minutes] = entry.surcharge.split(':').map(Number);
          workHours += hours + (minutes / 60);
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
            <button class="absence-type-btn w-full px-4 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 flex items-center justify-center gap-2" data-type="Feiertag">
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
      const dateStr = initialDate.toISOString().slice(0, 16);

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
        const statusColor = settings.cloudSync ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400';
        syncStatusHTML = `
          <div class="mt-2 text-sm ${statusColor}">
            ● ${statusText}${settings.cloudSync ? ' (Sync aktiv)' : ' (Sync deaktiviert)'}
          </div>
        `;

        // Last sync time
        if (settings.cloudSync) {
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
                ${ui.icon('chevron-down', 'collapsible-icon transition-transform')}
              </button>
              <div id="cloud-sync-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary">

              ${syncStatusHTML}
              ${lastSyncHTML}

              <div class="mt-3 flex items-center gap-3">
                <label class="flex items-center gap-2">
                  <input type="checkbox" id="setting-cloud-sync" ${settings.cloudSync ? 'checked' : ''}
                    class="w-4 h-4 text-primary focus:ring-primary rounded" ${!isSignedIn ? 'disabled' : ''}>
                  <span class="text-sm text-gray-700 dark:text-gray-300">Cloud Sync aktivieren</span>
                </label>
              </div>

              ${isSignedIn && settings.cloudSync ? `
                <div class="mt-3">
                  <button id="firebase-manual-sync" class="w-full px-3 py-2 bg-primary text-gray-900 rounded-lg text-sm font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
                    <span id="sync-button-text">Jetzt syncen</span>
                    <span id="sync-button-spinner" class="hidden">
                      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </span>
                  </button>
                  <p class="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-start gap-2">
                    ${ui.icon('clock', 'flex-shrink-0 mt-0.5')}
                    <span>Automatischer Sync: alle 60 Minuten</span>
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
              ${ui.icon('chevron-down', 'collapsible-icon transition-transform')}
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
              ${ui.icon('chevron-down', 'collapsible-icon transition-transform')}
            </button>
            <div id="email-content" class="collapsible-content hidden mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-l-2 border-primary space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email-Adresse</label>
                <input type="email" id="setting-email" value="${settings.email}"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
              </div>
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
      // Cloud Sync Toggle
      const cloudSyncCheckbox = document.getElementById('setting-cloud-sync');
      if (cloudSyncCheckbox) {
        cloudSyncCheckbox.addEventListener('change', async (e) => {
          const enabled = e.target.checked;
          if (enabled) {
            firebaseService.enableSync();
            // Start initial sync
            const entries = await storage.getAllWorklogEntries();
            if (entries.length > 0) {
              ui.showToast('Synchronisiere Daten...', 'info');
              await firebaseService.syncWorklogEntries(entries);
            }
          } else {
            firebaseService.disableSync();
          }
        });
      }

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
          icon.style.transform = 'rotate(180deg)';

          // Restore scroll position to prevent jumping up
          if (scrollableParent) {
            scrollableParent.scrollTop = scrollBefore;
          }
        } else {
          // Closing
          content.classList.add('hidden');
          icon.style.transform = 'rotate(0deg)';
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

    // ===== Settings Save =====
    document.getElementById('settings-save').addEventListener('click', async () => {
      const newSettings = {
        username: document.getElementById('setting-username').value,
        email: document.getElementById('setting-email').value,
        language: document.getElementById('setting-language').value,
        surchargePercent: parseInt(document.getElementById('setting-surcharge').value),
        emailSubject: document.getElementById('setting-email-subject').value,
        emailBody: document.getElementById('setting-email-body').value,
        cloudSync: document.getElementById('setting-cloud-sync') ?
                   document.getElementById('setting-cloud-sync').checked :
                   settings.cloudSync,
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

    // Step 2: Choose export format
    const formatDialogContent = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          ${ui.icon('download')}
          <span>Export-Format wählen</span>
        </h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Monat: <strong>${year}-${pad2(month)}</strong>
        </p>
        <div class="space-y-3">
          <button id="export-xlsx" class="w-full px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
            ${ui.icon('document')}
            <span>Excel (.xlsx) - Formatiert</span>
          </button>
          <button id="export-csv" class="w-full px-4 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 flex items-center justify-center gap-2">
            ${ui.icon('document')}
            <span>CSV - Einfach</span>
          </button>
        </div>
        <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
          Abbrechen
        </button>
      </div>
    `;

    ui.showModal(formatDialogContent);

    // Excel export
    document.getElementById('export-xlsx').addEventListener('click', async () => {
      ui.hideModal();
      await this.showExcelExport(year, month);
    });

    // CSV export
    document.getElementById('export-csv').addEventListener('click', async () => {
      ui.hideModal();
      await this.showCSVExport(year, month);
    });

    document.getElementById('dialog-cancel').addEventListener('click', () => {
      ui.hideModal();
    });
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
            <span>${ui.t('exportSuccess')}</span>
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">${filename}</p>
          <div class="space-y-2">
            <button id="xlsx-download" class="w-full px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold hover:bg-primary-dark flex items-center justify-center gap-2">
              ${ui.icon('download')}
              <span>${ui.t('download')}</span>
            </button>
            <button id="xlsx-email" class="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 flex items-center justify-center gap-2">
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

      // Download Button
      document.getElementById('xlsx-download').addEventListener('click', () => {
        excelExport.downloadExcel(blob, filename);
        ui.hideModal();
        ui.showToast('Excel heruntergeladen', 'success');
      });

      // E-Mail / Share Button
      document.getElementById('xlsx-email').addEventListener('click', () => {
        excelExport.sendEmail(blob, filename, ui.settings);
        ui.hideModal();
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

    // Statistics HTML
    const statsHtml = `
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-primary bg-opacity-20 rounded-lg p-4">
          <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Diese Woche</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-white">${weekHours.toFixed(1)}h</div>
          <div class="text-xs text-gray-500 mt-1">${weekDays} ${weekDays === 1 ? 'Tag' : 'Tage'}</div>
        </div>
        <div class="bg-blue-100 dark:bg-blue-900 rounded-lg p-4">
          <div class="text-xs text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-1">Dieser Monat</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-white">${monthHours.toFixed(1)}h</div>
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

        <button id="dialog-ok" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
          ${ui.t('close')}
        </button>
      </div>
    `;

    ui.showModal(content);

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
