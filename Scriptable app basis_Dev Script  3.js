// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: magic;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: magic;
// LIFTEC TIMER - Time Tracking App
// Version: 1.0.0

const COLORS = {
  // Primary LIFTEC Yellow/Gold
  primary: new Color("#FFB300"),
  primaryDark: new Color("#FFA000"),
  primaryLight: new Color("#FFC107"),
  
  // Semantic Colors
  success: new Color("#4CAF50"),
  warning: new Color("#FF6B35"),
  danger: new Color("#F44336"),
  
  // Neutrals
  dark: new Color("#212121"),
  darkGray: new Color("#424242"),
  gray: new Color("#757575"),
  lightGray: new Color("#BDBDBD"),
  
  // Backgrounds
  background: Color.dynamic(new Color("#F5F5F7"), new Color("#000000")),
  surface: Color.dynamic(new Color("#FFFFFF"), new Color("#1C1C1E")),
  cardBg: Color.dynamic(new Color("#F8F8F8"), new Color("#2C2C2E")),
  
  // Text
  text: Color.dynamic(new Color("#212121"), new Color("#FFFFFF")),
  textSecondary: Color.dynamic(new Color("#757575"), new Color("#ABABAB")),
  textMuted: Color.dynamic(new Color("#BDBDBD"), new Color("#8E8E93"))
}

const FONTS = {
  title: (size) => Font.boldSystemFont(size || 28),
  headline: (size) => Font.semiboldSystemFont(size || 20),
  body: (size) => Font.regularSystemFont(size || 15),
  caption: (size) => Font.regularSystemFont(size || 12),
  mono: (size) => Font.boldMonospacedSystemFont(size || 24)
}

function drawLiftecLogo(ctx, x, y, width, height, color) {
  // Oberer Balken
  ctx.setFillColor(color)
  const topBarHeight = Math.floor(height * 0.20)
  ctx.fillRect(new Rect(x, y, width, topBarHeight))

  // Untere Balken
  const gap = 2
  const startY = y + topBarHeight + gap
  const barHeight = height - topBarHeight - gap

  // Verteile Breite auf 4 Balken + 3 Gaps
  const totalGaps = (4 - 1) * gap
  const availableWidth = width - totalGaps

  const bar1Width = Math.floor(availableWidth * 0.18)
  const bar2Width = Math.floor(availableWidth * 0.24)
  const bar3Width = Math.floor(availableWidth * 0.28)
  const bar4Width = availableWidth - bar1Width - bar2Width - bar3Width
  // → letzter Balken = Restbreite, dadurch passt die Summe genau

  let currentX = x
  ctx.fillRect(new Rect(currentX, startY, bar1Width, barHeight))
  currentX += bar1Width + gap
  ctx.fillRect(new Rect(currentX, startY, bar2Width, barHeight))
  currentX += bar2Width + gap
  ctx.fillRect(new Rect(currentX, startY, bar3Width, barHeight))
  currentX += bar3Width + gap
  ctx.fillRect(new Rect(currentX, startY, bar4Width, barHeight))
}

// Helper to get SF Symbols
function getIcon(name) {
  try {
    const symbol = SFSymbol.named(name)
    return symbol ? symbol.image : null
  } catch {
    return null
  }
}

// ───────────────────────────────────────────────────────────────────────
// 🗂️ STORAGE - File Management & Data Persistence
// ───────────────────────────────────────────────────────────────────────

const DEV_MODE = false
const BETA_MODE = false
const fm = FileManager.iCloud()
const docsDir = fm.documentsDirectory()
const suffix = DEV_MODE ? "-dev" : (BETA_MODE ? "-beta" : "")
const baseDir = fm.joinPath(docsDir, `LiftecTimer${suffix}`)
const sessionsDir = fm.joinPath(baseDir, "sessions")
const logsDir = fm.joinPath(baseDir, "logs")
const configDir = fm.joinPath(baseDir, "config")
// Create directories if needed
if (!fm.fileExists(baseDir)) fm.createDirectory(baseDir, true)
if (!fm.fileExists(sessionsDir)) fm.createDirectory(sessionsDir, true)
if (!fm.fileExists(logsDir)) fm.createDirectory(logsDir, true)
if (!fm.fileExists(configDir)) fm.createDirectory(configDir, true)
// File paths
const SESSION_FILE = fm.joinPath(sessionsDir, "current.json")
const MASTER_CSV = fm.joinPath(logsDir, "worklog.csv")
const SETTINGS_FILE = fm.joinPath(configDir, "settings.json")
// Storage helpers
async function ensureDownloaded(path) {
  if (fm.fileExists(path) && !fm.isFileDownloaded(path)) {
    await fm.downloadFileFromiCloud(path)
  }
}

async function readJSON(path, fallback = {}) {
  if (!fm.fileExists(path)) {
    fm.writeString(path, JSON.stringify(fallback, null, 2))
    return fallback
  }
  await ensureDownloaded(path)
  try {
    return JSON.parse(fm.readString(path))
  } catch {
    return fallback
  }
}

// ───────────────────────────────────────────────────────────────────────
// 📋 DATA MODELS - Session, Settings, etc.
// ───────────────────────────────────────────────────────────────────────

function writeJSON(path, data) {
  fm.writeString(path, JSON.stringify(data, null, 2))
}

const DEFAULT_SETTINGS = {
  username: "Dein Name in Settings einstellen",
  language: "de",
  surchargePercent: 80,
  email: "daniel@liftec.at",
  emailSubject: "Arbeitszeit {month} - {name}",
  emailBody: "Hi Stefan. Anbei meine Arbeitszeit für {month}.",
}

const TASK_TYPES = {
  N: "Neuanlage",
  D: "Demontage", 
  R: "Reparatur",
  W: "Wartung",
  "": "Other"
}

const I18N = {
  de: {
    appName: "Zeiterfassung",
    noSession: "Keine aktive Sitzung",
    running: "Läuft seit",
    duration: "Dauer",
    start: "Start",
    end: "Ende",
    travelTime: "Fahrtzeit",
    surcharge: "Zuschlag",
    tasks: "Aufgaben",
    addTask: "Aufgabe hinzufügen",
    endSession: "Beenden",
    settings: "Einstellungen",
    goodMorning: "Guten Morgen",
    goodAfternoon: "Guten Tag",
    goodEvening: "Guten Abend",
    monthExport: "Monatsübersicht senden",
    auto: "Automatisch",
    enterMonth: "Monat eingeben",
    cancel: "Abbrechen",
    startSession: "Sitzung starten",
    save: "Speichern",
    description: "Beschreibung",
    language: "Sprache",
    german: "Deutsch",
    english: "English",
    croatian: "Kroatisch",
    emailAddress: "E-Mail-Adresse",
    subject: "Betreff",
    message: "Nachricht",
    back: "Zurück",
    sessionSummary: "Tages Zusammenfassung",
    date: "Datum",
    pause: "Pause",
    netWorkTime: "Arbeitszeit netto",
    taskType: "Aufgabentyp",
    close: "Schließen",
    menu: "Menü",
    profile: "Profil",
    workTime: "Arbeitszeit",
    emailExport: "per E-Mail schicken",
    recordings: "Aufzeichnungen",
    noTasks: "Noch keine Aufgaben",
    noRecordings: "Noch keine Aufzeichnungen vorhanden",
    noEntries: "Keine Einträge gefunden",
    name: "Name",
    editType: "Aufgabentyp ändern",
    editDescription: "Beschreibung ändern",
    delete: "Löschen",
    error: "Fehler",
    invalidFormat: "Ungültiges Format",
    noEmailSet: "Bitte E-Mail in Einstellungen angeben",
    exportSuccess: "Export erfolgreich",
    sendEmail: "Per E-Mail senden",
    previewShare: "Vorschau/Teilen",
    done: "Fertig",
    mailError: "Mail Fehler",
    shareFailed: "Teilen fehlgeschlagen",
    entryFrom: "Eintrag vom",
    activities: "Tätigkeiten",
    none: "Keine",
    tasksCount: "Aufgaben ({count})",
    andMore: "... und {count} weitere",
    monday: "Montag",
    tuesday: "Dienstag",
    wednesday: "Mittwoch",
    thursday: "Donnerstag",
    friday: "Freitag",
    saturday: "Samstag",
    sunday: "Sonntag"
  },
en: {
    appName: "Time Tracking",
    noSession: "No active session",
    running: "Running since",
    duration: "Duration",
    start: "Start",
    end: "End",
    travelTime: "Travel time",
    surcharge: "Surcharge",
    tasks: "Tasks",
    addTask: "Add task",
    endSession: "End Session",
    settings: "Settings",
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    monthExport: "Monthly export",
    auto: "Automatic",
    enterMonth: "Enter month",
    cancel: "Cancel",
    startSession: "Start session",
    save: "Save",
    description: "Description",
    language: "Language",
    german: "German",
    english: "English",
    croatian: "Croatian",
    emailAddress: "Email address",
    subject: "Subject",
    message: "Message",
    back: "Back",
    sessionSummary: "Session Summary",
    date: "Date",
    pause: "Pause",
    netWorkTime: "Net work time",
    taskType: "Task Type",
    close: "Close",
    menu: "Menu",
    profile: "Profile",
    workTime: "Work Time",
    emailExport: "Email Export",
    recordings: "Recordings",
    noTasks: "No tasks yet",
    noRecordings: "No recordings available",
    noEntries: "No entries found",
    name: "Name",
    profilePicture: "Profile Picture",
    set: "Set",
    noImage: "No Image",
    chooseFromPhotos: "Choose from Photos",
    removeImage: "Remove Image",
    editType: "Change Type",
    editDescription: "Change Description",
    delete: "Delete",
    error: "Error",
    invalidFormat: "Invalid Format",
    noEmailSet: "Please set email in settings",
    exportSuccess: "Export successful",
    sendEmail: "Send via Email",
    previewShare: "Preview/Share",
    done: "Done",
    mailError: "Email Error",
    shareFailed: "Sharing Failed",
    entryFrom: "Entry from",
    activities: "Activities",
    none: "None",
    tasksCount: "Tasks ({count})",
    andMore: "... and {count} more"
  },
  hr: {
    appName: "Praćenje vremena",
    noSession: "Nema aktivne sesije",
    running: "Radi od",
    duration: "Trajanje",
    start: "Početak",
    end: "Kraj",
    travelTime: "Vrijeme putovanja",
    surcharge: "Dodatak",
    tasks: "Zadaci",
    addTask: "Dodaj zadatak",
    endSession: "Završi sesiju",
    settings: "Postavke",
    goodMorning: "Dobro jutro",
    goodAfternoon: "Dobar dan",
    goodEvening: "Dobra večer",
    monthExport: "Mjesečni izvoz",
    auto: "Automatski",
    enterMonth: "Unesi mjesec",
    cancel: "Odustani",
    startSession: "Pokreni sesiju",
    save: "Spremi",
    description: "Opis",
    language: "Jezik",
    german: "Njemački",
    english: "Engleski",
    croatian: "Hrvatski",
    emailAddress: "E-mail adresa",
    subject: "Predmet",
    message: "Poruka",
    back: "Natrag",
    sessionSummary: "Sažetak sesije",
    date: "Datum",
    pause: "Pauza",
    netWorkTime: "Neto radno vrijeme",
    taskType: "Vrsta zadatka",
    close: "Zatvori",
    menu: "Izbornik",
    profile: "Profil",
    workTime: "Radno vrijeme",
    emailExport: "Izvoz e-pošte",
    recordings: "Snimke",
    noTasks: "Još nema zadataka",
    noRecordings: "Nema dostupnih snimki",
    noEntries: "Nema pronađenih unosa",
    name: "Ime",
    profilePicture: "Profilna slika",
    set: "Postavljeno",
    noImage: "Nema slike",
    chooseFromPhotos: "Odaberi iz fotografija",
    removeImage: "Ukloni sliku",
    editType: "Promijeni vrstu",
    editDescription: "Promijeni opis",
    delete: "Izbriši",
    error: "Pogreška",
    invalidFormat: "Nevažeći format",
    noEmailSet: "Molimo postavite e-mail u postavkama",
    exportSuccess: "Izvoz uspješan",
    sendEmail: "Pošalji putem e-pošte",
    previewShare: "Pregled/Dijeli",
    done: "Gotovo",
    mailError: "Pogreška e-pošte",
    shareFailed: "Dijeljenje nije uspjelo",
    entryFrom: "Unos od",
    activities: "Aktivnosti",
    none: "Nema",
    tasksCount: "Zadaci ({count})",
    andMore: "... i još {count}"
  }
};

let SETTINGS = await readJSON(SETTINGS_FILE, DEFAULT_SETTINGS)
let LANG = SETTINGS.language || "de"

function t(key) {
  const lang = SETTINGS.language || "de"
  return I18N[lang]?.[key] || I18N.de[key] || key
}

// ───────────────────────────────────────────────────────────────────────
// 🔧 UTILITY FUNCTIONS - Formatting, etc.
// ───────────────────────────────────────────────────────────────────────

function pad2(n) {
  return n.toString().padStart(2, "0")
}

function formatTime(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function formatDate(date) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`
}

function hoursToHHMM(hours) {
  const totalMins = Math.round(hours * 60)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return `${pad2(h)}:${pad2(m)}`
}

function formatDuration(startISO) {
  const start = new Date(startISO)
  const durMs = Date.now() - start.getTime()
  const hours = Math.floor(durMs / 3600000)
  const mins = Math.floor((durMs % 3600000) / 60000)
  return `${pad2(hours)}:${pad2(mins)}`
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return t("goodMorning")
  if (hour < 18) return t("goodAfternoon")
  return t("goodEvening")
}

function getDayName(date) {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  return t(days[date.getDay()])
}

async function showAlert(title, message, actions = ["OK"]) {
  const alert = new Alert()
  alert.title = title
  if (message) alert.message = message
  actions.forEach(a => alert.addAction(a))
  return await alert.presentAlert()
}

// CSV quoting helper
function csvQuote(str) {
  if (str == null) return '""'
  const escaped = String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ')
  return `"${escaped}"`
}

const BOM = "\uFEFF"

// ───────────────────────────────────────────────────────────────────────
// 💼 SESSION MANAGEMENT - CRUD operations
// ───────────────────────────────────────────────────────────────────────

async function readSession() {
  if (!fm.fileExists(SESSION_FILE)) return null
  await ensureDownloaded(SESSION_FILE)
  try {
    return JSON.parse(fm.readString(SESSION_FILE))
  } catch {
    return null
  }
}

function writeSession(session) {
  writeJSON(SESSION_FILE, session)
}

function deleteSession() {
  if (fm.fileExists(SESSION_FILE)) {
    fm.remove(SESSION_FILE)
  }
}

// ───────────────────────────────────────────────────────────────────────
// 📊 CSV EXPORT - Master CSV & Monthly exports
// ───────────────────────────────────────────────────────────────────────

const CSV_HEADER = "Datum;Start;Ende;Pause;Fahrtzeit;SZ;N;D;R;W;Taetigkeiten"

async function appendToMasterCSV(row) {
  await ensureDownloaded(MASTER_CSV)
  
  if (!fm.fileExists(MASTER_CSV)) {
    fm.writeString(MASTER_CSV, BOM + CSV_HEADER + "\n" + row + "\n")
  } else {
    let csv = fm.readString(MASTER_CSV)
    if (!csv.startsWith(BOM)) csv = BOM + csv
    if (csv.length && !csv.endsWith("\n")) csv += "\n"
    fm.writeString(MASTER_CSV, csv + row + "\n")
  }
}

function parseCSVDate(dateStr) {
  const parts = dateStr.split(".")
  if (parts.length !== 3) return null
  const day = parseInt(parts[0])
  const month = parseInt(parts[1])
  const year = parseInt(parts[2])
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null
  return { day, month, year }
}

async function getMonthlyRows(year, month) {
  if (!fm.fileExists(MASTER_CSV)) return []
  
  await ensureDownloaded(MASTER_CSV)
  const csv = fm.readString(MASTER_CSV)
  const lines = csv.split(/\r?\n/)
  
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    const firstCol = line.split(";")[0].replace(/"/g, "")
    const parsed = parseCSVDate(firstCol)
    
    if (parsed && parsed.year === year && parsed.month === month) {
      rows.push(line)
    }
  }
  
  return rows
}

function getAutoMonth() {
  const now = new Date()
  const day = now.getDate()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  
  // If day 1-5, use previous month
  if (day <= 5) {
    month--
    if (month === 0) {
      month = 12
      year--
    }
  }
  
  return { year, month }
}

function parseManualMonth(input) {
  const parts = input.split(/[.-]/)
  if (parts.length !== 2) return null
  
  let month, year
  if (parts[0].length === 4) {
    year = parseInt(parts[0])
    month = parseInt(parts[1])
  } else {
    month = parseInt(parts[0])
    year = parseInt(parts[1])
  }
  
  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) return null
  return { year, month }
}

async function exportMonthCSV(year, month) {
  const rows = await getMonthlyRows(year, month)
  
  // Erstelle Map mit Datum als Key für schnellen Zugriff
  const dataMap = new Map()
  for (const row of rows) {
    const firstCol = row.split(";")[0].replace(/"/g, "")
    const parsed = parseCSVDate(firstCol)
    if (parsed) {
      const key = `${parsed.year}-${pad2(parsed.month)}-${pad2(parsed.day)}`
      dataMap.set(key, row)
    }
  }
  
  // Berechne letzten Tag des Monats
  const lastDay = new Date(year, month, 0).getDate()
  
  // Erstelle vollständige Zeilen für alle Tage
  const completeRows = []
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${pad2(day)}.${pad2(month)}.${year}`
    const key = `${year}-${pad2(month)}-${pad2(day)}`
    
    if (dataMap.has(key)) {
      // Vorhandene Daten verwenden
      completeRows.push(dataMap.get(key))
    } else {
      // Leere Zeile mit nur Datum erstellen
      // Format: "Datum;Start;Ende;Pause;Fahrtzeit;SZ;N;D;R;W;Taetigkeiten"
      const emptyRow = `"${dateStr}";"";"";"";"";"";"";"";"";"";""`
      completeRows.push(emptyRow)
    }
  }
  
  if (completeRows.length === 0) {
    await showAlert(t("error"), `Keine Einträge für ${year}-${pad2(month)}`)
    return null
  }
  
  const username = SETTINGS.username || "User"
  const filename = `${username.replace(/\s+/g, "_")}_${year}-${pad2(month)}.csv`
  const filepath = fm.joinPath(logsDir, filename)
  
  const content = BOM + CSV_HEADER + "\n" + completeRows.join("\n") + "\n"
  fm.writeString(filepath, content)
  
  return { filepath, filename, year, month }
}


// ───────────────────────────────────────────────────────────────────────
// 🎭 UI COMPONENTS - Reusable UI building blocks
// ───────────────────────────────────────────────────────────────────────

function createHeroCard(session) {
  const ctx = new DrawContext()
  const width = 343
  const height = session ? 180 : 140
  
  ctx.size = new Size(width, height)
  ctx.opaque = false
  
  const gradient = new LinearGradient()
  gradient.locations = [0, 1]
  gradient.colors = [COLORS.primary, COLORS.primaryLight]
  const rect = new Rect(0, 0, width, height)
  ctx.setFillColor(COLORS.primary)
  ctx.fillRect(rect)
  
   // Ornament: Vertical bars (like zoomed logo section, right side)
  ctx.setFillColor(new Color("FFFFFF", 0.08))
  
  const barStartX = width - 150
  const barY = 0
  const barFullHeight = height
  const barWidths = [15, 20, 28, 38]
  const gaps = [12, 14, 16]
  
  let currentX = barStartX
  
  for (let i = 0; i < barWidths.length; i++) {
    ctx.fillRect(new Rect(currentX, barY, barWidths[i], barFullHeight))
    currentX += barWidths[i]
    if (i < gaps.length) {
      currentX += gaps[i]
    }
  }
  
     // Draw LIFTEC logo bars
  const logoY = 20
  drawLiftecLogo(ctx, 20, logoY, 40, 40, Color.white(), Color.white())
    const contentY = logoY + 50
  ctx.setFont(FONTS.caption(13))
  ctx.setTextColor(new Color("000000", 0.7))
  ctx.drawText(getGreeting(), new Point(20, contentY))
  
  ctx.setFont(FONTS.title(22))
  ctx.setTextColor(COLORS.dark)
  ctx.drawText(SETTINGS.username || "User", new Point(20, contentY + 22))
  
  if (session) {
    const boxY = height - 62
    ctx.setFillColor(new Color("000000", 0.12))
    ctx.fillRect(new Rect(16, boxY, width - 32, 50))
    
    ctx.setFont(FONTS.caption(11))
    ctx.setTextColor(new Color("000000", 0.7))
    ctx.drawText(t("duration").toUpperCase(), new Point(24, boxY + 8))
    
    const duration = formatDuration(session.start)
    ctx.setFont(FONTS.mono(28))
    ctx.setTextColor(COLORS.dark)
    ctx.drawText(duration, new Point(24, boxY + 20))
  }
  
  return ctx.getImage()
}

function createListRow(text, icon, opts = {}) {
  const row = new UITableRow()
  row.height = opts.height || 50
  
  if (icon) {
    const img = row.addImage(getIcon(icon))
    img.widthWeight = 10
    if (opts.iconColor) img.tintColor = opts.iconColor
  }
  
  const label = row.addText(text)
  label.titleFont = opts.font || FONTS.body(16)
  if (opts.textColor) label.textColor = opts.textColor
  
  if (opts.rightText) {
    const right = row.addText(opts.rightText)
    right.rightAligned()
    right.titleFont = FONTS.caption(14)
    right.textColor = COLORS.textSecondary
  }
  
  if (opts.onSelect) row.onSelect = opts.onSelect
  
  row.dismissOnSelect = opts.dismissOnSelect !== false
  
  return row
}

// ───────────────────────────────────────────────────────────────────────
// 🚀 CORE FLOWS - Start, Add Task, End Session
// ───────────────────────────────────────────────────────────────────────


async function flowStartSession() {
  const picker = new DatePicker()
  picker.initialDate = new Date()
  picker.minuteInterval = 5
  
  const picked = await picker.pickDateAndTime()
  if (!picked) return false
  
  writeSession({
    start: picked.toISOString(),
    tasks: []
  })
  
  return true
}

async function flowAddTask(session) {
  const typeAlert = new Alert()
  typeAlert.title = t("taskType")
  Object.entries(TASK_TYPES).forEach(([code, name]) => {
    typeAlert.addAction(name)
  })
  typeAlert.addCancelAction(t("cancel"))
  
  const typeIdx = await typeAlert.presentAlert()
  if (typeIdx === -1) return false
  
  const typeCodes = Object.keys(TASK_TYPES)
  const selectedType = typeCodes[typeIdx]
  
  const descAlert = new Alert()
  descAlert.title = t("description")
  descAlert.addTextField("", "")
  descAlert.addAction(t("save"))
  descAlert.addCancelAction(t("cancel"))
  
  const descOk = await descAlert.presentAlert()
  if (descOk === -1) return false
  
  const desc = descAlert.textFieldValue(0).trim()
  if (!desc) return false
  
  session.tasks.push({
    type: selectedType,
    description: desc
  })
  
  writeSession(session)
  return true
}

async function flowEndSession(session) {
  const endPicker = new DatePicker()
  endPicker.initialDate = new Date()
  endPicker.minuteInterval = 5
  
  const endTime = await endPicker.pickDateAndTime()
  if (!endTime) return false
  
  const startTime = new Date(session.start)
  
  if (endTime <= startTime) {
    await showAlert(t("error"), "Endzeit muss nach Startzeit liegen")
    return await flowEndSession(session)
  }
  
  const timeAlert = new Alert()
  timeAlert.title = "Pause & Fahrtzeit"
  timeAlert.message = "Angabe in Stunden (z.B. 0.5 = 30 Min)\n\n" + t("pause") + ":"
  timeAlert.addTextField(t("pause") + " in Stunden", "0.5")
  timeAlert.message += "\n\n" + t("travelTime") + ":"
  timeAlert.addTextField(t("travelTime") + " in Stunden", "0")
  timeAlert.addAction("Weiter")
  timeAlert.addCancelAction(t("cancel"))
  
  const timeOk = await timeAlert.presentAlert()
  if (timeOk === -1) return false
  
  const pause = parseFloat(timeAlert.textFieldValue(0).replace(",", ".")) || 0
  const travel = parseFloat(timeAlert.textFieldValue(1).replace(",", ".")) || 0
  
  const totalHours = (endTime - startTime) / 3600000
  const netHours = totalHours - pause - travel
  
  if (netHours < 0) {
    await showAlert(t("error"), "Pause + Fahrtzeit ist größer als Gesamtzeit")
    return await flowEndSession(session)
  }
  
  let surchargePercent = SETTINGS.surchargePercent
  
  const hasOfficeTask = session.tasks.some(t => 
    t.type === "" || 
    t.description.toLowerCase().includes("office") ||
    t.description.toLowerCase().includes("büro")
  )
  
  if (hasOfficeTask) {
    const szAlert = new Alert()
    szAlert.title = t("surcharge") + " anpassen?"
    szAlert.message = `Büro-Aufgabe erkannt.\nStandard: ${SETTINGS.surchargePercent}%`
    szAlert.addTextField(t("surcharge") + " %", String(SETTINGS.surchargePercent))
    szAlert.addAction("OK")
    szAlert.addCancelAction("Standard verwenden")
    
    const szOk = await szAlert.presentAlert()
    if (szOk !== -1) {
      const customSz = parseFloat(szAlert.textFieldValue(0).replace(",", "."))
      if (!isNaN(customSz) && customSz >= 0 && customSz <= 200) {
        surchargePercent = customSz
      }
    }
  }
  
  const surchargeHours = Math.round(netHours * (surchargePercent / 100) * 2) / 2
  const dayName = getDayName(startTime)
  
  const tasksList = session.tasks.map(t => 
    `<div style="margin: 4px 0; color: #424242;">• ${t.description}${t.type ? ' <span style="background: #FFB300; color: #212121; padding: 2px 6px; border-radius: 4px; font-size: 11px;">[' + t.type + ']</span>' : ''}</div>`
  ).join("")
  
  const summaryHTML = `
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, sans-serif; 
        padding: 20px; 
        background: #f8f8f8; 
        margin: 0;
      }
      .card { 
        background: white; 
        border-radius: 12px; 
        padding: 16px; 
        margin-bottom: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .header {
        font-size: 20px;
        font-weight: 700;
        color: #FFB300;
        margin-bottom: 16px;
      }
      .day-name {
        font-size: 14px;
        color: #757575;
        margin-bottom: 8px;
      }
      .row { 
        display: flex; 
        justify-content: space-between; 
        padding: 8px 0;
        border-bottom: 1px solid #f0f0f0;
      }
      .row:last-child { border-bottom: none; }
      .label { color: #757575; font-size: 14px; }
      .value { color: #212121; font-weight: 600; font-size: 14px; }
      .big { font-size: 24px; color: #FFB300; font-weight: 700; }
      .tasks-title { 
        font-size: 12px; 
        color: #999; 
        text-transform: uppercase; 
        margin: 12px 0 8px 0;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">${t("sessionSummary")}</div>
      <div class="day-name">${dayName}</div>
      <div class="row">
        <span class="label">${t("date")}</span>
        <span class="value">${formatDate(startTime)}</span>
      </div>
      <div class="row">
        <span class="label">${t("start")}</span>
        <span class="value">${formatTime(startTime)}</span>
      </div>
      <div class="row">
        <span class="label">${t("end")}</span>
        <span class="value">${formatTime(endTime)}</span>
      </div>
    </div>
    
    <div class="card">
      <div class="row">
        <span class="label">${t("pause")}</span>
        <span class="value">${hoursToHHMM(pause)} h</span>
      </div>
      <div class="row">
        <span class="label">${t("travelTime")}</span>
        <span class="value">${hoursToHHMM(travel)} h</span>
      </div>
      <div class="row">
        <span class="label">${t("netWorkTime")}</span>
        <span class="value">${hoursToHHMM(netHours)} h</span>
      </div>
      <div class="row">
        <span class="label">${t("surcharge")} (${surchargePercent}%)</span>
        <span class="big">${hoursToHHMM(surchargeHours)} h</span>
      </div>
    </div>
    
    ${session.tasks.length > 0 ? `
    <div class="card">
      <div class="tasks-title">${t("tasks")} (${session.tasks.length})</div>
      ${tasksList}
    </div>
    ` : ''}
  </body>
  </html>
  `
  
  const webView = new WebView()
  await webView.loadHTML(summaryHTML)
  await webView.present()
  
  const confirmAlert = new Alert()
  confirmAlert.title = "Jetzt speichern?"
  confirmAlert.addAction(t("save"))
  confirmAlert.addCancelAction(t("cancel"))
  
  const confirmed = await confirmAlert.presentAlert()
  if (confirmed === -1) {
    return false
  }
  
  const dateStr = formatDate(startTime)
  
  const flags = { N: "", D: "", R: "", W: "" }
  session.tasks.forEach(t => {
    if (flags.hasOwnProperty(t.type)) {
      flags[t.type] = "X"
    }
  })
  
  const tasksStr = session.tasks
    .map(t => t.type ? `${t.description} [${t.type}]` : t.description)
    .join(", ")
  
  const row = [
    dateStr,
    formatTime(startTime),
    formatTime(endTime),
    hoursToHHMM(pause),
    hoursToHHMM(travel),
    hoursToHHMM(surchargeHours),
    flags.N,
    flags.D,
    flags.R,
    flags.W,
    csvQuote(tasksStr)
  ].join(";")
  
  try {
    await appendToMasterCSV(row)
    deleteSession()
    return true
  } catch (e) {
    await showAlert(t("error"), String(e))
    return false
  }
}

// ───────────────────────────────────────────────────────────────────────
// 📱 MAIN SCREEN - Home view with session info
// ───────────────────────────────────────────────────────────────────────

async function showMainScreen() {
  const session = await readSession()
  let reopen = false   // <- sagt dem Router, ob wir danach Main neu öffnen
  const table = new UITable()
  table.showSeparators = false
  
  const closeRow = createListRow("✕ " + t("close"), null, {
    height: 40,
    font: FONTS.body(16),
    textColor: COLORS.textSecondary,
    onSelect: () => {
    App.close()// kein reopen setzen -> Router bekommt false (siehe unten)
    }
  })
  table.addRow(closeRow)
  
  const heroRow = new UITableRow()
  heroRow.height = session ? 190 : 150
  const heroImg = createHeroCard(session)
  heroRow.addImage(heroImg)
  heroRow.dismissOnSelect = false
  table.addRow(heroRow)
  
  const spacer1 = new UITableRow()
  spacer1.height = 12
  spacer1.dismissOnSelect = false
  table.addRow(spacer1)
  
  if (!session) {
    const emptyRow = new UITableRow()
    const label = emptyRow.addText(t("noSession"))
    label.titleFont = FONTS.body(15)
    label.textColor = COLORS.textSecondary
    emptyRow.dismissOnSelect = false
    table.addRow(emptyRow)
    
    const spacer2 = new UITableRow()
    spacer2.height = 20
    spacer2.dismissOnSelect = false
    table.addRow(spacer2)
    
    const startRow = createListRow("▶ " + t("startSession"), null, {
      height: 60,
      font: FONTS.headline(18),
      textColor: COLORS.success,
      onSelect: async () => {
        const started = await flowStartSession()
        if (started) await showMainScreen()
      }
    })
    table.addRow(startRow)
  } else {
    if (session.tasks.length > 0) {
      const taskHeader = new UITableRow()
      const th = taskHeader.addText(t("tasks").toUpperCase())
      th.titleFont = FONTS.caption(12)
      th.textColor = COLORS.textMuted
      taskHeader.dismissOnSelect = false
      taskHeader.height = 30
      table.addRow(taskHeader)
      
      session.tasks.forEach((task, idx) => {
        const taskRow = new UITableRow()
        const txt = task.type 
          ? `${task.description} [${task.type}]`
          : task.description
        const taskLabel = taskRow.addText(txt)
        
        const chevron = taskRow.addImage(getIcon("chevron.right"))
        chevron.rightAligned()
        chevron.tintColor = COLORS.textMuted
        
        taskRow.height = 40
        taskRow.onSelect = async () => {
          const s = await readSession()
          if (!s) return
          
          const alert = new Alert()
          alert.title = t("tasks")
          alert.message = s.tasks[idx].description
          alert.addAction(t("editType"))
          alert.addAction(t("editDescription"))
          alert.addDestructiveAction(t("delete"))
          alert.addCancelAction(t("cancel"))
          
          const choice = await alert.presentAlert()
          if (choice === -1) {
            await showMainScreen()
            return
          }
          
          if (choice === 0) {
            const typeAlert = new Alert()
            typeAlert.title = t("editType")
            Object.entries(TASK_TYPES).forEach(([code, name]) => {
              typeAlert.addAction(name)
            })
            typeAlert.addCancelAction(t("cancel"))
            
            const typeIdx = await typeAlert.presentAlert()
            if (typeIdx !== -1) {
              const typeCodes = Object.keys(TASK_TYPES)
              s.tasks[idx].type = typeCodes[typeIdx]
              writeSession(s)
            }
            await showMainScreen()
            
          } else if (choice === 1) {
            const descAlert = new Alert()
            descAlert.title = t("description")
            descAlert.addTextField("", s.tasks[idx].description)
            descAlert.addAction(t("save"))
            descAlert.addCancelAction(t("cancel"))
            
            const ok = await descAlert.presentAlert()
            if (ok !== -1) {
              const newDesc = descAlert.textFieldValue(0).trim()
              if (newDesc) {
                s.tasks[idx].description = newDesc
                writeSession(s)
              }
            }
            await showMainScreen()
            
          } else if (choice === 2) {
            s.tasks.splice(idx, 1)
            writeSession(s)
            await showMainScreen()
          }
        }
        table.addRow(taskRow)
      })
    } else {
      const noTasks = new UITableRow()
      noTasks.addText(t("noTasks"))
      noTasks.dismissOnSelect = false
      noTasks.height = 40
      table.addRow(noTasks)
    }
    
    const spacer3 = new UITableRow()
    spacer3.height = 16
    spacer3.dismissOnSelect = false
    table.addRow(spacer3)
    
    const addRow = createListRow("+ " + t("addTask"), null, {
      height: 50,
      font: FONTS.headline(16),
      textColor: COLORS.primary,
      onSelect: async () => {
        const s = await readSession()
        if (s) {
          await flowAddTask(s)
          await showMainScreen()
        }
      }
    })
    table.addRow(addRow)
    
    const endRow = createListRow("■ " + t("endSession"), null, {
      height: 50,
      font: FONTS.headline(16),
      textColor: COLORS.warning,
      onSelect: async () => {
        const s = await readSession()
        if (s) {
          const ended = await flowEndSession(s)
          if (ended) await showMainScreen()
        }
      }
    })
    table.addRow(endRow)
  }
  
  const spacer4 = new UITableRow()
  spacer4.height = 20
  spacer4.dismissOnSelect = false
  table.addRow(spacer4)
  
  const menuRow = new UITableRow()
  menuRow.height = 50
  menuRow.dismissOnSelect = false
  const menuText = menuRow.addText("⋯")
  menuText.titleFont = Font.systemFont(28)
  menuText.textColor = COLORS.textMuted
  
  menuRow.dismissOnSelect = true // Wichtig: Main sofort schließen, bevor wir Sub-UI zeigen
  menuRow.onSelect = async () => {
    const navAlert = new Alert()
    navAlert.title = t("menu")
    navAlert.addAction("⚙️ " + t("settings"))
    navAlert.addAction("📤 " + t("monthExport"))
    navAlert.addAction("📋 " + t("recordings"))
    navAlert.addAction("ℹ️ Info")
    navAlert.addCancelAction(t("cancel"))
    
    const choice = await navAlert.presentAlert()
    if (choice === 0) {
      reopen = true                // nach Rückkehr: Main neu öffnen
      await showSettingsScreen()
    } else if (choice === 1) {
      reopen = true                // nach Rückkehr: Main neu öffnen
      await flowExportMonth()
      await showMainScreen()
    } else if (choice === 2) {
      reopen = true                // nach Rückkehr: Main neu öffnen
      await showHistoryScreen()
    } else if (choice === 3) {
      reopen = true                // nach Rückkehr: Main neu öffnen
      await showAboutScreen()
    } else {
      reopen = true                // nach Rückkehr: Main neu öffnen
      await showMainScreen()
    }
  }
  
  table.addRow(menuRow)
  
  await table.present()
  return reopen
}

// ───────────────────────────────────────────────────────────────────────
// 📋 HISTORY SCREEN - View past recordings
// ───────────────────────────────────────────────────────────────────────

async function showHistoryScreen() {
  const table = new UITable()
  table.showSeparators = true
  
  const closeRow = new UITableRow()
  closeRow.height = 40
  const closeText = closeRow.addText("← " + t("back"))
  closeText.titleFont = FONTS.body(16)
  closeRow.onSelect = async () => await showMainScreen()
  table.addRow(closeRow)
  
  const header = new UITableRow()
  const h = header.addText(t("recordings"))
  h.titleFont = FONTS.title(24)
  header.dismissOnSelect = false
  header.height = 60
  table.addRow(header)
  
  if (!fm.fileExists(MASTER_CSV)) {
    const empty = new UITableRow()
    empty.addText(t("noRecordings"))
    empty.dismissOnSelect = false
    empty.height = 60
    table.addRow(empty)
    await table.present()
    return
  }
  
  await ensureDownloaded(MASTER_CSV)
  const csv = fm.readString(MASTER_CSV)
  const lines = csv.split(/\r?\n/)
  
  const entries = []
  for (let i = lines.length - 1; i >= 1; i--) {
    const line = lines[i].trim()
    if (!line) continue
    
    const parts = line.split(";")
    if (parts.length >= 11) {
      entries.push({
        date: parts[0],
        start: parts[1],
        end: parts[2],
        pause: parts[3],
        travel: parts[4],
        sz: parts[5],
        tasks: parts[10].replace(/"/g, "")
      })
    }
    
    if (entries.length >= 50) break
  }
  
  if (entries.length === 0) {
    const empty = new UITableRow()
    empty.addText(t("noEntries"))
    empty.dismissOnSelect = false
    table.addRow(empty)
  } else {
    entries.forEach(entry => {
      const row = new UITableRow()
      row.height = 60
      
      const dateLabel = row.addText(entry.date)
      dateLabel.titleFont = FONTS.headline(14)
      dateLabel.widthWeight = 30
      
      const timeLabel = row.addText(`${entry.start} - ${entry.end}`)
      timeLabel.titleFont = FONTS.caption(12)
      timeLabel.textColor = COLORS.textSecondary
      timeLabel.widthWeight = 70
      
      row.onSelect = async () => {
        const alert = new Alert()
        alert.title = t("entryFrom") + " " + entry.date
        alert.message = `${t("start")}: ${entry.start} - ${t("end")}: ${entry.end}\n` +
                       `${t("pause")}: ${entry.pause}\n` +
                       `${t("travelTime")}: ${entry.travel}\n` +
                       `${t("surcharge")}: ${entry.sz}\n\n` +
                       `${t("activities")}:\n${entry.tasks || t("none")}`
        alert.addAction("OK")
        await alert.presentAlert()
        await showHistoryScreen()
      }
      
      table.addRow(row)
    })
  }
  
  await table.present()
}

// ───────────────────────────────────────────────────────────────────────
// ⚙️ SETTINGS SCREEN
// ───────────────────────────────────────────────────────────────────────

async function showSettingsScreen() {
  const table = new UITable()
  table.showSeparators = true
  
  const closeRow = new UITableRow()
  closeRow.height = 40
  const closeText = closeRow.addText("← " + t("back"))
  closeText.titleFont = FONTS.body(16)
  closeRow.onSelect = async () => await showMainScreen()
  table.addRow(closeRow)
  
  const header = new UITableRow()
  const h = header.addText("⚙️ " + t("settings"))
  h.titleFont = FONTS.title(28)
  header.dismissOnSelect = false
  header.height = 60
  table.addRow(header)
  
  const profileHeader = new UITableRow()
  const ph = profileHeader.addText("👤 " + t("profile").toUpperCase())
  ph.titleFont = FONTS.caption(12)
  ph.textColor = COLORS.textMuted
  profileHeader.dismissOnSelect = false
  profileHeader.height = 35
  table.addRow(profileHeader)
  
  const nameRow = new UITableRow()
  nameRow.height = 50
  const nameLabel = nameRow.addText(t("name"))
  const nameValue = nameRow.addText(SETTINGS.username)
  nameValue.rightAligned()
  nameValue.titleFont = FONTS.caption(14)
  nameValue.textColor = COLORS.textSecondary
  nameRow.onSelect = async () => {
    const alert = new Alert()
    alert.title = t("name")
    alert.addTextField("", SETTINGS.username)
    alert.addAction(t("save"))
    alert.addCancelAction(t("cancel"))
    const ok = await alert.presentAlert()
    if (ok !== -1) {
      SETTINGS.username = alert.textFieldValue(0).trim() || "User"
      writeJSON(SETTINGS_FILE, SETTINGS)
      await showSettingsScreen()
    }
  }
  table.addRow(nameRow)
  
  const workHeader = new UITableRow()
  const wh = workHeader.addText("🔧 " + t("workTime").toUpperCase())
  wh.titleFont = FONTS.caption(12)
  wh.textColor = COLORS.textMuted
  workHeader.dismissOnSelect = false
  workHeader.height = 35
  table.addRow(workHeader)
  
  const szRow = createListRow(t("surcharge"), null, {
    rightText: `${SETTINGS.surchargePercent}%`,
    onSelect: async () => {
      const alert = new Alert()
      alert.title = t("surcharge") + " %"
      alert.addTextField("", String(SETTINGS.surchargePercent))
      alert.addAction(t("save"))
      alert.addCancelAction(t("cancel"))
      const ok = await alert.presentAlert()
      if (ok !== -1) {
        const val = parseFloat(alert.textFieldValue(0).replace(",", "."))
        if (!isNaN(val) && val >= 0 && val <= 200) {
          SETTINGS.surchargePercent = val
          writeJSON(SETTINGS_FILE, SETTINGS)
          await showSettingsScreen()
        }
      }
    }
  })
  table.addRow(szRow)
  
  const langHeader = new UITableRow()
  const lh = langHeader.addText("🌐 " + t("language").toUpperCase())
  lh.titleFont = FONTS.caption(12)
  lh.textColor = COLORS.textMuted
  langHeader.dismissOnSelect = false
  langHeader.height = 35
  table.addRow(langHeader)
  
  const langRow = createListRow(t("language"), null, {
    rightText: SETTINGS.language === "de" ? t("german") : (SETTINGS.language === "hr" ? t("croatian") : t("english")),
    onSelect: async () => {
      const alert = new Alert()
      alert.title = t("language")
      alert.addAction(t("german"))
      alert.addAction(t("english"))
      alert.addAction(t("croatian"))
      alert.addCancelAction(t("cancel"))
      const choice = await alert.presentAlert()
      if (choice === 0) {
        SETTINGS.language = "de"
        LANG = "de"
        writeJSON(SETTINGS_FILE, SETTINGS)
        await showSettingsScreen()
      } else if (choice === 1) {
        SETTINGS.language = "en"
        LANG = "en"
        writeJSON(SETTINGS_FILE, SETTINGS)
        await showSettingsScreen()
      } else if (choice === 2) {
        SETTINGS.language = "hr"
        LANG = "hr"
        writeJSON(SETTINGS_FILE, SETTINGS)
        await showSettingsScreen()
      }
    }
  })
  table.addRow(langRow)
  
  const emailHeader = new UITableRow()
  const eh = emailHeader.addText("✉️ " + t("emailExport").toUpperCase())
  eh.titleFont = FONTS.caption(12)
  eh.textColor = COLORS.textMuted
  emailHeader.dismissOnSelect = false
  emailHeader.height = 35
  table.addRow(emailHeader)
  
  const emailRow = createListRow(t("emailAddress"), null, {
    rightText: SETTINGS.email || t("noEmailSet"),
    onSelect: async () => {
      const alert = new Alert()
      alert.title = t("emailAddress")
      alert.addTextField("", SETTINGS.email)
      alert.addAction(t("save"))
      alert.addCancelAction(t("cancel"))
      const ok = await alert.presentAlert()
      if (ok !== -1) {
        SETTINGS.email = alert.textFieldValue(0).trim()
        writeJSON(SETTINGS_FILE, SETTINGS)
        await showSettingsScreen()
      }
    }
  })
  table.addRow(emailRow)
  
  const subjectRow = createListRow(t("subject"), null, {
    rightText: SETTINGS.emailSubject.slice(0, 20) + "...",
    onSelect: async () => {
      const alert = new Alert()
      alert.title = t("subject")
      alert.message = "Platzhalter: {month}, {name}"
      alert.addTextField("", SETTINGS.emailSubject)
      alert.addAction(t("save"))
      alert.addCancelAction(t("cancel"))
      const ok = await alert.presentAlert()
      if (ok !== -1) {
        SETTINGS.emailSubject = alert.textFieldValue(0).trim()
        writeJSON(SETTINGS_FILE, SETTINGS)
        await showSettingsScreen()
      }
    }
  })
  table.addRow(subjectRow)
  
  const bodyRow = createListRow(t("message"), null, {
    rightText: SETTINGS.emailBody.slice(0, 20) + "...",
    onSelect: async () => {
      const alert = new Alert()
      alert.title = t("message")
      alert.message = "Platzhalter: {month}, {name}"
      alert.addTextField("", SETTINGS.emailBody)
      alert.addAction(t("save"))
      alert.addCancelAction(t("cancel"))
      const ok = await alert.presentAlert()
      if (ok !== -1) {
        SETTINGS.emailBody = alert.textFieldValue(0).trim()
        writeJSON(SETTINGS_FILE, SETTINGS)
        await showSettingsScreen()
      }
    }
  })
  table.addRow(bodyRow)
  
  await table.present()
}

// ───────────────────────────────────────────────────────────────────────
// ℹ️ ABOUT SCREEN
// ───────────────────────────────────────────────────────────────────────

async function showAboutScreen() {
  const table = new UITable()
  table.showSeparators = false
  
  const closeRow = createListRow("← " + t("back"), null, {
    height: 40,
    onSelect: async () => await showMainScreen()
  })
  table.addRow(closeRow)
  
  const titleRow = new UITableRow()
  const t1 = titleRow.addText("LIFTEC Timer")
  t1.titleFont = FONTS.title(32)
  t1.textColor = COLORS.primary
  titleRow.dismissOnSelect = false
  titleRow.height = 80
  table.addRow(titleRow)
  
  const versionRow = new UITableRow()
  versionRow.addText("Version 1.0.0")
  versionRow.dismissOnSelect = false
  versionRow.height = 40
  table.addRow(versionRow)
  
  const infoRow = new UITableRow()
  const info = infoRow.addText("Zeiterfassung für LIFTEC\n\nDokumentiert Arbeitszeiten, Aufgaben und Zuschläge. Export als CSV für weitere Verarbeitung.")
  info.titleFont = FONTS.body(15)
  info.textColor = COLORS.textSecondary
  infoRow.dismissOnSelect = false
  infoRow.height = 120
  table.addRow(infoRow)
  
  await table.present()
}

// ───────────────────────────────────────────────────────────────────────
// 📤 EXPORT FLOW - Monthly export with email
// ───────────────────────────────────────────────────────────────────────

async function flowExportMonth() {
  const auto = getAutoMonth()
  const autoLabel = `${auto.year}-${pad2(auto.month)}`
  
  const alert = new Alert()
  alert.title = t("monthExport")
  alert.message = `${t("auto")}: ${autoLabel}`
  alert.addAction(`${t("auto")}: ${autoLabel}`)
  alert.addAction(t("enterMonth"))
  alert.addCancelAction(t("cancel"))
  
  const choice = await alert.presentAlert()
  if (choice === -1) return
  
  let target = null
  
  if (choice === 0) {
    target = auto
  } else {
    const inputAlert = new Alert()
    inputAlert.title = t("enterMonth")
    inputAlert.message = "Format: MM.YYYY oder YYYY-MM"
    const now = new Date()
    inputAlert.addTextField("", `${pad2(now.getMonth() + 1)}.${now.getFullYear()}`)
    inputAlert.addAction("OK")
    inputAlert.addCancelAction(t("cancel"))
    
    const ok = await inputAlert.presentAlert()
    if (ok === -1) return
    
    const input = inputAlert.textFieldValue(0).trim()
    const parsed = parseManualMonth(input)
    if (!parsed) {
      await showAlert(t("error"), t("invalidFormat"))
      return
    }
    target = parsed
  }
  
  const result = await exportMonthCSV(target.year, target.month)
  if (!result) return
  
  const shareAlert = new Alert()
  shareAlert.title = t("exportSuccess")
  shareAlert.message = result.filename
  shareAlert.addAction(t("sendEmail"))
  shareAlert.addAction(t("previewShare"))
  shareAlert.addCancelAction(t("done"))
  
  const action = await shareAlert.presentAlert()
  
  if (action === 0) {
    if (!SETTINGS.email) {
      await showAlert(t("error"), t("noEmailSet"))
      return
    }
    
    try {
      const mail = new Mail()
      mail.toRecipients = [SETTINGS.email]
      
      const monthStr = `${target.year}-${pad2(target.month)}`
      const subject = SETTINGS.emailSubject
        .replace("{month}", monthStr)
        .replace("{name}", SETTINGS.username)
      mail.subject = subject
      
      const body = SETTINGS.emailBody
        .replace("{month}", monthStr)
        .replace("{name}", SETTINGS.username)
      mail.body = body
      
      await ensureDownloaded(result.filepath)
      
      if (typeof mail.addFileAttachment === "function") {
        mail.addFileAttachment(result.filepath)
      } else {
        const data = Data.fromFile(result.filepath)
        mail.addDataAttachment(data, "text/csv", result.filename)
      }
      
      await mail.send()
    } catch (e) {
      await showAlert(t("mailError"), String(e))
    }
  } else if (action === 1) {
    try {
      await QuickLook.present(result.filepath)
    } catch {
      try {
        const share = new ShareSheet()
        share.addFile(result.filepath)
        await share.present()
      } catch (e) {
        await showAlert(t("shareFailed"), String(e))
      }
    }
  }
}

function parseManualMonth(input) {
  const clean = input.trim().replace(/[.\s/]+/g, "-")
  
  let match = clean.match(/^(\d{4})-(\d{1,2})$/)
  if (match) {
    const year = parseInt(match[1])
    const month = parseInt(match[2])
    if (month >= 1 && month <= 12) return { year, month }
  }
  
  match = clean.match(/^(\d{1,2})-(\d{4})$/)
  if (match) {
    const month = parseInt(match[1])
    const year = parseInt(match[2])
    if (month >= 1 && month <= 12) return { year, month }
  }
  
  return null
}

// ───────────────────────────────────────────────────────────────────────
// 🔲 WIDGETS - Small, Medium, Large
// ───────────────────────────────────────────────────────────────────────

function createPlusIcon(size, color) {
  const ctx = new DrawContext()
  ctx.size = new Size(size, size)
  ctx.opaque = false
  
  ctx.setFillColor(color)
  ctx.fillEllipse(new Rect(0, 0, size, size))
  
  ctx.setFillColor(Color.white())
  const lineWidth = Math.max(3, size * 0.08)
  const lineLength = size * 0.5
  const center = size / 2
  
  ctx.fillRect(new Rect(center - lineLength/2, center - lineWidth/2, lineLength, lineWidth))
  ctx.fillRect(new Rect(center - lineWidth/2, center - lineLength/2, lineWidth, lineLength))
  
  return ctx.getImage()
}

async function createSmallWidget() {
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.surface
  widget.setPadding(12, 12, 12, 12)
  
  const session = await readSession()
  
  const headerStack = widget.addStack()
  headerStack.layoutHorizontally()
  headerStack.centerAlignContent()
  
  const titleText = headerStack.addText("LIFTEC Timer")
  titleText.font = FONTS.headline(14)
  titleText.textColor = COLORS.primary
  
  headerStack.addSpacer()
  
  widget.addSpacer(8)
  
  if (!session) {
    const statusText = widget.addText(t("noSession"))
    statusText.font = FONTS.body(12)
    statusText.textColor = COLORS.textSecondary
    
    widget.addSpacer()
    
    const startStack = widget.addStack()
    startStack.layoutHorizontally()
    startStack.centerAlignContent()
    startStack.url = "scriptable:///run/" + encodeURIComponent(Script.name()) + "?action=start"
    
    const playIcon = startStack.addImage(getIcon("play.circle.fill"))
    playIcon.imageSize = new Size(32, 32)
    playIcon.tintColor = COLORS.success
    
    startStack.addSpacer(8)
    
    const startText = startStack.addText(t("start"))
    startText.font = FONTS.headline(14)
    startText.textColor = COLORS.success
  } else {
    const duration = formatDuration(session.start)
    const timeText = widget.addText(duration)
    timeText.font = FONTS.mono(24)
    timeText.textColor = COLORS.text
    
    widget.addSpacer()
    
    const buttonStack = widget.addStack()
    buttonStack.layoutHorizontally()
    buttonStack.spacing = 8
    buttonStack.centerAlignContent()
    
    const addStack = buttonStack.addStack()
    addStack.layoutVertically()
    addStack.centerAlignContent()
    addStack.url = "scriptable:///run/" + encodeURIComponent(Script.name()) + "?action=addTask"
    
    const addIcon = addStack.addImage(createPlusIcon(28, COLORS.primary))
    addIcon.imageSize = new Size(28, 28)
    
    buttonStack.addSpacer()
    
    const stopStack = buttonStack.addStack()
    stopStack.layoutVertically()
    stopStack.centerAlignContent()
    stopStack.url = "scriptable:///run/" + encodeURIComponent(Script.name()) + "?action=stop"
    
    const stopIcon = stopStack.addImage(getIcon("stop.circle.fill"))
    stopIcon.imageSize = new Size(28, 28)
    stopIcon.tintColor = COLORS.warning
  }
  
  return widget
}

async function createMediumWidget() {
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.surface
  widget.setPadding(12, 16, 12, 16)
  
  const session = await readSession()
  
  const headerStack = widget.addStack()
  headerStack.layoutHorizontally()
  headerStack.centerAlignContent()
  
  const titleText = headerStack.addText("LIFTEC Timer")
  titleText.font = FONTS.headline(15)
  titleText.textColor = COLORS.primary
  
  headerStack.addSpacer()
  
  const appIcon = headerStack.addImage(getIcon("app.fill"))
  appIcon.imageSize = new Size(18, 18)
  appIcon.tintColor = COLORS.textMuted
  appIcon.url = "scriptable:///run/" + encodeURIComponent(Script.name())
  
  widget.addSpacer(10)
  
  if (!session) {
    const statusText = widget.addText(t("noSession"))
    statusText.font = FONTS.body(14)
    statusText.textColor = COLORS.textSecondary
    
    widget.addSpacer()
    
    const startStack = widget.addStack()
    startStack.layoutHorizontally()
    startStack.centerAlignContent()
    startStack.url = "scriptable:///run/" + encodeURIComponent(Script.name()) + "?action=start"
    
    const playIcon = startStack.addImage(getIcon("play.circle.fill"))
    playIcon.imageSize = new Size(40, 40)
    playIcon.tintColor = COLORS.success
    
    startStack.addSpacer(12)
    
    const startText = startStack.addText(t("startSession"))
    startText.font = FONTS.headline(16)
    startText.textColor = COLORS.success
  } else {
    const mainStack = widget.addStack()
    mainStack.layoutHorizontally()
    
    const leftStack = mainStack.addStack()
    leftStack.layoutVertically()
    leftStack.spacing = 4
    
    const startLabel = leftStack.addText(t("start"))
    startLabel.font = FONTS.caption(11)
    startLabel.textColor = COLORS.textSecondary
    
    const startTime = formatTime(new Date(session.start))
    const startText = leftStack.addText(startTime)
    startText.font = FONTS.headline(18)
    startText.textColor = COLORS.text
    
    leftStack.addSpacer(6)
    
    const durationLabel = leftStack.addText(t("duration"))
    durationLabel.font = FONTS.caption(11)
    durationLabel.textColor = COLORS.textSecondary
    
    const duration = formatDuration(session.start)
    const timeText = leftStack.addText(duration)
    timeText.font = FONTS.mono(26)
    timeText.textColor = COLORS.primary
    
    leftStack.addSpacer(2)
    const tasksCountStack = leftStack.addStack()
    tasksCountStack.layoutHorizontally()
    const tasksText = tasksCountStack.addText(t("tasksCount").replace("{count}", session.tasks.length))
    tasksText.font = FONTS.caption(11)
    tasksText.textColor = COLORS.textSecondary
    
    mainStack.addSpacer()
    
    const rightStack = mainStack.addStack()
    rightStack.layoutVertically()
    rightStack.spacing = 12
    rightStack.centerAlignContent()
    
    const addStack = rightStack.addStack()
    addStack.layoutVertically()
    addStack.centerAlignContent()
    addStack.url = "scriptable:///run/" + encodeURIComponent(Script.name()) + "?action=addTask"
    
    const addIcon = addStack.addImage(createPlusIcon(40, COLORS.primary))
    addIcon.imageSize = new Size(40, 40)
    
    const stopStack = rightStack.addStack()
    stopStack.layoutVertically()
    stopStack.centerAlignContent()
    stopStack.url = "scriptable:///run/" + encodeURIComponent(Script.name()) + "?action=stop"
    
    const stopIcon = stopStack.addImage(getIcon("stop.circle.fill"))
    stopIcon.imageSize = new Size(40, 40)
    stopIcon.tintColor = COLORS.warning
  }
  
  return widget
}

async function createLargeWidget() {
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.surface
  widget.setPadding(16, 16, 16, 16)
  
  const session = await readSession()
  
  const headerStack = widget.addStack()
  headerStack.layoutHorizontally()
  headerStack.centerAlignContent()
  
  const titleText = headerStack.addText("LIFTEC Timer")
  titleText.font = FONTS.headline(16)
  titleText.textColor = COLORS.primary
  
  headerStack.addSpacer()
  
  const appIcon = headerStack.addImage(getIcon("app.fill"))
  appIcon.imageSize = new Size(20, 20)
  appIcon.tintColor = COLORS.textMuted
  appIcon.url = "scriptable:///run/" + encodeURIComponent(Script.name())
  
  widget.addSpacer(12)
  
  if (!session) {
    const statusText = widget.addText(t("noSession"))
    statusText.font = FONTS.body(14)
    statusText.textColor = COLORS.textSecondary
    
    widget.addSpacer()
    
    const startStack = widget.addStack()
    startStack.layoutHorizontally()
    startStack.centerAlignContent()
    startStack.url = "scriptable:///run/" + encodeURIComponent(Script.name()) + "?action=start"
    
    const playIcon = startStack.addImage(getIcon("play.circle.fill"))
    playIcon.imageSize = new Size(50, 50)
    playIcon.tintColor = COLORS.success
    
    startStack.addSpacer(12)
    
    const startText = startStack.addText(t("startSession"))
    startText.font = FONTS.headline(18)
    startText.textColor = COLORS.success
  } else {
    const mainStack = widget.addStack()
    mainStack.layoutHorizontally()
    
    const leftStack = mainStack.addStack()
    leftStack.layoutVertically()
    
    const startLabel = leftStack.addText(t("start"))
    startLabel.font = FONTS.caption(11)
    startLabel.textColor = COLORS.textSecondary
    
    const startTime = formatTime(new Date(session.start))
    const startText = leftStack.addText(startTime)
    startText.font = FONTS.headline(20)
    startText.textColor = COLORS.text
    
    leftStack.addSpacer(12)
    
    const durationLabel = leftStack.addText(t("duration"))
    durationLabel.font = FONTS.caption(11)
    durationLabel.textColor = COLORS.textSecondary
    
    const duration = formatDuration(session.start)
    const timeText = leftStack.addText(duration)
    timeText.font = FONTS.mono(28)
    timeText.textColor = COLORS.primary
    
    leftStack.addSpacer(16)
    
    if (session.tasks.length > 0) {
      const taskHeader = leftStack.addText(t("tasksCount").replace("{count}", session.tasks.length))
      taskHeader.font = FONTS.caption(12)
      taskHeader.textColor = COLORS.textMuted
      
      leftStack.addSpacer(8)
      
      const tasksToShow = session.tasks.slice(0, 5)
      tasksToShow.forEach(task => {
        const taskText = task.type 
          ? `• ${task.description} [${task.type}]`
          : `• ${task.description}`
        const taskLabel = leftStack.addText(taskText)
        taskLabel.font = FONTS.caption(12)
        taskLabel.textColor = COLORS.darkGray
        taskLabel.lineLimit = 1
        leftStack.addSpacer(4)
      })
      
      if (session.tasks.length > 5) {
        const moreText = leftStack.addText(t("andMore").replace("{count}", session.tasks.length - 5))
        moreText.font = FONTS.caption(11)
        moreText.textColor = COLORS.textMuted
      }
    }
    
    mainStack.addSpacer()
    
    const rightStack = mainStack.addStack()
    rightStack.layoutVertically()
    rightStack.spacing = 16
    rightStack.centerAlignContent()
    
    const addStack = rightStack.addStack()
    addStack.layoutVertically()
    addStack.centerAlignContent()
    addStack.url = "scriptable:///run/" + encodeURIComponent(Script.name()) + "?action=addTask"
    
    const addIcon = addStack.addImage(createPlusIcon(44, COLORS.primary))
    addIcon.imageSize = new Size(44, 44)
    
    const stopStack = rightStack.addStack()
    stopStack.layoutVertically()
    stopStack.centerAlignContent()
    stopStack.url = "scriptable:///run/" + encodeURIComponent(Script.name()) + "?action=stop"
    
    const stopIcon = stopStack.addImage(getIcon("stop.circle.fill"))
    stopIcon.imageSize = new Size(44, 44)
    stopIcon.tintColor = COLORS.warning
  }
  
  return widget
}

async function handleWidgetAction(action) {
  if (action === "start") {
    await flowStartSession()
  } else if (action === "addTask") {
    const session = await readSession()
    if (session) {
      await flowAddTask(session)
    }
  } else if (action === "stop") {
    const session = await readSession()
    if (session) {
      await flowEndSession(session)
    }
  }
}

async function runApp() {
  while (true) {
    const reopen = await showMainScreen()   // zeigt Main modal
    if (!reopen) break                      // App schließen (Close-Button)
    // wenn reopen===true: Main erneut öffnen (ohne Doppel-Stack)
  }
}

// ───────────────────────────────────────────────────────────────────────
// 🚀 MAIN ENTRY POINT - App Start
// ───────────────────────────────────────────────────────────────────────

if (config.runsInWidget) {
  const size = config.widgetFamily
  let widget
  if (size === "small") widget = await createSmallWidget()
  else if (size === "medium") widget = await createMediumWidget()
  else if (size === "large") widget = await createLargeWidget()
  else widget = await createSmallWidget()

  Script.setWidget(widget)
  Script.complete()
} else if (args.queryParameters.action) {
  await handleWidgetAction(args.queryParameters.action)
  App.close()
  Script.complete()
} else {
  await runApp()
}