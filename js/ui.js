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
        download: 'Herunterladen',
        downloaded: 'Heruntergeladen',
        importCSV: 'CSV importieren',
        selectFile: 'Datei auswählen',
        importSuccess: 'Import erfolgreich',
        entriesImported: '{count} Einträge importiert',
        importError: 'Import fehlgeschlagen',
        noFileSelected: 'Keine Datei ausgewählt',
        // Onboarding
        onboardingWelcome: 'Willkommen bei LIFTEC Timer!',
        onboardingStep: 'Schritt {current} von {total}',
        onboardingNameTitle: 'Wie heißt du?',
        onboardingNameDesc: 'Dein Name wird in Exporten und Berichten verwendet.',
        onboardingNamePlaceholder: 'Name eingeben',
        onboardingLanguageTitle: 'Sprache wählen',
        onboardingLanguageDesc: 'Wähle deine bevorzugte App-Sprache.',
        onboardingSurchargeTitle: 'Schmutzzulage',
        onboardingSurchargeDesc: 'Unser Vorschlag: 80% der Arbeitszeit. Du kannst dies jederzeit in den Einstellungen ändern.',
        onboardingSurchargePlaceholder: 'z.B. 80%',
        onboardingEmailTitle: 'Email für Export',
        onboardingEmailDesc: 'Wohin sollen deine Arbeitszeiten geschickt werden? (Firmen - E-Mail, oder wohin du sonst möchtest)',
        onboardingEmailPlaceholder: 'email@beispiel.de',
        onboardingNext: 'Weiter',
        onboardingFinish: 'App nutzen',
        onboardingRequired: 'Dieses Feld ist erforderlich',
        onboardingSummaryTitle: 'Deine Einstellungen:',
        onboardingSummaryName: 'Name:',
        onboardingSummaryLanguage: 'Sprache:',
        onboardingSummarySurcharge: 'Schmutzzulage:',
        onboardingSummaryEmail: 'Export Email:',
        onboardingSummaryNotSet: 'Nicht gesetzt',
        onboardingSummaryNote: 'Du kannst alle Einstellungen jederzeit im Menü ändern.',
        onboardingSummaryBack: 'Zurück',
        onboardingSummaryConfirm: 'App starten',
        // Backup & Data Management
        backupTitle: 'Backups & Datenverwaltung',
        backupDescription: 'Sichere deine Arbeitszeiten lokal oder lösche alle Daten',
        deleteAllData: 'Alle Daten löschen',
        deleteAllDataDescription: 'Alle Arbeitszeiteinträge löschen und ein automatisches Backup erstellen',
        backupsList: 'Deine Backups',
        noBackups: 'Noch keine Backups erstellt',
        backupDate: 'Datum:',
        backupEntries: 'Einträge:',
        backupSize: 'Einträge gespeichert',
        restoreBackup: 'Wiederherstellen',
        deleteBackup: 'Löschen',
        shareBackup: 'Teilen',
        confirmDelete: 'Wirklich löschen?',
        confirmDeleteMessage: 'Dies kann nicht rückgängig gemacht werden!',
        deleteAllDataWarning: '⚠️ Alle Arbeitszeitdaten werden gelöscht!',
        deleteAllDataInfo: 'Zuerst wird automatisch ein Backup erstellt und lokal gespeichert.',
        deleteAllDataConfirm: 'Sind Sie sicher?',
        deleteAllDataFinal: 'Alle {count} Einträge wirklich löschen? Dies kann nicht rückgängig gemacht werden!',
        backupCreated: '✓ Backup erstellt: {count} Einträge',
        backupCreatedLocal: 'Backup wurde lokal gespeichert',
        dataDeleted: '✓ Alle Daten gelöscht. Neuer Start!',
        restoreSuccess: '✓ Backup wiederhergestellt: {count} Einträge',
        backupShareSubject: 'Backup - Arbeitszeiten {name}',
        backupShareBody: 'Mein Arbeitszeiten-Backup vom {date}',
        // On-Call (Bereitschaft)
        onCall: 'Bereitschaft',
        onCallEnabled: 'Bereitschaft aktiviert',
        onCallStart: 'Bereitschaft starten',
        onCallEnd: 'Bereitschaft beenden',
        onCallStartFrom: 'Bereitschaft ab wann?',
        onCallEndAt: 'Bereitschaft endet wann?',
        onCallActive: 'Bereitschaft aktiv',
        onCallEnded: 'Bereitschaft beendet',
        onCallTime: 'Bereitschaftszeit',
        onCallSummary: 'Bereitschaft: {start} bis {end}',
        onCallTotal: 'Insgesamt: {hours}'
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
        download: 'Download',
        downloaded: 'Downloaded',
        importCSV: 'Import CSV',
        selectFile: 'Select file',
        importSuccess: 'Import successful',
        entriesImported: '{count} entries imported',
        importError: 'Import failed',
        noFileSelected: 'No file selected',
        // Onboarding
        onboardingWelcome: 'Welcome to LIFTEC Timer!',
        onboardingStep: 'Step {current} of {total}',
        onboardingNameTitle: 'What\'s your name?',
        onboardingNameDesc: 'Your name will be used in exports and reports.',
        onboardingNamePlaceholder: 'Enter your name',
        onboardingLanguageTitle: 'Choose your language',
        onboardingLanguageDesc: 'Select your preferred app language.',
        onboardingSurchargeTitle: 'Dirt Allowance',
        onboardingSurchargeDesc: 'Our suggestion: 80% of your work time. You can change this anytime in Settings.',
        onboardingSurchargePlaceholder: 'e.g. 80%',
        onboardingEmailTitle: 'Email for export',
        onboardingEmailDesc: 'Where should your work hours be sent? (Company, email, or wherever you prefer)',
        onboardingEmailPlaceholder: 'email@example.com',
        onboardingNext: 'Next',
        onboardingFinish: 'Start using app',
        onboardingRequired: 'This field is required',
        onboardingSummaryTitle: 'Your settings:',
        onboardingSummaryName: 'Name:',
        onboardingSummaryLanguage: 'Language:',
        onboardingSummarySurcharge: 'Dirt Allowance:',
        onboardingSummaryEmail: 'Export Email:',
        onboardingSummaryNotSet: 'Not set',
        onboardingSummaryNote: 'You can change all settings anytime in the menu.',
        onboardingSummaryBack: 'Back',
        onboardingSummaryConfirm: 'Start app',
        // Backup & Data Management
        backupTitle: 'Backups & Data Management',
        backupDescription: 'Backup your work hours locally or delete all data',
        deleteAllData: 'Delete All Data',
        deleteAllDataDescription: 'Delete all work hour entries and create an automatic backup',
        backupsList: 'Your Backups',
        noBackups: 'No backups created yet',
        backupDate: 'Date:',
        backupEntries: 'Entries:',
        backupSize: 'entries saved',
        restoreBackup: 'Restore',
        deleteBackup: 'Delete',
        shareBackup: 'Share',
        confirmDelete: 'Really delete?',
        confirmDeleteMessage: 'This cannot be undone!',
        deleteAllDataWarning: '⚠️ All work hour data will be deleted!',
        deleteAllDataInfo: 'An automatic backup will be created and stored locally first.',
        deleteAllDataConfirm: 'Are you sure?',
        deleteAllDataFinal: 'Really delete all {count} entries? This cannot be undone!',
        backupCreated: '✓ Backup created: {count} entries',
        backupCreatedLocal: 'Backup was saved locally',
        dataDeleted: '✓ All data deleted. Fresh start!',
        restoreSuccess: '✓ Backup restored: {count} entries',
        backupShareSubject: 'Backup - Work Hours {name}',
        backupShareBody: 'My work hours backup from {date}',
        // On-Call (Bereitschaft)
        onCall: 'On-Call',
        onCallEnabled: 'On-Call Enabled',
        onCallStart: 'Start On-Call',
        onCallEnd: 'End On-Call',
        onCallStartFrom: 'On-Call from when?',
        onCallEndAt: 'On-Call ends when?',
        onCallActive: 'On-Call active',
        onCallEnded: 'On-Call ended',
        onCallTime: 'On-Call Time',
        onCallSummary: 'On-Call: {start} to {end}',
        onCallTotal: 'Total: {hours}'
      },
      hr: {
        appName: 'Evidencija vremena',
        noSession: 'Nema aktivne sesije',
        running: 'Traje od',
        duration: 'Trajanje',
        start: 'Početak',
        end: 'Kraj',
        travelTime: 'Vrijeme putovanja',
        surcharge: 'Prirez',
        tasks: 'Zadaci',
        addTask: 'Dodaj zadatak',
        endSession: 'Završi',
        settings: 'Postavke',
        goodMorning: 'Dobro jutro',
        goodAfternoon: 'Dobar dan',
        goodEvening: 'Dobra večer',
        monthExport: 'Izvoz mjeseca',
        auto: 'Automatski',
        enterMonth: 'Unesi mjesec',
        cancel: 'Odustani',
        startSession: 'Pokreni sesiju',
        save: 'Spremi',
        description: 'Opis',
        language: 'Jezik',
        german: 'Njemački',
        english: 'Engleski',
        croatian: 'Hrvatski',
        emailAddress: 'Email adresa',
        subject: 'Naslov',
        message: 'Poruka',
        back: 'Natrag',
        sessionSummary: 'Sažetak dana',
        date: 'Datum',
        pause: 'Pauza',
        netWorkTime: 'Neto radno vrijeme',
        taskType: 'Tip zadatka',
        close: 'Zatvori',
        menu: 'Izbornik',
        profile: 'Profil',
        workTime: 'Radno vrijeme',
        emailExport: 'Pošalji emailom',
        recordings: 'Zapisi',
        noTasks: 'Još nema zadataka',
        noRecordings: 'Nema dostupnih zapisa',
        noEntries: 'Nema pronađenih unosa',
        name: 'Ime',
        editType: 'Promijeni tip',
        editDescription: 'Promijeni opis',
        delete: 'Izbriši',
        error: 'Greška',
        invalidFormat: 'Neispravan format',
        noEmailSet: 'Molimo postavite email u postavkama',
        exportSuccess: 'Izvoz uspješan',
        sendEmail: 'Pošalji emailom',
        previewShare: 'Pregled/Dijeli',
        done: 'Gotovo',
        mailError: 'Email greška',
        shareFailed: 'Dijeljenje nije uspjelo',
        entryFrom: 'Unos od',
        activities: 'Aktivnosti',
        none: 'Nema',
        tasksCount: 'Zadaci ({count})',
        andMore: '... i još {count}',
        download: 'Preuzmi',
        downloaded: 'Preuzeto',
        importCSV: 'Uvezi CSV',
        selectFile: 'Odaberi datoteku',
        importSuccess: 'Uvoz uspješan',
        entriesImported: '{count} unosa uvezeno',
        importError: 'Uvoz nije uspio',
        noFileSelected: 'Nije odabrana datoteka',
        // Onboarding
        onboardingWelcome: 'Dobrodošli u LIFTEC Timer!',
        onboardingStep: 'Korak {current} od {total}',
        onboardingNameTitle: 'Kako se zovete?',
        onboardingNameDesc: 'Vaše ime će se koristiti u izvozima i izvještajima.',
        onboardingNamePlaceholder: 'Unesite vaše ime',
        onboardingLanguageTitle: 'Odaberite jezik',
        onboardingLanguageDesc: 'Odaberite željeni jezik aplikacije.',
        onboardingSurchargeTitle: 'Prirez za prljavštinu',
        onboardingSurchargeDesc: 'Naš prijedlog: 80% vašeg radnog vremena. Možete to promijeniti bilo kada u Postavkama.',
        onboardingSurchargePlaceholder: 'npr. 80%',
        onboardingEmailTitle: 'Email za izvoz',
        onboardingEmailDesc: 'Gdje trebaju biti poslani vaši radni sati? (Tvrtka, email, ili gdje vam više odgovara)',
        onboardingEmailPlaceholder: 'email@primjer.hr',
        onboardingNext: 'Sljedeće',
        onboardingFinish: 'Počni koristiti aplikaciju',
        onboardingRequired: 'Ovo polje je obavezno',
        onboardingSummaryTitle: 'Vaše postavke:',
        onboardingSummaryName: 'Ime:',
        onboardingSummaryLanguage: 'Jezik:',
        onboardingSummarySurcharge: 'Prirez za prljavštinu:',
        onboardingSummaryEmail: 'Email za izvoz:',
        onboardingSummaryNotSet: 'Nije postavljeno',
        onboardingSummaryNote: 'Sve postavke možete promijeniti bilo kada u izborniku.',
        onboardingSummaryBack: 'Natrag',
        onboardingSummaryConfirm: 'Počni aplikaciju',
        // Backup & Data Management
        backupTitle: 'Sigurnosne kopije i upravljanje podacima',
        backupDescription: 'Sigurnosna kopija radnih sati ili brisanje svih podataka',
        deleteAllData: 'Obriši sve podatke',
        deleteAllDataDescription: 'Obriši sve unose radnih sati i kreiraj automatsku sigurnosnu kopiju',
        backupsList: 'Vaše sigurnosne kopije',
        noBackups: 'Nema kreiranih sigurnosnih kopija',
        backupDate: 'Datum:',
        backupEntries: 'Unosi:',
        backupSize: 'unosi spremljeni',
        restoreBackup: 'Vrati',
        deleteBackup: 'Obriši',
        shareBackup: 'Dijeli',
        confirmDelete: 'Sigurno obrisati?',
        confirmDeleteMessage: 'Ovo se ne može poništiti!',
        deleteAllDataWarning: '⚠️ Svi podaci radnih sati će biti obrisani!',
        deleteAllDataInfo: 'Prvo će se kreirati automatska sigurnosna kopija i lokalno spremiti.',
        deleteAllDataConfirm: 'Sigurni ste?',
        deleteAllDataFinal: 'Sigurno obrisati svih {count} unosa? Ovo se ne može poništiti!',
        backupCreated: '✓ Sigurnosna kopija kreirana: {count} unosa',
        backupCreatedLocal: 'Sigurnosna kopija je lokalno spremljena',
        dataDeleted: '✓ Svi podaci obrisani. Novi početak!',
        restoreSuccess: '✓ Sigurnosna kopija vraćena: {count} unosa',
        backupShareSubject: 'Sigurnosna kopija - Radni sati {name}',
        backupShareBody: 'Moja sigurnosna kopija radnih sati od {date}',
        // On-Call (Dežurstvo)
        onCall: 'Dežurstvo',
        onCallEnabled: 'Dežurstvo aktivirano',
        onCallStart: 'Počni dežurstvo',
        onCallEnd: 'Završi dežurstvo',
        onCallStartFrom: 'Dežurstvo od kada?',
        onCallEndAt: 'Dežurstvo završava kada?',
        onCallActive: 'Dežurstvo aktivno',
        onCallEnded: 'Dežurstvo završeno',
        onCallTime: 'Vrijeme dežurstva',
        onCallSummary: 'Dežurstvo: {start} do {end}',
        onCallTotal: 'Ukupno: {hours}'
      }
    };
  }

  t(key) {
    const lang = this.settings?.language || 'de';
    return this.i18n[lang]?.[key] || this.i18n.de[key] || key;
  }

  // ===== Icon Helper =====

  icon(name, className = 'icon') {
    const icons = {
      play: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      stop: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg>',
      plus: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>',
      settings: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>',
      upload: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>',
      download: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>',
      history: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>',
      info: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      menu: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/></svg>',
      edit: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
      trash: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>',
      mail: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>',
      folder: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>',
      file: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
      check: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>',
      x: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
      warning: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
      onCallOff: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>',
      onCallOn: '<svg class="' + className + '" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/><circle cx="19" cy="8" r="3" fill="currentColor"/></svg>',
      // Notes icons (v1.6.1)
      notepad: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
      circle: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="2"/></svg>',
      'check-circle': '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
      text: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"/></svg>',
      list: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>'
    };
    return icons[name] || '';
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

  createHeroCard(session, onCallStatus = null) {
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

    // On-call button HTML (only if enabled in settings)
    let onCallButtonHTML = '';
    if (this.settings?.onCallEnabled && onCallStatus) {
      const isActive = onCallStatus.active;
      const icon = isActive ? this.icon('onCallOn', 'w-5 h-5') : this.icon('onCallOff', 'w-5 h-5');
      const buttonClass = isActive
        ? 'bg-green-500 hover:bg-green-600'
        : 'bg-gray-500 hover:bg-gray-600';

      // Show period number badge if active
      const periodBadge = isActive && onCallStatus.id
        ? `<span class="absolute -top-1 -right-1 bg-white text-green-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-green-500">#${onCallStatus.id}</span>`
        : '';

      onCallButtonHTML = `
        <div class="relative inline-block">
          <button id="oncall-btn"
                  class="${buttonClass} text-white rounded-full p-2 transition-colors btn-press"
                  title="${isActive ? this.t('onCallEnd') : this.t('onCallStart')}">
            ${icon}
          </button>
          ${periodBadge}
        </div>
      `;
    }

    return `
      <div class="hero-card rounded-xl p-5 ${session ? 'h-44' : 'h-36'} text-gray-900">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center p-1.5">
              <svg viewBox="0 0 100 100" class="w-full h-full">
                <!-- Top bar -->
                <rect x="0" y="0" width="100" height="20" fill="white"/>
                <!-- Bottom bars -->
                <rect x="0" y="24" width="18" height="76" fill="white"/>
                <rect x="21" y="24" width="24" height="76" fill="white"/>
                <rect x="48" y="24" width="30" height="76" fill="white"/>
                <rect x="81" y="24" width="19" height="76" fill="white"/>
              </svg>
            </div>
            <div>
              <p class="text-sm opacity-70">${greeting}</p>
              <h2 class="text-xl font-bold">${username}</h2>
            </div>
          </div>
          ${onCallButtonHTML}
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
