# ZA & Urlaub - Feature-Planung

**Erstellt:** 2025-12-13
**Feature-Name:** Arbeitszeitkonto & Urlaubsverwaltung (kurz: "ZA & Urlaub")
**Ziel:** Vollständige Arbeitszeitkonto- und Urlaubsverwaltung im LIFTEC Timer

---

## Anforderungen (vom Benutzer)

### ✅ Kernfunktionen

1. **Zeitkonto (ZA)**
   - Berechnung: IST-Stunden minus SOLL-Stunden
   - Kumuliertes Zeitkonto über Wochen/Monate
   - Startwert manuell einstellbar (vom Lohnzettel)
   - **Anpassung zum Monatsende möglich** (falls Abweichung zum Lohnzettel)

2. **Urlaubsverwaltung**
   - Jahresurlaub konfigurierbar (Standard: 25 Tage)
   - Automatisches Hinzufügen zum Eintrittsdatum
   - Resturlaub-Tracking
   - Urlaub als Eintrag erfassen

3. **Sollzeiten (Wochenplan)**
   - Konfiguration pro Wochentag (Mo-So)
   - Beispiel: Mo-Do 8,5h, Fr 4h = 38h/Woche
   - Flexibel für Teilzeit (z.B. nur Mo+Di 8,5h = 17h/Woche)

4. **Feiertage & Urlaub**
   - **IMMER als Soll erfüllt zählen**
   - Keine negativen Auswirkungen auf Zeitkonto
   - Urlaubstag = Sollzeit des Tages wird angerechnet

5. **Guided Walkthrough**
   - Beim ersten Aktivieren der Funktion
   - Abfrage aller wichtigen Daten (basierend auf letztem Lohnzettel):
     - Eintrittsdatum
     - Wochenplan (Mo-So)
     - Aktueller ZA-Stand (in Stunden)
     - Jahresurlaub (Tage)
     - Aktueller Resturlaub (Tage)

6. **KRITISCH: Excel-Export**
   - ⚠️ **NIEMALS Änderungen an excel-export.js ohne explizite Anfrage!**
   - Das Format ist exakt so wie benötigt
   - Falls ZA-Spalten gewünscht → VORHER fragen!

---

## Konzept & Lösungsansatz

### System-Architektur

**Basis:** Option 3 aus unserer Diskussion = "Flexibles Soll-System mit Ausnahmen"

```
Standard-Wochenplan (in Settings)
         ↓
Automatische Feiertags-Erkennung (bereits vorhanden!)
         ↓
Manuelle Ausnahmen (Urlaub, Krankenstand)
         ↓
Berechnung: IST - SOLL = Wochensaldo
         ↓
Zeitkonto = Summe aller Salden
```

---

## Datenmodell

### 1. Erweiterte Settings (storage.js)

```javascript
{
  key: 'app',
  data: {
    username: 'Daniel',
    language: 'de',
    surchargePercent: 50,
    cloudSync: false,

    // NEU: Zeitkonto & Urlaub
    workTimeTracking: {
      enabled: false,              // Feature aktiviert?
      onboardingCompleted: false,  // Walkthrough abgeschlossen?

      // Stammdaten
      employmentStartDate: '2020-03-15',  // Eintrittsdatum

      // Sollzeiten (Wochenplan)
      weeklyTargetHours: 38.0,     // Gesamt-Wochensoll
      dailyTargetHours: {          // Pro Tag (optional für Validierung)
        monday: 8.5,
        tuesday: 8.5,
        wednesday: 8.5,
        thursday: 8.5,
        friday: 4.0,
        saturday: 0,
        sunday: 0
      },

      // Zeitkonto
      timeAccount: {
        initialBalance: 12.5,       // Startwert vom Lohnzettel
        initialBalanceDate: '2025-01-01',  // Ab wann gilt der Startwert
        currentBalance: 14.3,       // Aktueller Stand (berechnet)
        lastCalculated: '2025-01-15'  // Letzte Berechnung
      },

      // Urlaub
      vacation: {
        annualDays: 25,             // Jahresurlaub
        currentYearRemaining: 18.5, // Resturlaub aktuelles Jahr
        lastYearCarryOver: 0        // Übertrag aus Vorjahr (optional)
      }
    }
  }
}
```

### 2. Erweiterte Worklog-Einträge (storage.js)

```javascript
{
  id: 123,
  date: '13.01.2025',
  startTime: '08:00',
  endTime: '17:00',
  pause: '00:30',
  travelTime: '01:00',
  surcharge: '00:00',
  tasks: [...],
  yearMonth: '2025-01',

  // NEU: Zeitkonto-Daten
  entryType: 'work',           // 'work', 'vacation', 'sick', 'holiday', 'unpaid'
  targetHours: 8.5,            // Sollzeit für diesen Tag
  actualHours: 8.5,            // Berechnete IST-Zeit (Cache)
  saldo: 0.0,                  // Tages-Saldo (IST - SOLL)
  timeAccountBalance: 14.3,    // Zeitkonto-Stand nach diesem Tag (kumuliert)

  // Falls Urlaub:
  vacationDays: 0.5,           // Anzahl Urlaubstage (0.5 = halber Tag)

  // Für manuelle Korrekturen:
  isManualAdjustment: false,   // Monatsende-Korrektur?
  adjustmentReason: null       // Grund der Anpassung
}
```

### 3. Neue Datenstruktur: Monatsabschlüsse (optional)

```javascript
// Store: 'monthlyClosings' (neu)
{
  id: auto-increment,
  yearMonth: '2025-01',
  closingDate: '2025-01-31',

  calculatedBalance: 12.5,     // Berechnetes Zeitkonto
  payrollBalance: 14.0,        // Laut Lohnzettel
  adjustment: 1.5,             // Differenz (angepasst)
  adjustmentReason: 'Lohnzettel-Korrektur Januar 2025',

  workDays: 21,
  vacationDays: 2,
  sickDays: 0,
  holidays: 1
}
```

---

## User Interface / Screens

### 1. Guided Walkthrough (beim ersten Aktivieren)

**Trigger:** Einstellungen → "ZA & Urlaub aktivieren" Button

**5 Schritte:**

```
Schritt 1/5: Eintrittsdatum
  → Datumspicker

Schritt 2/5: Vereinbarte Arbeitszeit
  → 7 Eingabefelder (Mo-So)
  → Auto-Summe: "Gesamt: 38,0 h/Woche"

Schritt 3/5: Aktueller Zeitkonto-Stand
  → Eingabefeld: +12,5 Stunden
  → Hinweis: "Laut letztem Lohnzettel"

Schritt 4/5: Urlaubsanspruch
  → Jahresurlaub: 25 Tage
  → Resturlaub: 18,5 Tage

Schritt 5/5: Zusammenfassung
  → Alle Daten nochmal anzeigen
  → [Zurück] [Einrichten ✓]
```

Nach Abschluss:
- `workTimeTracking.enabled = true`
- `onboardingCompleted = true`
- Neue UI-Elemente werden sichtbar

---

### 2. Dashboard-Erweiterung (Hauptbildschirm)

**Oben im Hauptbildschirm** (wenn Feature aktiviert):

```
┌─────────────────────────────────────┐
│ 💰 Zeitkonto: +14,5 Stunden         │
│ 🏖️ Resturlaub: 18,5 Tage            │
│                                     │
│ Diese Woche (KW 2):                 │
│   IST: 34,0h | SOLL: 34,0h | ±0h   │
│   Noch: Fr 4,0h                     │
└─────────────────────────────────────┘
```

**Alternativ:** Als ausklappbares Widget oder separater Tab

---

### 3. Wochenansicht (in Historie)

```
📊 Kalenderwoche 2 (06.01. - 12.01.2025)
─────────────────────────────────────────────

Mo 06.01  08:00-17:00 (0,5h)  8,5h  [Soll: 8,5h] ✓
Di 07.01  08:15-16:45 (0,5h)  8,0h  [Soll: 8,5h] -0,5h
Mi 08.01  Urlaub              0h    [Soll: 8,5h] ✓
Do 09.01  08:00-18:30 (0,5h)  10h   [Soll: 8,5h] +1,5h
Fr 10.01  08:00-12:00         4,0h  [Soll: 4,0h] ✓

─────────────────────────────────────────────
IST-Arbeitszeit: 30,5h
SOLL (inkl. Urlaub): 38,0h
Wochensaldo: -7,5h

💰 Zeitkonto davor: +22,0h
💰 Zeitkonto neu: +14,5h
```

---

### 4. Monatsansicht

```
📅 Januar 2025
─────────────────────────────────────────────

KW 1:  IST 38,5h | SOLL 38,0h | +0,5h
KW 2:  IST 30,5h | SOLL 38,0h | -7,5h
KW 3:  IST 42,0h | SOLL 38,0h | +4,0h
KW 4:  IST 38,0h | SOLL 38,0h | ±0h
KW 5:  IST 16,0h | SOLL 15,2h | +0,8h (Teilwoche)

─────────────────────────────────────────────
Monat gesamt:
  Arbeitstage: 19
  Urlaubstage: 2
  Feiertage: 1

  IST: 165,0h | SOLL: 167,2h | -2,2h

💰 Zeitkonto 31.12.: +16,7h
💰 Zeitkonto 31.01.: +14,5h

[Zeitkonto anpassen] (für Lohnzettel-Korrektur)
```

---

### 5. Eintrag erstellen/bearbeiten (erweitert)

**Beim Eintrag hinzufügen:**

```
📝 Neuer Eintrag für Mo, 13.01.2025
─────────────────────────────────────

⚫ Normaler Arbeitstag
   Start: [08:00]
   Ende:  [17:00]
   Pause: [00:30]

⚪ Urlaub
   Ganze(r) Tag: ☐ (= 8,5h)
   Halber Tag:   ☐ (= 4,25h)

⚪ Krankenstand (= 8,5h Soll erfüllt)

⚪ Feiertag (automatisch erkannt)

⚪ Unbezahlter Urlaub (kein Soll)

─────────────────────────────────────
Sollzeit für diesen Tag: 8,5h
(aus deinem Wochenplan)

[Abbrechen] [Speichern]
```

---

### 6. Zeitkonto-Anpassung (Monatsende)

```
💰 Zeitkonto anpassen
─────────────────────────────────────

Monat: [Januar 2025 ▼]

Berechneter Stand: +12,5 Stunden
Laut Lohnzettel:   [+14,0] Stunden

Differenz: -1,5 Stunden

Grund (optional):
[Lohnzettel-Korrektur Januar 2025___]

─────────────────────────────────────

ℹ️ Diese Anpassung wird als separater
   Eintrag gespeichert und ist in der
   Historie sichtbar.

[Abbrechen] [Anpassen ✓]
```

---

## Berechnungslogik

### Tages-Sollzeit ermitteln

```javascript
function getDailyTargetHours(date, settings) {
  const dayOfWeek = date.getDay(); // 0=So, 1=Mo, ..., 6=Sa

  // 1. Ist es ein Feiertag?
  if (isHoliday(date)) {
    // Sollzeit des Wochentags (wird als "erfüllt" gezählt)
    return settings.dailyTargetHours[dayOfWeek];
  }

  // 2. Normal: Wochenplan
  return settings.dailyTargetHours[dayOfWeek];
}
```

### Tages-IST-Zeit berechnen

```javascript
function getActualHours(entry) {
  if (entry.entryType === 'vacation' ||
      entry.entryType === 'sick' ||
      entry.entryType === 'holiday') {
    // Urlaub/Krank/Feiertag = Sollzeit wird als IST gezählt
    return entry.targetHours;
  }

  if (entry.entryType === 'unpaid') {
    return 0; // Unbezahlter Urlaub
  }

  // Normal: Start-Ende-Pause berechnen
  const start = parseTime(entry.startTime);
  const end = parseTime(entry.endTime);
  const pause = parseTime(entry.pause);

  return (end - start) - pause;
}
```

### Wochensaldo berechnen

```javascript
function getWeeklySaldo(weekEntries, settings) {
  let totalActual = 0;
  let totalTarget = 0;

  for (const entry of weekEntries) {
    totalActual += getActualHours(entry);
    totalTarget += entry.targetHours;
  }

  return totalActual - totalTarget;
}
```

### Zeitkonto aktualisieren

```javascript
async function updateTimeAccount(newEntry) {
  const settings = await storage.getSettings();
  const workTimeTracking = settings.workTimeTracking;

  // 1. Tages-Sollzeit ermitteln
  newEntry.targetHours = getDailyTargetHours(newEntry.date, workTimeTracking);

  // 2. IST-Zeit berechnen
  newEntry.actualHours = getActualHours(newEntry);

  // 3. Tages-Saldo
  newEntry.saldo = newEntry.actualHours - newEntry.targetHours;

  // 4. Zeitkonto kumulieren
  const previousBalance = workTimeTracking.timeAccount.currentBalance;
  newEntry.timeAccountBalance = previousBalance + newEntry.saldo;

  // 5. Settings aktualisieren
  workTimeTracking.timeAccount.currentBalance = newEntry.timeAccountBalance;
  workTimeTracking.timeAccount.lastCalculated = new Date().toISOString();

  await storage.updateSettings(settings);
}
```

### Urlaubstage abziehen

```javascript
async function createVacationEntry(date, isFullDay) {
  const settings = await storage.getSettings();
  const targetHours = getDailyTargetHours(date, settings.workTimeTracking);

  const entry = {
    date: formatDate(date),
    entryType: 'vacation',
    targetHours: targetHours,
    actualHours: targetHours,  // Urlaub = Sollzeit erfüllt!
    saldo: 0,                   // Kein Minus
    vacationDays: isFullDay ? 1 : 0.5,
    startTime: '',
    endTime: '',
    pause: '',
    tasks: []
  };

  // Zeitkonto aktualisieren
  await updateTimeAccount(entry);

  // Resturlaub reduzieren
  settings.workTimeTracking.vacation.currentYearRemaining -= entry.vacationDays;
  await storage.updateSettings(settings);

  return entry;
}
```

---

## Implementierungsplan

### Phase 1: Datenmodell & Backend (storage.js)

**Dateien:**
- `js/storage.js`

**Aufgaben:**
1. Settings-Schema erweitern (workTimeTracking)
2. Worklog-Schema erweitern (entryType, targetHours, saldo, etc.)
3. Methoden hinzufügen:
   - `getWeeklyEntries(weekNumber, year)`
   - `getMonthlyStats(yearMonth)`
   - `updateTimeAccount(entry)`
   - `adjustTimeAccount(yearMonth, newBalance, reason)`
   - `createVacationEntry(date, days)`
4. Migration für bestehende Einträge (alte Einträge bekommen `entryType: 'work'`)

**Zeitaufwand:** ~3-4h

---

### Phase 2: Berechnungslogik (neue Datei: time-account.js)

**Dateien:**
- `js/time-account.js` (neu)

**Aufgaben:**
1. Funktionen für Berechnungen:
   - `getDailyTargetHours(date, settings)`
   - `getActualHours(entry)`
   - `calculateWeeklySaldo(entries, settings)`
   - `calculateMonthlyStats(yearMonth, settings)`
   - `recalculateTimeAccount(fromDate, settings)` (für Korrekturen)
2. Feiertags-Integration (bereits vorhanden, nur nutzen!)
3. Teilwochen-Logik (Monatsübergänge)

**Zeitaufwand:** ~2-3h

---

### Phase 3: Onboarding Walkthrough (app.js + ui.js)

**Dateien:**
- `js/app.js`
- `js/ui.js`

**Aufgaben:**
1. Walkthrough-Dialog (5 Schritte)
2. Validierung der Eingaben
3. Settings speichern
4. Translations (de, en, hr) hinzufügen
5. Button in Einstellungen: "ZA & Urlaub einrichten"

**Zeitaufwand:** ~3-4h

---

### Phase 4: Dashboard & Hauptbildschirm (app.js + ui.js)

**Dateien:**
- `js/app.js`
- `js/ui.js`

**Aufgaben:**
1. Zeitkonto-Widget im Hauptbildschirm
2. Wochenübersicht anzeigen
3. Icons für ZA und Urlaub
4. Responsive Design (Mobile!)

**Zeitaufwand:** ~2h

---

### Phase 5: Historie erweitern (app.js)

**Dateien:**
- `js/app.js`

**Aufgaben:**
1. Wochenansicht mit Saldo
2. Monatsansicht mit Statistiken
3. Filter: "Nur Urlaub", "Nur Arbeitstage", etc.
4. Zeitkonto-Verlauf (Graph optional)

**Zeitaufwand:** ~4-5h

---

### Phase 6: Einträge erweitern (app.js + ui.js)

**Dateien:**
- `js/app.js`
- `js/ui.js`

**Aufgaben:**
1. Eintrag-Dialog erweitern (Art des Eintrags)
2. Urlaubs-Eintrag erstellen
3. Krankenstand-Eintrag
4. Validierung (Resturlaub prüfen)
5. UI für "halber/ganzer Urlaubstag"

**Zeitaufwand:** ~3h

---

### Phase 7: Monatsende-Anpassung (app.js)

**Dateien:**
- `js/app.js`
- `js/ui.js`

**Aufgaben:**
1. Dialog für Zeitkonto-Anpassung
2. Differenz berechnen und anzeigen
3. Korrektur-Eintrag erstellen
4. Historie: Korrekturen sichtbar machen

**Zeitaufwand:** ~2h

---

### Phase 8: Testing & Polish

**Aufgaben:**
1. Offline-Test
2. Mobile-Test (iOS Safari, Android Chrome)
3. Edge Cases testen:
   - Teilwochen
   - Feiertage am Wochenende
   - Negative Zeitkonten
   - Jahr-Übergang (Urlaubsübertrag)
4. Performance (große Datenmengen)
5. Translations vervollständigen

**Zeitaufwand:** ~4-5h

---

### Phase 9: Dokumentation

**Dateien:**
- `CLAUDE.md` (Update)
- `version.json` (Changelog)

**Aufgaben:**
1. Excel-Export Warnung hinzufügen (KRITISCH!)
2. Feature-Dokumentation
3. Changelog schreiben
4. Screenshots/Beispiele (optional)

**Zeitaufwand:** ~1h

---

**Gesamt-Zeitaufwand:** ~25-30h (aufgeteilt in Sprints möglich)

---

## Offene Fragen

### 1. Feiertage bei flexiblem Wochenplan

**Beispiel:** Deine Frau (kein fester Wochenplan, nur 20h/Woche Soll)

**Frage:** Wie soll Feiertag am Montag behandelt werden?

**Option A:** Feiertag zählt nicht (Wochen-Soll bleibt 20h)
```
KW mit Feiertag am Mo:
  IST: 17h (Di+Mi gearbeitet)
  SOLL: 20h
  Saldo: -3h
```

**Option B:** Feiertag = Durchschnittswert
```
Durchschnitt: 20h / 2,5 Arbeitstage = 8h pro Tag
→ Feiertag = 8h

KW mit Feiertag:
  IST: 17h + 8h (Feiertag) = 25h
  SOLL: 20h
  Saldo: +5h
```

**Empfehlung:** Option A (einfacher, keine Verzerrung)

---

### 2. Urlaubs-Jahreswechsel

**Frage:** Soll Resturlaub automatisch ins neue Jahr übertragen werden?

**Option A:** Automatisch übertragen (bis 31.03. des Folgejahres)
**Option B:** Manuell durch Benutzer
**Option C:** Konfigurierbar in Settings

**Empfehlung:** Option C (österreichisches Arbeitsrecht beachten!)

---

### 3. Zeitkonto-Limit

**Frage:** Gibt es bei euch Obergrenzen für Zeitkonto?
- z.B. "Max. +60h / -40h"
- Warnung bei Überschreitung?

**Empfehlung:** Optional in Settings, default: kein Limit

---

### 4. Export-Erweiterung

**Frage:** Sollen ZA-Daten in Export?

**WICHTIG:** Excel-Export NICHT ändern (außer du willst es explizit!)

**Option A:** Nur CSV erweitern
**Option B:** Neuer "ZA-Export" (separater Button)
**Option C:** Gar nicht erweitern

**Empfehlung:** Option B (separater Export für Lohnverrechnung)

---

### 5. Mehrbenutzer-Fähigkeit

**Frage:** Soll der Timer mehrere Benutzer-Profile unterstützen?
- "Daniel" und "Deine Frau" in einer App?
- Oder zwei separate Installationen?

**Aktuell:** Eine Installation = Ein Benutzer

**Empfehlung:** Erst mal Single-User, später Multi-User als Option

---

## Prioritäten / MVP

Falls du **nicht alles auf einmal** willst, hier die Minimum Viable Product Version:

### MVP (Version 1.12.0)

**Must-Have:**
✅ Wochenplan (Sollzeiten)
✅ Zeitkonto-Berechnung (Wochen-Saldo)
✅ Urlaub als Eintrag (reduziert Resturlaub)
✅ Feiertage = Sollzeit erfüllt
✅ Onboarding Walkthrough
✅ Dashboard-Widget (Zeitkonto anzeigen)

**Nice-to-Have (später):**
⏳ Monatsabschluss-Korrektur
⏳ Detaillierte Statistiken
⏳ Urlaubs-Jahresübertrag
⏳ Export-Erweiterung
⏳ Mehrbenutzer

---

## Nächste Schritte

1. **Du:** Review dieses Dokument
2. **Du:** Offene Fragen beantworten
3. **Ich:** CLAUDE.md aktualisieren (Excel-Warnung!)
4. **Ich:** Detaillierten Code-Plan erstellen
5. **Du:** Freigabe für Implementierung
6. **Ich:** Phase für Phase umsetzen

---

## Änderungshistorie

- **2025-12-13:** Initiales Planungsdokument erstellt
