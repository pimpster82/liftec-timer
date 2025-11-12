// LIFTEC Timer - UI Module

class UI {
  constructor() {
    this.currentScreen = 'main';
    this.i18n = this.getI18N();
    this.settings = null;
  }

  // ===== Translations =====

  getI18N() {
    return {
      de: {
        appName: 'Zeiterfassung',
        noSession: 'Keine aktive Sitzung',
        running: 'Läuft seit',
        duration: 'Dauer',
        start: 'Start',
        end: 'Ende',
        travelTime: 'Fahrtzeit',
        surcharge: 'Zuschlag',
        tasks: 'Aufgaben',
        addTask: 'Aufgabe hinzufügen',
        endSession: 'Beenden',
        settings: 'Einstellungen',
        goodMorning: 'Guten Morgen',
        goodAfternoon: 'Guten Tag',
        goodEvening: 'Guten Abend',
        monthExport: 'Monatsübersicht senden',
        auto: 'Automatisch',
        enterMonth: 'Monat eingeben',
        cancel: 'Abbrechen',
        startSession: 'Sitzung starten',
        save: 'Speichern',
        description: 'Beschreibung',
        language: 'Sprache',
        german: 'Deutsch',
        english: 'English',
        croatian: 'Kroatisch',
        emailAddress: 'E-Mail-Adresse',
        subject: 'Betreff',
        message: 'Nachricht',
        back: 'Zurück',
        sessionSummary: 'Tages Zusammenfassung',
        date: 'Datum',
        pause: 'Pause',
        netWorkTime: 'Arbeitszeit netto',
        taskType: 'Aufgabentyp',
        close: 'Schließen',
        menu: 'Menü',
        profile: 'Profil',
        workTime: 'Arbeitszeit',
        emailExport: 'per E-Mail schicken',
        recordings: 'Aufzeichnungen',
        noTasks: 'Noch keine Aufgaben',
        noRecordings: 'Noch keine Aufzeichnungen vorhanden',
        noEntries: 'Keine Einträge gefunden',
        name: 'Name',
        editType: 'Aufgabentyp ändern',
        editDescription: 'Beschreibung ändern',
        delete: 'Löschen',
        error: 'Fehler',
        invalidFormat: 'Ungültiges Format',
        noEmailSet: 'Bitte E-Mail in Einstellungen angeben',
        exportSuccess: 'Export erfolgreich',
        sendEmail: 'Per E-Mail senden',
        previewShare: 'Vorschau/Teilen',
        done: 'Fertig',
        mailError: 'Mail Fehler',
        shareFailed: 'Teilen fehlgeschlagen',
        entryFrom: 'Eintrag vom',
        activities: 'Tätigkeiten',
        none: 'Keine',
        tasksCount: 'Aufgaben ({count})',
        andMore: '... und {count} weitere',
        download: 'Herunterladen'
      },
      en: {
        appName: 'Time Tracking',
        noSession: 'No active session',
        running: 'Running since',
        duration: 'Duration',
        start: 'Start',
        end: 'End',
        travelTime: 'Travel time',
        surcharge: 'Surcharge',
        tasks: 'Tasks',
        addTask: 'Add task',
        endSession: 'End Session',
        settings: 'Settings',
        goodMorning: 'Good morning',
        goodAfternoon: 'Good afternoon',
        goodEvening: 'Good evening',
        monthExport: 'Monthly export',
        auto: 'Automatic',
        enterMonth: 'Enter month',
        cancel: 'Cancel',
        startSession: 'Start session',
        save: 'Save',
        description: 'Description',
        language: 'Language',
        german: 'German',
        english: 'English',
        croatian: 'Croatian',
        emailAddress: 'Email address',
        subject: 'Subject',
        message: 'Message',
        back: 'Back',
        sessionSummary: 'Session Summary',
        date: 'Date',
        pause: 'Pause',
        netWorkTime: 'Net work time',
        taskType: 'Task Type',
        close: 'Close',
        menu: 'Menu',
        profile: 'Profile',
        workTime: 'Work Time',
        emailExport: 'Email Export',
        recordings: 'Recordings',
        noTasks: 'No tasks yet',
        noRecordings: 'No recordings available',
        noEntries: 'No entries found',
        name: 'Name',
        editType: 'Change Type',
        editDescription: 'Change Description',
        delete: 'Delete',
        error: 'Error',
        invalidFormat: 'Invalid Format',
        noEmailSet: 'Please set email in settings',
        exportSuccess: 'Export successful',
        sendEmail: 'Send via Email',
        previewShare: 'Preview/Share',
        done: 'Done',
        mailError: 'Email Error',
        shareFailed: 'Sharing Failed',
        entryFrom: 'Entry from',
        activities: 'Activities',
        none: 'None',
        tasksCount: 'Tasks ({count})',
        andMore: '... and {count} more',
        download: 'Download'
      }
    };
  }

  t(key) {
    const lang = this.settings?.language || 'de';
    return this.i18n[lang]?.[key] || this.i18n.de[key] || key;
  }

  // ===== Utility Functions =====

  pad2(n) {
    return String(n).padStart(2, '0');
  }

  formatTime(date) {
    return `${this.pad2(date.getHours())}:${this.pad2(date.getMinutes())}`;
  }

  formatDate(date) {
    return `${this.pad2(date.getDate())}.${this.pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
  }

  formatDuration(startISO) {
    const start = new Date(startISO);
    const durMs = Date.now() - start.getTime();
    const hours = Math.floor(durMs / 3600000);
    const mins = Math.floor((durMs % 3600000) / 60000);
    return `${this.pad2(hours)}:${this.pad2(mins)}`;
  }

  hoursToHHMM(hours) {
    const totalMins = Math.round(hours * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${this.pad2(h)}:${this.pad2(m)}`;
  }

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return this.t('goodMorning');
    if (hour < 18) return this.t('goodAfternoon');
    return this.t('goodEvening');
  }

  // ===== Toast Notifications =====

  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const bgColor = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500'
    }[type] || 'bg-gray-800';

    toast.className = `toast ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ===== Modal Functions =====

  showModal(content) {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');

    modalContent.innerHTML = content;
    overlay.classList.remove('hidden');
    overlay.classList.add('modal-backdrop');
  }

  hideModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
  }

  // ===== Hero Card =====

  createHeroCard(session) {
    const greeting = this.getGreeting();
    const username = this.settings?.username || 'Benutzer';

    let durationHTML = '';
    if (session) {
      const duration = this.formatDuration(session.start);
      durationHTML = `
        <div class="mt-4 bg-black bg-opacity-10 rounded-lg p-3">
          <p class="text-xs text-gray-800 uppercase tracking-wide mb-1">${this.t('duration')}</p>
          <p class="text-3xl font-bold text-gray-900 duration">${duration}</p>
        </div>
      `;
    }

    return `
      <div class="hero-card rounded-xl p-5 ${session ? 'h-44' : 'h-36'} text-gray-900">
        <div class="flex items-center space-x-3 mb-4">
          <div class="w-10 h-10 bg-white bg-opacity-20 rounded-lg"></div>
          <div>
            <p class="text-sm opacity-70">${greeting}</p>
            <h2 class="text-xl font-bold">${username}</h2>
          </div>
        </div>
        ${durationHTML}
      </div>
    `;
  }

  // ===== Screen Navigation =====

  showScreen(screenName) {
    // Hide all screens
    const screens = ['main-screen', 'settings-screen', 'history-screen', 'about-screen'];
    screens.forEach(screen => {
      document.getElementById(screen).classList.add('hidden');
    });

    // Show requested screen
    document.getElementById(`${screenName}-screen`).classList.remove('hidden');
    this.currentScreen = screenName;
  }

  // ===== Loading State =====

  showLoading() {
    document.getElementById('loading-screen').classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('loading-screen').classList.add('hidden');
  }
}

// Create singleton instance
const ui = new UI();
