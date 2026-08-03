// LIFTEC Timer - Auswertungen über Zeiträume
//
// Hier steht die Aggregation für Woche und Monat. Die Tagesberechnung
// (getDayBalance) liegt bewusst ebenfalls hier und nicht im UI-Controller:
// app.recalculateTimeAccountBalance() und die Statistik müssen dieselbe
// Rechnung benutzen. In dieser App sind schon mehrfach Fehler dadurch
// entstanden, dass dieselbe Logik an zwei Stellen lag und auseinanderlief.

class Statistics {

  // ===== Zeiträume =====

  /**
   * Wochengrenzen, Montag bis Sonntag. Ende exklusiv, wie getMonthBounds().
   */
  getWeekBounds(date) {
    const start = new Date(date);
    const dayOfWeek = start.getDay();               // 0 = Sonntag
    start.setDate(start.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    return { start, end };
  }

  /**
   * ISO-8601-Kalenderwoche
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  // ===== Tagesberechnung =====

  /**
   * Ist- und Sollstunden EINES Tages.
   *
   * Regeln:
   *   - Urlaub/Krankenstand/Feiertag: Soll auf 0 -> saldoneutral
   *   - Zeitausgleich/unbezahlt: Ist 0, Soll bleibt -> verbraucht Überstunden
   *   - Tag ohne Eintrag: Soll als Schuld, ausser an Feiertagen
   *
   * @param {Date} date
   * @param {Object|undefined} entry - Worklog-Eintrag dieses Tages, falls vorhanden
   * @param {Object} settings
   * @returns {{actual: number, target: number, missing: boolean}}
   */
  getDayBalance(date, entry, settings) {
    if (entry) {
      // Historisches Soll aus dem Eintrag bevorzugen. Bewusst ?? statt ||:
      // ein gespeichertes Soll von 0 (Wochenende, Abwesenheit) ist gültig und
      // darf nicht auf die aktuellen Einstellungen zurückfallen.
      let target = entry.targetHours ?? timeAccount.getDailyTargetHours(date, settings);

      if (entry.entryType === 'vacation' ||
          entry.entryType === 'sick' ||
          entry.entryType === 'holiday') {
        target = 0;
      }

      return {
        actual: timeAccount.getActualHours(entry, settings),
        target,
        missing: false
      };
    }

    // Kein Eintrag: Werktag ohne Erfassung ist eine Schuld, Feiertage sind neutral
    const target = timeAccount.getDailyTargetHours(date, settings);

    if (target > 0 && !austrianHolidays.isHoliday(callouts.formatDate(date)).isHoliday) {
      return { actual: 0, target, missing: true };
    }

    return { actual: 0, target: 0, missing: false };
  }

  /**
   * Zeitkonto-Saldo vom Stichtag bis einschliesslich eines Tages.
   *
   * Der laufende Tag zählt mit: ein Werktag ohne Eintrag ist eine Schuld in
   * Höhe des Tagessolls. Wer heute noch arbeitet, hat also erst einmal ein
   * Minus, das die laufende Session Stunde um Stunde auffüllt.
   *
   * @param {Object} settings
   * @param {Date} [upTo] - letzter Tag, der zählt (Vorgabe: heute)
   * @returns {Promise<number|null>} Saldo in Stunden, null ohne Stichtag
   */
  async calculateTimeAccountBalance(settings, upTo = new Date()) {
    const timeAccountSettings = settings?.workTimeTracking?.timeAccount;
    if (!timeAccountSettings) return null;

    const referenceDate = app.parseReferenceDate(timeAccountSettings.referenceDate);

    // Ohne Stichtag gibt es keine Basis. Ohne diesen Guard liefe die Schleife
    // ab dem 01.01.1970 über 20.000 Tage - mit absurdem Ergebnis.
    if (!referenceDate) return null;

    const allEntries = await storage.getAllWorklogEntries();
    const entryMap = new Map();
    for (const entry of allEntries) {
      entryMap.set(entry.date, entry);
    }

    const last = new Date(upTo);
    last.setHours(23, 59, 59, 999);

    let change = 0;
    const cursor = new Date(referenceDate);

    while (cursor <= last) {
      const day = this.getDayBalance(cursor, entryMap.get(callouts.formatDate(cursor)), settings);
      change += (day.actual - day.target);
      cursor.setDate(cursor.getDate() + 1);
    }

    return (timeAccountSettings.referenceBalance || 0) + change;
  }

  // ===== Auswertung eines Zeitraums =====

  /**
   * Alle Kennzahlen für einen Zeitraum.
   *
   * @param {Date} from - inklusive
   * @param {Date} to   - exklusiv
   * @param {Object} settings
   * @param {Object|null} session - laufende Session, falls vorhanden
   */
  async calculatePeriodSummary(from, to, settings, session = null) {
    const allEntries = await storage.getAllWorklogEntries();

    const entryMap = new Map();
    for (const entry of allEntries) {
      entryMap.set(entry.date, entry);
    }

    const result = {
      actualHours: 0, targetHours: 0, balance: 0,
      workDays: 0, vacationDays: 0, sickDays: 0,
      holidayDays: 0, timeoffDays: 0, missingDays: 0,
      onCallHours: 0, calloutHours: 0, calloutCount: 0,
      onCallEuro: null, onCallZaHours: null,
      hasRunningOnCall: false
    };

    // Laufende Session: Tag und bisher gelaufene Dauer merken, damit der
    // heutige Tag nicht als Fehltag mit vollem Soll erscheint
    let runningDateStr = null;
    let runningHours = 0;
    if (session?.start) {
      const start = new Date(session.start);
      if (start >= from && start < to) {
        runningDateStr = callouts.formatDate(start);
        runningHours = Math.max(0, (Date.now() - start.getTime()) / 3600000);
      }
    }

    // Tagesschleife
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);

    while (current < to) {
      const dateStr = callouts.formatDate(current);
      const entry = entryMap.get(dateStr);
      const day = this.getDayBalance(current, entry, settings);

      result.actualHours += day.actual;
      result.targetHours += day.target;

      if (dateStr === runningDateStr) {
        result.actualHours += runningHours;
        if (day.missing) day.missing = false;   // Tag läuft noch, keine Schuld
      }

      if (day.missing) {
        result.missingDays++;
      } else if (entry) {
        switch (entry.entryType) {
          case 'vacation': result.vacationDays += (entry.vacationDays ?? 1); break;
          case 'sick':     result.sickDays++; break;
          case 'holiday':  result.holidayDays++; break;
          case 'timeoff':
          case 'unpaid':   result.timeoffDays++; break;
          default:
            if (entry.startTime && entry.endTime) result.workDays++;
        }
      }

      current.setDate(current.getDate() + 1);
    }

    result.balance = result.actualHours - result.targetHours;

    // Bereitschaft: EIN Aufruf über den ganzen Zeitraum, exakt dieselbe
    // Funktion wie im Export - damit können beide nicht auseinanderlaufen
    const periods = await callouts.getOnCallPeriodsInWindow(from, to);
    result.onCallHours = periods.reduce((sum, p) => sum + p.hours, 0);
    result.hasRunningOnCall = periods.some(p => p.isRunning);

    // Einsätze
    const allCallouts = await callouts.getAllCallouts();
    const groups = new Set();
    for (const callout of allCallouts) {
      const interval = callouts.getCalloutInterval(callout);
      const overlap = callouts.overlapHours(from, to, interval.start, interval.end);
      if (overlap > 0) {
        result.calloutHours += overlap;
        groups.add(callout.groupId);
      }
    }
    result.calloutCount = groups.size;

    // Umrechnung in Euro und Zeitausgleich
    Object.assign(result, await this.calculateOnCallValue(from, to, settings));

    return result;
  }

  /**
   * Bereitschaft in Euro und den daraus folgenden Zeitausgleich.
   *
   * Der Zeitraum wird an den Satzwechseln zerschnitten, damit ein Lohnwechsel
   * mitten im Monat korrekt abgebildet wird. Im Normalfall ist das genau ein
   * Teilfenster.
   *
   * Bewusst nicht tageweise: Bei einem Einsatz, der sich mit einer Schicht
   * überschneidet, würde jede Tagesrechnung einzeln bei 0 gekappt und die
   * Summe von der Fensterrechnung abweichen. Satzwechsel sind selten,
   * Tagesgrenzen gibt es 30-mal pro Monat.
   */
  async calculateOnCallValue(from, to, settings) {
    const history = settings?.workTimeTracking?.rateHistory || [];

    // Schnittpunkte: Fensteranfang plus jeder Satzwechsel innerhalb des Fensters
    const cuts = [from];
    for (const rate of history) {
      const parts = String(rate.validFrom || '').split('-').map(Number);
      if (parts.length !== 3) continue;

      const boundary = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
      if (boundary > from && boundary < to) cuts.push(boundary);
    }
    cuts.sort((a, b) => a - b);
    cuts.push(to);

    let euro = 0;
    let anyRate = false;

    for (let i = 0; i < cuts.length - 1; i++) {
      const sliceStart = cuts[i];
      const sliceEnd = cuts[i + 1];
      if (sliceEnd <= sliceStart) continue;

      const rate = timeAccount.getRateForDate(sliceStart, settings);
      if (!rate.onCallRate) continue;

      const periods = await callouts.getOnCallPeriodsInWindow(sliceStart, sliceEnd);
      const hours = periods.reduce((sum, p) => sum + p.hours, 0);

      euro += hours * rate.onCallRate;
      anyRate = true;
    }

    // Ohne gepflegten Satz oder Lohn wird nichts angezeigt, statt mit
    // erfundenen Zahlen zu rechnen
    const wage = timeAccount.getRateForDate(new Date(to.getTime() - 1), settings).hourlyWage;

    if (!anyRate || !wage) {
      return { onCallEuro: anyRate ? euro : null, onCallZaHours: null };
    }

    return { onCallEuro: euro, onCallZaHours: euro / wage };
  }
}

// Singleton-Instanz
const statistics = new Statistics();

// Für Node-basierte Tests (im Browser nicht vorhanden)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Statistics, statistics };
}
