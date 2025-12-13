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
        onCallTotal: 'Insgesamt: {hours}',
        // Calendar View
        startTime: 'Startzeit',
        clickToToggle: 'Zum Wechseln tippen',
        showCalendar: 'Kalender anzeigen',
        showList: 'Liste anzeigen',
        hasEntry: 'Mit Eintrag',
        weekend: 'Wochenende',
        holiday: 'Feiertag',
        today: 'Heute',
        monthNames: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
        // Share Entry Feature
        shareEntry: 'Teilen',
        shareEntryTitle: 'Eintrag teilen',
        shareEntryDesc: 'Zeiteintrag mit anderen teilen (WhatsApp, AirDrop, etc.)',
        importEntry: 'Eintrag importieren',
        importEntryDesc: 'Geteilten Zeiteintrag importieren',
        shareSuccess: 'Eintrag geteilt',
        entryImported: 'Eintrag importiert',
        duplicateWarning: 'Achtung: Eintrag für dieses Datum existiert bereits',
        overwrite: 'Überschreiben',
        keepBoth: 'Beide behalten',
        copyToClipboard: 'In Zwischenablage kopieren',
        copiedToClipboard: 'In Zwischenablage kopiert',
        // Cloud Share Feature
        shareToUser: 'An User senden',
        shareViaFile: 'Als Datei teilen',
        enterEmailOrNickname: 'E-Mail oder @nickname',
        userNotFound: 'User nicht gefunden',
        cannotShareWithYourself: 'Du kannst nicht mit dir selbst teilen',
        sharedWithUser: 'Mit {user} geteilt',
        newShares: 'Neue Teilungen',
        sharedEntriesTitle: 'Geteilte Einträge',
        sharedBy: 'Geteilt von',
        acceptShare: 'Übernehmen',
        declineShare: 'Ablehnen',
        noSharedEntries: 'Keine geteilten Einträge',
        shareDeclined: 'Eintrag abgelehnt',
        mustBeSignedIn: 'Du musst angemeldet sein um diese Funktion zu nutzen',
        signInToShareCloud: 'Melde dich an, um Einträge mit anderen Usern zu teilen',
        shareUserHint: 'Gib die E-Mail oder den @nickname des Empfängers ein',
        sharingEntry: 'Eintrag wird geteilt',
        send: 'Senden',
        searching: 'Suche...',
        tasks: 'Aufgaben',
        hasSharedEntries: 'Du hast neue geteilte Einträge',
        viewShares: 'Anzeigen',
        dismiss: 'Schließen',
        // QR Code & Friend System
        myQRCode: 'Mein QR-Code',
        qrCodeHint: 'Lass andere diesen QR-Code scannen, um dich als Friend hinzuzufügen',
        scanQRCode: 'QR-Code scannen',
        scannerHint: 'Richte die Kamera auf den QR-Code eines Friends',
        invalidQRCode: 'Ungültiger QR-Code',
        cameraError: 'Kamera-Zugriff fehlgeschlagen',
        addFriend: 'Friend hinzufügen',
        addFriendConfirm: 'Möchtest du diesen User als Friend hinzufügen?',
        friendAdded: '{nickname} als Friend hinzugefügt',
        createProfileFirst: 'Erstelle zuerst ein Share-Profil',
        friendHasNoProfile: 'Dieser User hat kein Share-Profil',
        myFriends: 'Meine Friends',
        noFriends: 'Noch keine Friends',
        removeFriend: 'Friend entfernen',
        removeFriendConfirm: 'Möchtest du {nickname} als Friend entfernen?',
        friendRemoved: 'Friend entfernt',
        createProfile: 'Profil erstellen',
        editProfile: 'Profil bearbeiten',
        nickname: 'Nickname',
        nicknameHint: 'Mind. 3 Zeichen, nur Kleinbuchstaben',
        nicknameCannotChange: 'Nickname kann nicht geändert werden',
        nicknameMinLength: 'Nickname muss mind. 3 Zeichen haben',
        displayName: 'Anzeigename',
        displayNameRequired: 'Anzeigename erforderlich',
        nicknameTaken: 'Dieser Nickname ist bereits vergeben',
        profileCreated: 'Profil erstellt',
        profileUpdated: 'Profil aktualisiert',
        shareToFriend: 'An Friend senden',
        selectFriend: 'Friend auswählen',
        selectOption: '-- Bitte wählen --',
        noFriendsToShare: 'Du hast noch keine Friends',
        selectFriendFirst: 'Bitte wähle einen Friend',
        sharing: 'Wird geteilt...',
        canOnlyShareWithFriends: 'Du kannst nur mit Friends teilen',
        // Work Time Tracking & Vacation (ZA & Urlaub)
        workTimeTracking: 'Arbeitszeitkonto & Urlaub',
        workTimeTrackingShort: 'ZA & Urlaub',
        enableWorkTimeTracking: 'ZA & Urlaub aktivieren',
        workTimeTrackingDesc: 'Verwalte dein Zeitkonto und deinen Urlaub',
        timeAccount: 'Zeitkonto',
        vacation: 'Urlaub',
        vacationDays: 'Urlaubstage',
        remainingVacation: 'Resturlaub',
        annualVacation: 'Jahresurlaub',
        targetHours: 'Sollstunden',
        actualHours: 'Iststunden',
        balance: 'Saldo',
        weeklyTarget: 'Wochensoll',
        dailyTarget: 'Tagessoll',
        monday: 'Montag',
        tuesday: 'Dienstag',
        wednesday: 'Mittwoch',
        thursday: 'Donnerstag',
        friday: 'Freitag',
        saturday: 'Samstag',
        sunday: 'Sonntag',
        hours: 'Stunden',
        hoursShort: 'h',
        days: 'Tage',
        // Onboarding for Work Time Tracking
        wttOnboardingTitle: 'Zeitkonto & Urlaub einrichten',
        wttOnboardingWelcome: 'Richte jetzt dein Zeitkonto und deine Urlaubsverwaltung ein.',
        wttOnboardingStep1Title: 'Sollzeiten festlegen',
        wttOnboardingStep1Desc: 'Wie viele Stunden arbeitest du normalerweise pro Tag?',
        wttOnboardingStep2Title: 'Zeitkonto & Urlaub',
        wttOnboardingStep2Desc: 'Aktueller Stand laut Lohnzettel',
        wttOnboardingStep3Title: 'Fertig!',
        wttOnboardingStep3Desc: 'Ab jetzt siehst du in der Historie dein Zeitkonto und deinen Resturlaub.',
        wttCurrentBalance: 'Zeitkonto aktuell',
        wttRemainingVacation: 'Resturlaub',
        wttAnnualVacation: 'Jahresurlaub',
        wttWeeklyTotal: 'Gesamt',
        wttPerWeek: 'pro Woche',
        // Entry types
        entryTypeWork: 'Arbeitstag',
        entryTypeVacation: 'Urlaub',
        entryTypeSick: 'Krankenstand',
        entryTypeHoliday: 'Feiertag',
        entryTypeUnpaid: 'Unbezahlter Urlaub',
        // Balance display
        weekBalance: 'Wochensaldo',
        monthBalance: 'Monatssaldo',
        totalBalance: 'Zeitkonto gesamt',
        target: 'Soll',
        actual: 'Ist',
        // Manual adjustment
        adjustTimeAccount: 'Zeitkonto anpassen',
        adjustmentReason: 'Grund der Anpassung',
        currentCalculated: 'Berechnet',
        accordingToPayroll: 'Laut Lohnzettel',
        difference: 'Differenz',
        adjust: 'Anpassen',
        adjustmentSaved: 'Zeitkonto angepasst'
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
        onCallTotal: 'Total: {hours}',
        // Calendar View
        startTime: 'Start Time',
        clickToToggle: 'Click to toggle',
        showCalendar: 'Show Calendar',
        showList: 'Show List',
        hasEntry: 'Has Entry',
        weekend: 'Weekend',
        holiday: 'Public Holiday',
        today: 'Today',
        monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        // Share Entry Feature
        shareEntry: 'Share',
        shareEntryTitle: 'Share entry',
        shareEntryDesc: 'Share time entry with others (WhatsApp, AirDrop, etc.)',
        importEntry: 'Import entry',
        importEntryDesc: 'Import shared time entry',
        shareSuccess: 'Entry shared',
        entryImported: 'Entry imported',
        duplicateWarning: 'Warning: Entry for this date already exists',
        overwrite: 'Overwrite',
        keepBoth: 'Keep both',
        copyToClipboard: 'Copy to clipboard',
        copiedToClipboard: 'Copied to clipboard',
        // Cloud Share Feature
        shareToUser: 'Send to user',
        shareViaFile: 'Share as file',
        enterEmailOrNickname: 'Email or @nickname',
        userNotFound: 'User not found',
        cannotShareWithYourself: 'Cannot share with yourself',
        sharedWithUser: 'Shared with {user}',
        newShares: 'New shares',
        sharedEntriesTitle: 'Shared entries',
        sharedBy: 'Shared by',
        acceptShare: 'Accept',
        declineShare: 'Decline',
        noSharedEntries: 'No shared entries',
        shareDeclined: 'Entry declined',
        mustBeSignedIn: 'You must be signed in to use this feature',
        signInToShareCloud: 'Sign in to share entries with other users',
        shareUserHint: 'Enter the recipient\'s email or @nickname',
        sharingEntry: 'Sharing entry',
        send: 'Send',
        searching: 'Searching...',
        tasks: 'Tasks',
        hasSharedEntries: 'You have new shared entries',
        viewShares: 'View',
        dismiss: 'Dismiss',
        // QR Code & Friend System
        myQRCode: 'My QR Code',
        qrCodeHint: 'Let others scan this QR code to add you as a friend',
        scanQRCode: 'Scan QR Code',
        scannerHint: 'Point the camera at a friend\'s QR code',
        invalidQRCode: 'Invalid QR code',
        cameraError: 'Camera access failed',
        addFriend: 'Add friend',
        addFriendConfirm: 'Do you want to add this user as a friend?',
        friendAdded: '{nickname} added as friend',
        createProfileFirst: 'Create a share profile first',
        friendHasNoProfile: 'This user has no share profile',
        myFriends: 'My Friends',
        noFriends: 'No friends yet',
        removeFriend: 'Remove friend',
        removeFriendConfirm: 'Do you want to remove {nickname} as a friend?',
        friendRemoved: 'Friend removed',
        createProfile: 'Create profile',
        editProfile: 'Edit profile',
        nickname: 'Nickname',
        nicknameHint: 'Min. 3 characters, lowercase only',
        nicknameCannotChange: 'Nickname cannot be changed',
        nicknameMinLength: 'Nickname must have at least 3 characters',
        displayName: 'Display name',
        displayNameRequired: 'Display name required',
        nicknameTaken: 'This nickname is already taken',
        profileCreated: 'Profile created',
        profileUpdated: 'Profile updated',
        shareToFriend: 'Send to friend',
        selectFriend: 'Select friend',
        selectOption: '-- Please select --',
        noFriendsToShare: 'You have no friends yet',
        selectFriendFirst: 'Please select a friend',
        sharing: 'Sharing...',
        canOnlyShareWithFriends: 'You can only share with friends',
        // Work Time Tracking & Vacation (ZA & Urlaub)
        workTimeTracking: 'Time Account & Vacation',
        workTimeTrackingShort: 'Time & Vacation',
        enableWorkTimeTracking: 'Enable Time & Vacation',
        workTimeTrackingDesc: 'Manage your time account and vacation',
        timeAccount: 'Time Account',
        vacation: 'Vacation',
        vacationDays: 'Vacation Days',
        remainingVacation: 'Remaining Vacation',
        annualVacation: 'Annual Vacation',
        targetHours: 'Target Hours',
        actualHours: 'Actual Hours',
        balance: 'Balance',
        weeklyTarget: 'Weekly Target',
        dailyTarget: 'Daily Target',
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
        sunday: 'Sunday',
        hours: 'Hours',
        hoursShort: 'h',
        days: 'Days',
        // Onboarding for Work Time Tracking
        wttOnboardingTitle: 'Set up Time Account & Vacation',
        wttOnboardingWelcome: 'Set up your time account and vacation tracking now.',
        wttOnboardingStep1Title: 'Set target hours',
        wttOnboardingStep1Desc: 'How many hours do you normally work per day?',
        wttOnboardingStep2Title: 'Time Account & Vacation',
        wttOnboardingStep2Desc: 'Current status according to payroll',
        wttOnboardingStep3Title: 'Done!',
        wttOnboardingStep3Desc: 'From now on, you will see your time account and remaining vacation in the history.',
        wttCurrentBalance: 'Current Time Account',
        wttRemainingVacation: 'Remaining Vacation',
        wttAnnualVacation: 'Annual Vacation',
        wttWeeklyTotal: 'Total',
        wttPerWeek: 'per week',
        // Entry types
        entryTypeWork: 'Work Day',
        entryTypeVacation: 'Vacation',
        entryTypeSick: 'Sick Leave',
        entryTypeHoliday: 'Public Holiday',
        entryTypeUnpaid: 'Unpaid Leave',
        // Balance display
        weekBalance: 'Week Balance',
        monthBalance: 'Month Balance',
        totalBalance: 'Total Time Account',
        target: 'Target',
        actual: 'Actual',
        // Manual adjustment
        adjustTimeAccount: 'Adjust Time Account',
        adjustmentReason: 'Reason for adjustment',
        currentCalculated: 'Calculated',
        accordingToPayroll: 'According to payroll',
        difference: 'Difference',
        adjust: 'Adjust',
        adjustmentSaved: 'Time account adjusted'
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
        onCallTotal: 'Ukupno: {hours}',
        // Calendar View
        startTime: 'Početak vremena',
        clickToToggle: 'Kliknite za promjenu',
        showCalendar: 'Prikaži kalendar',
        showList: 'Prikaži listu',
        hasEntry: 'Sa unosom',
        weekend: 'Vikend',
        holiday: 'Praznik',
        today: 'Danas',
        monthNames: ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'],
        // Share Entry Feature
        shareEntry: 'Dijeli',
        shareEntryTitle: 'Dijeli unos',
        shareEntryDesc: 'Dijeli unos vremena s drugima (WhatsApp, AirDrop, itd.)',
        importEntry: 'Uvezi unos',
        importEntryDesc: 'Uvezi dijeljeni unos vremena',
        shareSuccess: 'Unos podijeljen',
        entryImported: 'Unos uvezen',
        duplicateWarning: 'Upozorenje: Unos za ovaj datum već postoji',
        overwrite: 'Prepiši',
        keepBoth: 'Zadrži oba',
        copyToClipboard: 'Kopiraj u međuspremnik',
        copiedToClipboard: 'Kopirano u međuspremnik',
        // Cloud Share Feature
        shareToUser: 'Pošalji korisniku',
        shareViaFile: 'Dijeli kao datoteku',
        enterEmailOrNickname: 'Email ili @nadimak',
        userNotFound: 'Korisnik nije pronađen',
        cannotShareWithYourself: 'Ne možete dijeliti sa sobom',
        sharedWithUser: 'Podijeljeno s {user}',
        newShares: 'Nova dijeljenja',
        sharedEntriesTitle: 'Podijeljeni unosi',
        sharedBy: 'Podijelio',
        acceptShare: 'Prihvati',
        declineShare: 'Odbij',
        noSharedEntries: 'Nema podijeljenih unosa',
        shareDeclined: 'Unos odbijen',
        mustBeSignedIn: 'Morate biti prijavljeni da koristite ovu funkciju',
        signInToShareCloud: 'Prijavite se za dijeljenje unosa s drugim korisnicima',
        shareUserHint: 'Unesite email ili @nadimak primatelja',
        sharingEntry: 'Dijeljenje unosa',
        send: 'Pošalji',
        searching: 'Tražim...',
        tasks: 'Zadaci',
        hasSharedEntries: 'Imate nove podijeljene unose',
        viewShares: 'Prikaži',
        dismiss: 'Zatvori',
        // QR Code & Friend System
        myQRCode: 'Moj QR kod',
        qrCodeHint: 'Neka drugi skeniraju ovaj QR kod da te dodaju kao prijatelja',
        scanQRCode: 'Skeniraj QR kod',
        scannerHint: 'Usmjeri kameru na QR kod prijatelja',
        invalidQRCode: 'Neispravan QR kod',
        cameraError: 'Pristup kameri nije uspio',
        addFriend: 'Dodaj prijatelja',
        addFriendConfirm: 'Želiš li dodati ovog korisnika kao prijatelja?',
        friendAdded: '{nickname} dodan kao prijatelj',
        createProfileFirst: 'Prvo kreiraj profil za dijeljenje',
        friendHasNoProfile: 'Ovaj korisnik nema profil za dijeljenje',
        myFriends: 'Moji prijatelji',
        noFriends: 'Još nemaš prijatelja',
        removeFriend: 'Ukloni prijatelja',
        removeFriendConfirm: 'Želiš li ukloniti {nickname} kao prijatelja?',
        friendRemoved: 'Prijatelj uklonjen',
        createProfile: 'Kreiraj profil',
        editProfile: 'Uredi profil',
        nickname: 'Nadimak',
        nicknameHint: 'Min. 3 znaka, samo mala slova',
        nicknameCannotChange: 'Nadimak se ne može promijeniti',
        nicknameMinLength: 'Nadimak mora imati najmanje 3 znaka',
        displayName: 'Ime za prikaz',
        displayNameRequired: 'Ime za prikaz je obavezno',
        nicknameTaken: 'Ovaj nadimak je već zauzet',
        profileCreated: 'Profil kreiran',
        profileUpdated: 'Profil ažuriran',
        shareToFriend: 'Pošalji prijatelju',
        selectFriend: 'Odaberi prijatelja',
        selectOption: '-- Molimo odaberite --',
        noFriendsToShare: 'Još nemaš prijatelja',
        selectFriendFirst: 'Molimo odaberi prijatelja',
        sharing: 'Dijeljenje...',
        canOnlyShareWithFriends: 'Možeš dijeliti samo s prijateljima',
        // Work Time Tracking & Vacation (ZA & Urlaub)
        workTimeTracking: 'Radni sat i godišnji odmor',
        workTimeTrackingShort: 'Radni sat & Odmor',
        enableWorkTimeTracking: 'Aktiviraj radni sat i odmor',
        workTimeTrackingDesc: 'Upravljaj svojim radnim satima i godišnjim odmorom',
        timeAccount: 'Račun radnih sati',
        vacation: 'Godišnji odmor',
        vacationDays: 'Dani godišnjeg odmora',
        remainingVacation: 'Preostali odmor',
        annualVacation: 'Godišnji odmor',
        targetHours: 'Ciljani sati',
        actualHours: 'Stvarni sati',
        balance: 'Saldo',
        weeklyTarget: 'Tjedni cilj',
        dailyTarget: 'Dnevni cilj',
        monday: 'Ponedjeljak',
        tuesday: 'Utorak',
        wednesday: 'Srijeda',
        thursday: 'Četvrtak',
        friday: 'Petak',
        saturday: 'Subota',
        sunday: 'Nedjelja',
        hours: 'Sati',
        hoursShort: 'h',
        days: 'Dani',
        // Onboarding for Work Time Tracking
        wttOnboardingTitle: 'Postavi radni sat i odmor',
        wttOnboardingWelcome: 'Postavi svoj račun radnih sati i praćenje godišnjeg odmora sada.',
        wttOnboardingStep1Title: 'Postavi ciljane sate',
        wttOnboardingStep1Desc: 'Koliko sati normalno radiš dnevno?',
        wttOnboardingStep2Title: 'Radni sat i odmor',
        wttOnboardingStep2Desc: 'Trenutno stanje prema platnoj listi',
        wttOnboardingStep3Title: 'Gotovo!',
        wttOnboardingStep3Desc: 'Od sada ćeš vidjeti svoj račun radnih sati i preostali odmor u povijesti.',
        wttCurrentBalance: 'Trenutni račun radnih sati',
        wttRemainingVacation: 'Preostali odmor',
        wttAnnualVacation: 'Godišnji odmor',
        wttWeeklyTotal: 'Ukupno',
        wttPerWeek: 'tjedno',
        // Entry types
        entryTypeWork: 'Radni dan',
        entryTypeVacation: 'Godišnji odmor',
        entryTypeSick: 'Bolovanje',
        entryTypeHoliday: 'Praznik',
        entryTypeUnpaid: 'Neplaćeni dopust',
        // Balance display
        weekBalance: 'Tjedni saldo',
        monthBalance: 'Mjesečni saldo',
        totalBalance: 'Ukupni račun radnih sati',
        target: 'Cilj',
        actual: 'Stvarno',
        // Manual adjustment
        adjustTimeAccount: 'Prilagodi račun radnih sati',
        adjustmentReason: 'Razlog prilagodbe',
        currentCalculated: 'Izračunato',
        accordingToPayroll: 'Prema platnoj listi',
        difference: 'Razlika',
        adjust: 'Prilagodi',
        adjustmentSaved: 'Račun radnih sati prilagođen'
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
      list: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>',
      // Calendar View icons (v1.7.3)
      calendar: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>',
      'chevron-left': '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>',
      'chevron-right': '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>',
      'chevron-down': '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>',
      cloud: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-4"/></svg>',
      share: '<svg class="' + className + '" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>'
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

  formatStartTime(startISO) {
    const start = new Date(startISO);
    const hours = start.getHours();
    const mins = start.getMinutes();
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

  /**
   * Shows modal with sticky header (and optional sticky footer)
   * @param {Object} config - Configuration object
   * @param {string} config.title - Modal title
   * @param {string} config.icon - Icon name from ui.icon()
   * @param {string} config.content - HTML content for scrollable body
   * @param {string} config.footer - Optional HTML for sticky footer
   * @param {Function} config.onClose - Optional callback when X is clicked
   * @param {boolean} config.hasChanges - Optional function to check if there are unsaved changes
   */
  showModalWithHeader(config) {
    const { title, icon, content, footer, onClose, hasChanges } = config;

    const iconHtml = icon ? this.icon(icon) : '';
    const footerHtml = footer ? `
      <div class="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        ${footer}
      </div>
    ` : '';

    const modalHtml = `
      <div class="flex flex-col max-h-[80vh]">
        <!-- Sticky Header -->
        <div class="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            ${iconHtml}
            <span>${title}</span>
          </h3>
          <button id="modal-close-x" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors" title="${this.t('close')}">
            ${this.icon('x')}
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="overflow-y-auto px-6 py-4 flex-1">
          ${content}
        </div>

        <!-- Optional Sticky Footer -->
        ${footerHtml}
      </div>
    `;

    this.showModal(modalHtml);

    // Attach close handler
    const closeBtn = document.getElementById('modal-close-x');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (onClose) {
          onClose();
        } else {
          this.hideModal();
        }
      });
    }
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
      // Check if we should show duration or start time
      const showStartTime = this.settings?.heroTimeDisplay === 'startTime';
      const timeValue = showStartTime
        ? this.formatStartTime(session.start)
        : this.formatDuration(session.start);
      const timeLabel = showStartTime ? this.t('startTime') : this.t('duration');

      durationHTML = `
        <div id="hero-time-display" class="mt-4 bg-black bg-opacity-10 rounded-lg p-3 cursor-pointer hover:bg-opacity-20 transition-colors" title="${this.t('clickToToggle')}">
          <p class="text-xs text-gray-800 uppercase tracking-wide mb-1">${timeLabel}</p>
          <p class="text-3xl font-bold text-gray-900 duration">${timeValue}</p>
        </div>
      `;
    }

    // Top-right buttons (on-call and calendar)
    let topRightButtonsHTML = '';
    let buttons = [];

    // On-call button (only if enabled in settings)
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

      buttons.push(`
        <div class="relative inline-block">
          <button id="oncall-btn"
                  class="${buttonClass} text-white rounded-full p-2 transition-colors btn-press"
                  title="${isActive ? this.t('onCallEnd') : this.t('onCallStart')}">
            ${icon}
          </button>
          ${periodBadge}
        </div>
      `);
    }

    // Calendar button (always visible)
    buttons.push(`
      <button id="hero-calendar-btn"
              class="bg-white bg-opacity-30 hover:bg-opacity-50 text-gray-900 rounded-full p-3 transition-colors btn-press shadow-sm"
              title="${this.t('showCalendar')}">
        ${this.icon('calendar', 'w-6 h-6')}
      </button>
    `);

    if (buttons.length > 0) {
      topRightButtonsHTML = `<div class="flex gap-2">${buttons.join('')}</div>`;
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
          ${topRightButtonsHTML}
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
