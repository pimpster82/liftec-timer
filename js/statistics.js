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
   * @param {Object|null} [data] - bereits geladene Daten {entries}
   * @returns {Promise<number|null>} Saldo in Stunden, null ohne Stichtag
   */
  async calculateTimeAccountBalance(settings, upTo = new Date(), data = null) {
    const timeAccountSettings = settings?.workTimeTracking?.timeAccount;
    if (!timeAccountSettings) return null;

    const referenceDate = timeAccount.parseReferenceDate(timeAccountSettings.referenceDate);

    // Ohne Stichtag gibt es keine Basis. Ohne diesen Guard liefe die Schleife
    // ab dem 01.01.1970 über 20.000 Tage - mit absurdem Ergebnis.
    if (!referenceDate) return null;

    const allEntries = data?.entries ?? await storage.getAllWorklogEntries();
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
   * Leerer Zähler-Satz. An einer Stelle, damit Zeitraum und Zeitreihe
   * dieselben Felder haben.
   */
  emptyTotals() {
    return {
      actualHours: 0, targetHours: 0, balance: 0,
      workDays: 0, vacationDays: 0, sickDays: 0,
      holidayDays: 0, timeoffDays: 0, missingDays: 0
    };
  }

  /**
   * Verbucht EINEN Tag in einen Zähler-Satz.
   *
   * Die einzige Stelle, an der aus getDayBalance() Kennzahlen werden -
   * calculatePeriodSummary() und calculateSeries() teilen sie sich. Eine
   * zweite Fassung wäre genau der Fehler, vor dem der Kopfkommentar warnt.
   *
   * @returns {{actual: number, target: number}} der Tag selbst, damit der
   *   Aufrufer (actual - target) für die Zeitkonto-Linie weiterrechnen kann
   */
  accumulateDay(totals, date, entry, settings, runningDateStr = null, runningHours = 0) {
    const dateStr = callouts.formatDate(date);
    const day = this.getDayBalance(date, entry, settings);

    let actual = day.actual;
    let missing = day.missing;

    if (dateStr === runningDateStr) {
      actual += runningHours;
      missing = false;                     // Tag läuft noch, keine Schuld
    }

    totals.actualHours += actual;
    totals.targetHours += day.target;

    if (missing) {
      totals.missingDays++;
    } else if (entry) {
      switch (entry.entryType) {
        case 'vacation': totals.vacationDays += (entry.vacationDays ?? 1); break;
        case 'sick':     totals.sickDays++; break;
        case 'holiday':  totals.holidayDays++; break;
        case 'timeoff':
        case 'unpaid':   totals.timeoffDays++; break;
        default:
          if (entry.startTime && entry.endTime) totals.workDays++;
      }
    }

    return { actual, target: day.target };
  }

  /**
   * Alle Kennzahlen für einen Zeitraum.
   *
   * @param {Date} from - inklusive
   * @param {Date} to   - exklusiv
   * @param {Object} settings
   * @param {Object|null} session - laufende Session, falls vorhanden
   * @param {Object|null} data - bereits geladene Daten {entries, callouts, periods},
   *   siehe callouts.calculateOnCallHours(). Ohne sie lädt die Funktion selbst.
   */
  async calculatePeriodSummary(from, to, settings, session = null, data = null) {
    const allEntries = data?.entries ?? await storage.getAllWorklogEntries();

    const entryMap = new Map();
    for (const entry of allEntries) {
      entryMap.set(entry.date, entry);
    }

    const result = {
      ...this.emptyTotals(),
      onCallHours: 0, calloutHours: 0, calloutCount: 0,
      onCallEuro: null, onCallZaHours: null,
      hasRunningOnCall: false,
      // Anteil der laufenden Session an actualHours. Die Anzeige braucht ihn,
      // um den Wert im Sekundentakt fortschreiben zu können, ohne alles neu
      // zu rechnen: Basis = actualHours - runningHours.
      runningHours: 0,
      hasRunningSession: false
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
        result.runningHours = runningHours;
        result.hasRunningSession = true;
      }
    }

    // Tagesschleife
    const current = new Date(from);
    current.setHours(0, 0, 0, 0);

    while (current < to) {
      this.accumulateDay(
        result, current, entryMap.get(callouts.formatDate(current)),
        settings, runningDateStr, runningHours
      );

      current.setDate(current.getDate() + 1);
    }

    result.balance = result.actualHours - result.targetHours;

    // Bereitschaft: EIN Aufruf über den ganzen Zeitraum, exakt dieselbe
    // Funktion wie im Export - damit können beide nicht auseinanderlaufen
    const periods = await callouts.getOnCallPeriodsInWindow(from, to, data);
    result.onCallHours = periods.reduce((sum, p) => sum + p.hours, 0);
    result.hasRunningOnCall = periods.some(p => p.isRunning);

    // Einsätze
    const allCallouts = data?.callouts ?? await callouts.getAllCallouts();
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
    Object.assign(result, await this.calculateOnCallValue(from, to, settings, data));

    return result;
  }

  // ===== Zeitreihe über viele Zeiträume =====

  /**
   * Baut das Raster zusammenhängender Zeiträume, rückwärts von endDate.
   *
   * Bewusst über setMonth/setDate und die vorhandenen Bounds-Funktionen, nicht
   * über Millisekunden-Subtraktion: sonst verschiebt die Sommerzeitumstellung
   * das ganze Raster um eine Stunde.
   */
  buildBuckets(mode, endDate, count) {
    const isWeek = mode === 'week';
    const bounds = [];
    const cursor = new Date(endDate);

    for (let i = 0; i < count; i++) {
      bounds.unshift(isWeek
        ? this.getWeekBounds(cursor)
        : callouts.getMonthBounds(cursor.getFullYear(), cursor.getMonth() + 1));

      // Beim Monat erst auf den 1. setzen - sonst springt der 31. in den
      // übernächsten Monat zurück
      if (isWeek) cursor.setDate(cursor.getDate() - 7);
      else cursor.setMonth(cursor.getMonth() - 1, 1);
    }

    const now = new Date();

    return bounds.map((b, index) => ({
      index,
      start: b.start,
      end: b.end,                       // exklusiv
      year: b.start.getFullYear(),
      month: b.start.getMonth(),        // 0-11
      weekNumber: this.getWeekNumber(b.start),
      key: isWeek
        ? `${b.start.getFullYear()}-W${String(this.getWeekNumber(b.start)).padStart(2, '0')}`
        : `${b.start.getFullYear()}-${String(b.start.getMonth() + 1).padStart(2, '0')}`,
      isCurrent: now >= b.start && now < b.end,
      ...this.emptyTotals(),
      accountBalance: null,             // Zeitkonto am Ende, null vor dem Stichtag
      onCallHours: 0,
      calloutHours: 0,
      runningHours: 0,
      hasRunningSession: false
    }));
  }

  /**
   * Zeitreihe über mehrere Zeiträume - in EINEM Durchgang.
   *
   * Lädt genau einmal und rechnet danach nur noch. Die Tagesrechnung kommt
   * unverändert aus getDayBalance() über accumulateDay(), dieselbe wie in
   * calculatePeriodSummary().
   *
   * Die Zeitkonto-Linie entsteht als Nebenprodukt derselben Schleife: der
   * laufende Saldo wird ab dem Stichtag mitgeführt und an jeder Zeitraums-
   * grenze abgelesen. Sie ist damit die Zerlegung genau der Summe, die
   * calculateTimeAccountBalance() als Endwert liefert - keine zweite Rechnung.
   *
   * @returns {Promise<Object>} { mode, buckets, scale, accountAvailable, data }
   */
  async calculateSeries({ mode = 'month', endDate = new Date(), count = null,
                          settings, session = null, includeOnCall = false } = {}) {
    const isWeek = mode === 'week';
    const bucketCount = count ?? (isWeek ? 26 : 24);

    // Einmal laden - das ist der ganze Punkt dieser Funktion
    const [entries, calloutList, periodList] = await Promise.all([
      storage.getAllWorklogEntries(),
      includeOnCall ? callouts.getAllCallouts() : Promise.resolve([]),
      includeOnCall ? storage.getAllOnCallPeriods() : Promise.resolve([])
    ]);

    const data = { entries, callouts: calloutList, periods: periodList };
    const entryMap = new Map(entries.map(e => [e.date, e]));

    const timeAccountSettings = settings?.workTimeTracking?.timeAccount;
    const referenceDate = timeAccount.parseReferenceDate(timeAccountSettings?.referenceDate);
    const referenceBalance = timeAccountSettings?.referenceBalance || 0;

    let buckets = this.buildBuckets(mode, endDate, bucketCount);

    // Zeiträume abschneiden, in denen es weder Einträge noch ein Zeitkonto
    // geben kann - sonst klebt links eine Reihe leerer Balken
    const oldest = this.getEarliestEntryDate(entries);
    const dataStart = (oldest && referenceDate)
      ? (oldest < referenceDate ? oldest : referenceDate)
      : (oldest || referenceDate);

    if (dataStart) {
      while (buckets.length > 1 && buckets[0].end <= dataStart) buckets.shift();
      buckets.forEach((b, i) => { b.index = i; });
    }

    const gridStart = buckets[0].start;
    const gridEnd = buckets[buckets.length - 1].end;

    // Laufende Session: wie in calculatePeriodSummary
    let runningDateStr = null;
    let runningHours = 0;
    if (session?.start) {
      const start = new Date(session.start);
      if (start >= gridStart && start < gridEnd) {
        runningDateStr = callouts.formatDate(start);
        runningHours = Math.max(0, (Date.now() - start.getTime()) / 3600000);
      }
    }

    let running = 0;

    // Phase A - Vorlauf vom Stichtag bis zum Rasterbeginn. Nur der Saldo
    // läuft mit, es werden keine Zähler gefüllt.
    if (referenceDate && referenceDate < gridStart) {
      const cursor = new Date(referenceDate);
      const scratch = this.emptyTotals();

      while (cursor < gridStart) {
        const day = this.accumulateDay(
          scratch, cursor, entryMap.get(callouts.formatDate(cursor)), settings
        );
        running += (day.actual - day.target);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // Phase B - das Raster selbst
    const cursor = new Date(gridStart);
    let i = 0;

    while (cursor < gridEnd) {
      while (i < buckets.length - 1 && cursor >= buckets[i].end) {
        this._closeBucket(buckets[i], referenceDate, referenceBalance, running);
        i++;
      }

      const bucket = buckets[i];
      const dateStr = callouts.formatDate(cursor);
      const day = this.accumulateDay(
        bucket, cursor, entryMap.get(dateStr), settings, runningDateStr, runningHours
      );

      if (dateStr === runningDateStr) {
        bucket.runningHours = runningHours;
        bucket.hasRunningSession = true;
      }

      // Der Saldo zählt erst ab dem Stichtag
      if (referenceDate && cursor >= referenceDate) {
        running += (day.actual - day.target);
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    this._closeBucket(buckets[i], referenceDate, referenceBalance, running);

    for (const bucket of buckets) {
      bucket.balance = bucket.actualHours - bucket.targetHours;
    }

    // Bereitschaft: Perioden EINMAL für das ganze Raster, dann je Zeitraum
    // zuschneiden - nach demselben Muster wie getOnCallHoursByDay()
    if (includeOnCall) {
      const periods = await callouts.getOnCallPeriodsInWindow(gridStart, gridEnd, data);

      for (const bucket of buckets) {
        for (const period of periods) {
          const from = period.start > bucket.start ? period.start : bucket.start;
          const to = period.end < bucket.end ? period.end : bucket.end;
          if (to <= from) continue;

          bucket.onCallHours += await callouts.calculateOnCallHours(from, to, data);
          bucket.calloutHours += callouts.sumCalloutOverlapHours(calloutList, from, to);
        }
      }
    }

    return {
      mode,
      buckets,
      accountAvailable: !!referenceDate && buckets.some(b => b.accountBalance !== null),
      scale: this.getSeriesScale(buckets),
      data
    };
  }

  /**
   * Saldo am Ende eines Zeitraums festhalten. Vor dem Stichtag bleibt er
   * null - die Linie beginnt dort, wo sie definiert ist, statt eine Null
   * vorzutäuschen.
   */
  _closeBucket(bucket, referenceDate, referenceBalance, running) {
    bucket.accountBalance = (referenceDate && bucket.end > referenceDate)
      ? referenceBalance + running
      : null;
  }

  /**
   * Ältester Eintrag als Date. 'DD.MM.YYYY' muss geparst werden - ein
   * String-Vergleich lieferte hier falsche Ergebnisse.
   */
  getEarliestEntryDate(entries) {
    let earliest = null;

    for (const entry of entries || []) {
      if (!entry.date) continue;

      const [d, m, y] = entry.date.split('.').map(Number);
      if (!d || !m || !y) continue;

      const date = new Date(y, m - 1, d);
      if (!earliest || date < earliest) earliest = date;
    }

    return earliest;
  }

  /**
   * Achsengrenzen über die ganze Reihe. Bewusst hier und nicht im Renderer:
   * die Balken müssen über alle Zeiträume gemeinsam normalisiert sein, sonst
   * sähe ein Monat mit drei erfassten Tagen aus wie ein voller.
   */
  getSeriesScale(buckets) {
    const stack = (b) => b.workDays + b.vacationDays + b.sickDays
                       + b.holidayDays + b.timeoffDays + b.missingDays;

    const scale = {
      maxStackDays: 0, maxHours: 0,
      balanceMin: 0, balanceMax: 0,
      accountMin: 0, accountMax: 0,
      maxOnCallHours: 0
    };

    for (const b of buckets) {
      scale.maxStackDays = Math.max(scale.maxStackDays, stack(b));
      scale.maxHours = Math.max(scale.maxHours, b.actualHours, b.targetHours);
      scale.balanceMin = Math.min(scale.balanceMin, b.balance);
      scale.balanceMax = Math.max(scale.balanceMax, b.balance);
      scale.maxOnCallHours = Math.max(scale.maxOnCallHours, b.onCallHours);

      if (b.accountBalance !== null) {
        scale.accountMin = Math.min(scale.accountMin, b.accountBalance);
        scale.accountMax = Math.max(scale.accountMax, b.accountBalance);
      }
    }

    return scale;
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
  async calculateOnCallValue(from, to, settings, data = null) {
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

      const periods = await callouts.getOnCallPeriodsInWindow(sliceStart, sliceEnd, data);
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
