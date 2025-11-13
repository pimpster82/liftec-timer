// LIFTEC Timer - Main Application

const APP_VERSION = '1.0.0';

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

      // Load current session
      this.session = await storage.getCurrentSession();

      // Register service worker
      await this.registerServiceWorker();

      // Check for updates
      this.checkForUpdates();

      // Setup install prompt
      this.setupInstallPrompt();

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
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
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

  checkForUpdates() {
    if (this.serviceWorkerRegistration) {
      this.serviceWorkerRegistration.update();
    }
  }

  showUpdateAvailable() {
    const updateBanner = document.getElementById('update-available');
    updateBanner.classList.remove('hidden');

    document.getElementById('update-btn').addEventListener('click', () => {
      // Tell the service worker to skip waiting
      if (this.serviceWorkerRegistration.waiting) {
        this.serviceWorkerRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Reload the page
      window.location.reload();
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
    // Menu button
    document.getElementById('menu-btn').addEventListener('click', () => {
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

    // Render hero card
    const heroCard = document.getElementById('hero-card');
    heroCard.innerHTML = ui.createHeroCard(this.session);

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
          const index = parseInt(e.target.dataset.index);
          this.editTask(index);
        });
      });

      document.querySelectorAll('.task-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index);
          this.deleteTask(index);
        });
      });
    } else {
      sessionInfo.innerHTML = '';
    }

    // Render actions
    const actions = document.getElementById('actions');
    if (!this.session) {
      // No session - show start button
      actions.innerHTML = `
        <button id="start-btn" class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 rounded-lg flex items-center justify-center space-x-2 btn-press">
          <span class="text-2xl">▶</span>
          <span>${ui.t('startSession')}</span>
        </button>
      `;

      document.getElementById('start-btn').addEventListener('click', () => this.startSession());
    } else {
      // Active session - show add task and end session buttons
      actions.innerHTML = `
        <button id="add-task-btn" class="w-full bg-primary hover:bg-primary-dark text-gray-900 font-semibold py-4 rounded-lg flex items-center justify-center space-x-2 btn-press">
          <span class="text-xl">+</span>
          <span>${ui.t('addTask')}</span>
        </button>
        <button id="end-btn" class="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-lg flex items-center justify-center space-x-2 btn-press">
          <span class="text-xl">■</span>
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
          <button class="task-edit-btn text-blue-500 hover:text-blue-700 p-1" data-index="${index}" title="Bearbeiten">
            ✏️
          </button>
          <button class="task-delete-btn text-red-500 hover:text-red-700 p-1" data-index="${index}" title="Löschen">
            🗑️
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

  // ===== Dialogs =====

  showDateTimePicker(title, initialDate) {
    return new Promise((resolve) => {
      const dateStr = initialDate.toISOString().slice(0, 16);

      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">${title}</h3>
          <input type="datetime-local" id="datetime-input" value="${dateStr}"
                 class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4" step="300">
          <div class="flex space-x-3">
            <button id="dialog-cancel" class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">
              ${ui.t('cancel')}
            </button>
            <button id="dialog-ok" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold">
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
          <h3 class="text-lg font-semibold mb-4">${title}</h3>
          <input type="text" id="text-input" value="${initialValue}"
                 class="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4">
          <div class="flex space-x-3">
            <button id="dialog-cancel" class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">
              ${ui.t('cancel')}
            </button>
            <button id="dialog-ok" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold">
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

  showTaskTypeSelector(defaultType = null) {
    return new Promise((resolve) => {
      const content = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">${ui.t('taskType')}</h3>
          <div class="space-y-2 mb-4">
            ${Object.entries(TASK_TYPES).map(([code, name]) => {
              const isSelected = code === defaultType;
              const bgClass = isSelected ? 'bg-primary text-gray-900' : 'bg-gray-100 hover:bg-gray-200';
              return `
                <button class="task-type-btn w-full px-4 py-3 text-left ${bgClass} rounded-lg" data-type="${code}">
                  ${name} ${code ? `<span class="badge float-right">${code}</span>` : ''}
                </button>
              `;
            }).join('')}
          </div>
          <button id="dialog-cancel" class="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">
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
        : `<p class="text-sm text-gray-500">${ui.t('noTasks')}</p>`;

      const content = `
        <div class="p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-xl font-bold text-primary mb-4">${ui.t('sessionSummary')}</h3>

          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('date')}</span>
              <span class="font-semibold">${ui.formatDate(data.startTime)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('start')}</span>
              <span class="font-semibold">${ui.formatTime(data.startTime)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('end')}</span>
              <span class="font-semibold">${ui.formatTime(data.endTime)}</span>
            </div>
          </div>

          <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('pause')}</span>
              <span class="font-semibold">${ui.hoursToHHMM(data.pauseHours)} h</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('travelTime')}</span>
              <span class="font-semibold">${ui.hoursToHHMM(data.travelHours)} h</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('netWorkTime')}</span>
              <span class="font-semibold">${ui.hoursToHHMM(data.netHours)} h</span>
            </div>
            <div class="flex justify-between border-t border-gray-300 dark:border-gray-600 pt-2">
              <span class="text-gray-600 dark:text-gray-400">${ui.t('surcharge')} (${data.surchargePercent}%)</span>
              <span class="text-2xl font-bold text-primary">${ui.hoursToHHMM(data.surchargeHours)} h</span>
            </div>
          </div>

          ${data.tasks.length > 0 ? `
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4">
              <p class="text-xs text-gray-500 uppercase tracking-wide mb-2">${ui.t('tasks')} (${data.tasks.length})</p>
              <div class="space-y-1">
                ${tasksHTML}
              </div>
            </div>
          ` : ''}

          <div class="flex space-x-3">
            <button id="dialog-cancel" class="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg">
              ${ui.t('cancel')}
            </button>
            <button id="dialog-ok" class="flex-1 px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold">
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
        <h3 class="text-lg font-semibold mb-4">${ui.t('menu')}</h3>
        <div class="space-y-2">
          <button id="menu-settings" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 rounded-lg">
            ⚙️ ${ui.t('settings')}
          </button>
          <button id="menu-export" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 rounded-lg">
            📤 ${ui.t('monthExport')}
          </button>
          <button id="menu-history" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 rounded-lg">
            📋 ${ui.t('recordings')}
          </button>
          <button id="menu-about" class="w-full px-4 py-3 text-left bg-gray-100 hover:bg-gray-200 rounded-lg">
            ℹ️ Info
          </button>
        </div>
        <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">
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

    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">⚙️ ${ui.t('settings')}</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" id="setting-username" value="${settings.username}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" id="setting-email" value="${settings.email}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">${ui.t('language')}</label>
            <select id="setting-language"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
              <option value="de" ${settings.language === 'de' ? 'selected' : ''}>Deutsch</option>
              <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
              <option value="hr" ${settings.language === 'hr' ? 'selected' : ''}>Hrvatski</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">${ui.t('surcharge')} (%)</label>
            <input type="number" id="setting-surcharge" value="${settings.surchargePercent}" min="0" max="200"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email Betreff</label>
            <input type="text" id="setting-email-subject" value="${settings.emailSubject}"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">
            <p class="text-xs text-gray-500 mt-1">Platzhalter: {month}, {name}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Email Text</label>
            <textarea id="setting-email-body" rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent">${settings.emailBody}</textarea>
            <p class="text-xs text-gray-500 mt-1">Platzhalter: {month}, {name}</p>
          </div>
        </div>
        <div class="flex gap-2 mt-6">
          <button id="settings-save" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold">
            ${ui.t('save')}
          </button>
          <button id="settings-cancel" class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">
            ${ui.t('cancel')}
          </button>
        </div>
      </div>
    `;

    ui.showModal(content);

    document.getElementById('settings-save').addEventListener('click', async () => {
      const newSettings = {
        username: document.getElementById('setting-username').value,
        email: document.getElementById('setting-email').value,
        language: document.getElementById('setting-language').value,
        surchargePercent: parseInt(document.getElementById('setting-surcharge').value),
        emailSubject: document.getElementById('setting-email-subject').value,
        emailBody: document.getElementById('setting-email-body').value
      };

      await storage.saveSettings(newSettings);
      ui.settings = newSettings;
      ui.i18n = ui.getI18N();

      ui.hideModal();
      ui.showToast(ui.t('settingsSaved'), 'success');
      await this.renderMainScreen();
    });

    document.getElementById('settings-cancel').addEventListener('click', () => {
      ui.hideModal();
    });
  }

  // ===== Export =====

  async showExportMenu() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
      const { content, filename } = await csvExport.generateMonthlyCSV(year, month, ui.settings.username);

      const dialogContent = `
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">${ui.t('exportSuccess')}</h3>
          <p class="text-sm text-gray-600 mb-4">${filename}</p>
          <div class="space-y-2">
            <button id="export-download" class="w-full px-4 py-3 bg-primary text-gray-900 rounded-lg font-semibold">
              ${ui.t('download')}
            </button>
            <button id="export-email" class="w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold">
              ${ui.t('sendEmail')}
            </button>
          </div>
          <button id="dialog-cancel" class="w-full mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">
            ${ui.t('close')}
          </button>
        </div>
      `;

      ui.showModal(dialogContent);

      document.getElementById('export-download').addEventListener('click', () => {
        csvExport.downloadCSV(content, filename);
        ui.hideModal();
        ui.showToast('CSV heruntergeladen', 'success');
      });

      document.getElementById('export-email').addEventListener('click', () => {
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
          <h3 class="text-lg font-semibold mb-4">📋 ${ui.t('recordings')}</h3>
          <p class="text-gray-500">Noch keine Einträge vorhanden</p>
          <button id="dialog-ok" class="mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">
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
              <button class="history-edit-btn text-blue-500 hover:text-blue-700 p-1" data-id="${entry.id}" title="Bearbeiten">✏️</button>
              <button class="history-delete-btn text-red-500 hover:text-red-700 p-1" data-id="${entry.id}" title="Löschen">🗑️</button>
            </div>
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            ${entry.startTime} - ${entry.endTime}
          </div>
          ${entry.pause ? `<div class="text-xs text-gray-500">Pause: ${entry.pause}</div>` : ''}
          ${entry.travelTime ? `<div class="text-xs text-gray-500">Fahrt: ${entry.travelTime}</div>` : ''}
          ${entry.surcharge ? `<div class="text-xs text-gray-500">Zuschlag: ${entry.surcharge}</div>` : ''}
          ${taskList ? `<div class="text-sm text-gray-700 dark:text-gray-300 mt-2">${taskList}</div>` : ''}
        </div>
      `;
    }).join('');

    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">📋 ${ui.t('recordings')}</h3>

        ${statsHtml}

        <div class="mb-3">
          <div class="text-xs text-gray-500 uppercase tracking-wide mb-2">Alle Einträge (${entries.length})</div>
        </div>

        <div class="max-h-64 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
          ${entriesHtml}
        </div>

        <button id="dialog-ok" class="w-full mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg">
          ${ui.t('close')}
        </button>
      </div>
    `;

    ui.showModal(content);

    // Add event listeners for edit buttons
    document.querySelectorAll('.history-edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const entryId = parseInt(e.target.dataset.id);
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
        const entryId = parseInt(e.target.dataset.id);
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
        <div class="p-6 max-h-[80vh] overflow-y-auto">
          <h3 class="text-lg font-semibold mb-4">Eintrag bearbeiten</h3>

          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Datum</label>
              <input type="date" id="edit-date" value="${entry.date.split('.').reverse().join('-')}"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Startzeit</label>
                <input type="time" id="edit-start" value="${entry.startTime}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endzeit</label>
                <input type="time" id="edit-end" value="${entry.endTime}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pause (HH:MM)</label>
                <input type="time" id="edit-pause" value="${entry.pause || '00:00'}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg">
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fahrtzeit (HH:MM)</label>
                <input type="time" id="edit-travel" value="${entry.travelTime || '00:00'}"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg">
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Zuschlag (HH:MM)</label>
              <input type="time" id="edit-surcharge" value="${entry.surcharge || '00:00'}"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Aufgaben</label>
              <div id="edit-tasks-list" class="space-y-2 mb-2">
                ${entry.tasks && entry.tasks.length > 0 ? entry.tasks.map((task, idx) => `
                  <div class="flex gap-2">
                    <input type="text" class="task-type flex-none w-12 px-2 py-1 border border-gray-300 rounded"
                      value="${task.type}" placeholder="Typ">
                    <input type="text" class="task-desc flex-1 px-2 py-1 border border-gray-300 rounded"
                      value="${task.description}" placeholder="Beschreibung">
                    <button class="remove-task-btn text-red-500 hover:text-red-700 px-2" data-index="${idx}">✕</button>
                  </div>
                `).join('') : '<p class="text-sm text-gray-500">Keine Aufgaben</p>'}
              </div>
              <button id="add-task-to-entry" class="text-sm text-blue-500 hover:text-blue-700">+ Aufgabe hinzufügen</button>
            </div>
          </div>

          <div class="flex gap-2 mt-6">
            <button id="edit-save" class="flex-1 px-4 py-2 bg-primary text-gray-900 rounded-lg font-semibold">
              Speichern
            </button>
            <button id="edit-cancel" class="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg">
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
            <input type="text" class="task-type flex-none w-12 px-2 py-1 border border-gray-300 rounded"
              value="" placeholder="Typ">
            <input type="text" class="task-desc flex-1 px-2 py-1 border border-gray-300 rounded"
              value="" placeholder="Beschreibung">
            <button class="remove-task-btn text-red-500 hover:text-red-700 px-2" data-index="${newIndex}">✕</button>
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
            e.target.closest('.flex').remove();
            if (tasksList.querySelectorAll('.flex').length === 0) {
              tasksList.innerHTML = '<p class="text-sm text-gray-500">Keine Aufgaben</p>';
            }
          });
        });
      });

      // Remove task buttons
      document.querySelectorAll('.remove-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.target.closest('.flex').remove();
          const tasksList = document.getElementById('edit-tasks-list');
          if (tasksList.querySelectorAll('.flex').length === 0) {
            tasksList.innerHTML = '<p class="text-sm text-gray-500">Keine Aufgaben</p>';
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
