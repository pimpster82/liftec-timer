// LIFTEC Timer - Bereitschaftseinsätze (Callouts) & Intervall-Mathematik
//
// Dieses Modul hat zwei Aufgaben:
// 1. Die gemeinsame Zeit-/Intervall-Mathematik für Bereitschaft und Arbeitszeit.
//    Sie lag früher dreifach dupliziert in app.js, csv.js und excel-export.js
//    und war in allen drei Kopien fehlerhaft (ganze Schicht statt Überlappung,
//    Nachtschichten negativ). Jetzt gibt es genau eine Implementierung.
// 2. Die Verwaltung der Einsätze während einer Bereitschaft. Einsätze werden
//    an Mitternacht gesplittet gespeichert, damit jedes Segment eindeutig zu
//    einem Kalendertag gehört.

class Callouts {

  // ===== Zeit-Helfer =====

  // 'DD.MM.YYYY' + 'HH:MM' -> Date
  // '24:00' ist erlaubt und ergibt Mitternacht des Folgetags
  parseDateTime(dateStr, timeStr) {
    const [day, month, year] = dateStr.split('.').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }

  // Date -> 'DD.MM.YYYY'
  formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // Date -> 'HH:MM'
  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Dezimalstunden -> 'HH:MM' (auch >24h, z.B. '123:45')
  hoursToHHMM(hours) {
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // 'DD.MM.YYYY' -> 'YYYY-MM'
  toYearMonth(dateStr) {
    const [, month, year] = dateStr.split('.');
    return `${year}-${month.padStart(2, '0')}`;
  }

  // Ende-Beschriftung: Mitternacht wird als '24:00' des Vortags dargestellt,
  // damit ein auf Monatsende geclamptes Ende im Juli-Blatt auch nach Juli aussieht
  formatEndLabel(date) {
    if (date.getHours() === 0 && date.getMinutes() === 0) {
      const prev = new Date(date.getTime() - 60000);
      return `${this.formatDate(prev)} 24:00`;
    }
    return `${this.formatDate(date)} ${this.formatTime(date)}`;
  }

  // Monatsgrenzen, Ende exklusiv (Mitternacht des Folgemonats)
  getMonthBounds(year, month) {
    return {
      start: new Date(year, month - 1, 1, 0, 0),
      end: new Date(year, month, 1, 0, 0)
    };
  }

  // ===== Intervall-Mathematik =====

  // Überlappung zweier Zeitintervalle in Stunden (0 wenn sie sich nicht schneiden)
  overlapHours(aStart, aEnd, bStart, bEnd) {
    const start = Math.max(aStart.getTime(), bStart.getTime());
    const end = Math.min(aEnd.getTime(), bEnd.getTime());
    return Math.max(0, end - start) / 3600000;
  }

  // Tatsächliches Zeitintervall einer Schicht aus einem Worklog-Eintrag.
  // Ein Eintrag speichert nur das Startdatum. Ist die Endzeit kleiner als die
  // Startzeit, endet die Schicht am Folgetag (Nachtschicht).
  getShiftInterval(entry) {
    if (!entry || !entry.startTime || !entry.endTime) return null;

    const start = this.parseDateTime(entry.date, entry.startTime);
    const end = this.parseDateTime(entry.date, entry.endTime);

    if (end < start) {
      end.setDate(end.getDate() + 1);
    }

    if (end <= start) return null;

    return { start, end };
  }

  // Brutto-Arbeitsstunden einer Schicht (Ende - Start), nachtschichtsicher
  getShiftHours(entry) {
    const interval = this.getShiftInterval(entry);
    if (!interval) return 0;
    return (interval.end - interval.start) / 3600000;
  }

  // Netto-Arbeitszeit eines Eintrags: (Ende - Start) - Pause.
  // Fahrtzeit bleibt drin - konsistent zu app.calculateWorkHours()
  getNetWorkHours(entry) {
    const gross = this.getShiftHours(entry);
    if (gross === 0) return 0;

    const pause = entry.pause ? this._timeToHours(entry.pause) : 0;
    return Math.max(0, gross - pause);
  }

  _timeToHours(timeStr) {
    if (!timeStr) return 0;
    const parts = String(timeStr).split(':');
    if (parts.length !== 2) return 0;
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h + (m / 60);
  }

  // ===== Bereitschafts-Berechnung (die einzige gültige Implementierung) =====

  /**
   * Bereitschaftsstunden in einem Zeitfenster.
   * Bereitschaft = Fensterdauer - überlappende Arbeitszeit - überlappende Einsätze.
   * Es wird nur der Teil einer Schicht abgezogen, der tatsächlich im Fenster liegt.
   */
  async calculateOnCallHours(windowStart, windowEnd) {
    const totalHours = (windowEnd - windowStart) / 3600000;
    if (totalHours <= 0) return 0;

    // Einen Tag Puffer davor abfragen: eine Nachtschicht des Vortags ist unter
    // dem Vortagsdatum gespeichert, ragt aber ins Fenster hinein
    const queryFrom = new Date(windowStart);
    queryFrom.setDate(queryFrom.getDate() - 1);

    let deducted = 0;

    try {
      const entries = await storage.getEntriesByDateRange(
        this.formatDate(queryFrom),
        this.formatDate(windowEnd)
      );

      for (const entry of entries) {
        const shift = this.getShiftInterval(entry);
        if (!shift) continue;
        deducted += this.overlapHours(windowStart, windowEnd, shift.start, shift.end);
      }
    } catch (error) {
      console.error('Error loading worklog entries for on-call calculation:', error);
    }

    // Einsätze zählen als Arbeit, nicht als Bereitschaft
    deducted += await this.getCalloutHoursInWindow(windowStart, windowEnd);

    return Math.max(0, totalHours - deducted);
  }

  // ===== Einsätze: Speicherung =====

  /**
   * Zerlegt einen Einsatz an Mitternacht in Tagessegmente.
   * 22:00 -> 02:00 wird zu [{05.07. 22:00-24:00}, {06.07. 00:00-02:00}]
   */
  splitAtMidnight(dateStr, startTime, endTime) {
    const start = this.parseDateTime(dateStr, startTime);
    const end = this.parseDateTime(dateStr, endTime);

    if (end <= start) {
      end.setDate(end.getDate() + 1);
    }

    const segments = [];
    let segmentStart = new Date(start);

    // Sicherheitsnetz gegen Endlosschleifen bei absurden Eingaben
    let guard = 0;

    while (segmentStart < end && guard < 100) {
      guard++;

      const nextMidnight = new Date(
        segmentStart.getFullYear(),
        segmentStart.getMonth(),
        segmentStart.getDate() + 1,
        0, 0
      );

      const segmentEnd = nextMidnight < end ? nextMidnight : end;
      const endsAtMidnight = segmentEnd.getHours() === 0 && segmentEnd.getMinutes() === 0;

      segments.push({
        date: this.formatDate(segmentStart),
        startTime: this.formatTime(segmentStart),
        endTime: endsAtMidnight ? '24:00' : this.formatTime(segmentEnd)
      });

      segmentStart = segmentEnd;
    }

    return segments;
  }

  /**
   * Legt einen Einsatz an. Über Mitternacht laufende Einsätze werden als
   * mehrere Segmente gespeichert, die über groupId zusammengehalten werden.
   */
  async addCallout({ onCallPeriodId, date, startTime, endTime, description }) {
    const segments = this.splitAtMidnight(date, startTime, endTime);

    if (segments.length === 0) {
      throw new Error('Einsatz hat keine Dauer');
    }

    const groupId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const now = new Date().toISOString();
    const ids = [];

    for (const segment of segments) {
      const record = {
        groupId,
        onCallPeriodId: onCallPeriodId || null,
        date: segment.date,
        startTime: segment.startTime,
        endTime: segment.endTime,
        description: description || '',
        yearMonth: this.toYearMonth(segment.date),
        createdAt: now,
        updatedAt: now
      };

      ids.push(await storage.add('callouts', record));
    }

    return { groupId, ids, segments: segments.length };
  }

  // Löscht alle Segmente eines Einsatzes
  async deleteCallout(groupId) {
    const all = await this.getAllCallouts();
    const toDelete = all.filter(c => c.groupId === groupId);

    for (const record of toDelete) {
      await storage.delete('callouts', record.id);
    }

    return toDelete.length;
  }

  // Ersetzt einen Einsatz (löschen + neu anlegen, wegen Mitternachts-Splittung)
  async updateCallout(groupId, { onCallPeriodId, date, startTime, endTime, description }) {
    await this.deleteCallout(groupId);
    return this.addCallout({ onCallPeriodId, date, startTime, endTime, description });
  }

  // ===== Einsätze: Abfragen =====

  async getAllCallouts() {
    try {
      return await storage.getAll('callouts');
    } catch (error) {
      console.error('Error loading callouts:', error);
      return [];
    }
  }

  // Zeitintervall eines gespeicherten Segments
  getCalloutInterval(callout) {
    const start = this.parseDateTime(callout.date, callout.startTime);
    const end = this.parseDateTime(callout.date, callout.endTime);
    return { start, end };
  }

  getCalloutHours(callout) {
    const { start, end } = this.getCalloutInterval(callout);
    return Math.max(0, (end - start) / 3600000);
  }

  // Summe aller Einsatz-Anteile, die in ein Zeitfenster fallen
  async getCalloutHoursInWindow(windowStart, windowEnd) {
    const all = await this.getAllCallouts();

    let hours = 0;
    for (const callout of all) {
      const interval = this.getCalloutInterval(callout);
      hours += this.overlapHours(windowStart, windowEnd, interval.start, interval.end);
    }

    return hours;
  }

  // Alle Segmente eines Monats, chronologisch sortiert
  async getCalloutsForMonth(year, month) {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const all = await this.getAllCallouts();

    return all
      .filter(c => c.yearMonth === yearMonth)
      .sort((a, b) => {
        const aStart = this.getCalloutInterval(a).start;
        const bStart = this.getCalloutInterval(b).start;
        return aStart - bStart;
      });
  }

  // Alle Segmente einer Bereitschaftsperiode
  async getCalloutsForPeriod(onCallPeriodId) {
    const all = await this.getAllCallouts();

    return all
      .filter(c => c.onCallPeriodId === onCallPeriodId)
      .sort((a, b) => {
        const aStart = this.getCalloutInterval(a).start;
        const bStart = this.getCalloutInterval(b).start;
        return aStart - bStart;
      });
  }

  // Einsatzstunden eines Monats
  async getCalloutHoursForMonth(year, month) {
    const callouts = await this.getCalloutsForMonth(year, month);
    return callouts.reduce((sum, c) => sum + this.getCalloutHours(c), 0);
  }

  // Netto-Arbeitsstunden eines Monats über die übergebenen Worklog-Einträge
  getWorkHoursForEntries(entries) {
    if (!entries) return 0;
    return entries.reduce((sum, entry) => sum + this.getNetWorkHours(entry), 0);
  }
}

// Singleton-Instanz
const callouts = new Callouts();

// Für Node-basierte Tests (im Browser nicht vorhanden)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Callouts, callouts };
}
