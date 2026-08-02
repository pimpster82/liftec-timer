// LIFTEC Timer - Time Account & Vacation Tracking Module
// Calculations for work time tracking (Zeitkonto & Urlaubsverwaltung)
//
// Bewusst klein gehalten: Hier stehen nur Soll- und Iststunden EINES Tages.
// Die Aufsummierung über Zeiträume liegt in app.getDayBalance() bzw.
// app.recalculateTimeAccountBalance() - es soll nicht wieder mehrere
// Saldo-Berechnungen geben, die auseinanderlaufen.

class TimeAccount {

  /**
   * Get daily target hours for a specific date
   * @param {Date} date - The date to check
   * @param {Object} settings - Work time tracking settings
   * @returns {number} Target hours for that day
   */
  getDailyTargetHours(date, settings) {
    if (!settings || !settings.workTimeTracking || !settings.workTimeTracking.enabled) {
      return 0;
    }

    const rate = this.getRateForDate(date, settings);
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    // Map to our settings keys
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayMap[dayOfWeek];

    // Holidays: Keep the normal target (will be counted as fulfilled in getActualHours)
    // If target hours = 0 (e.g., weekend), holiday doesn't change anything
    return rate.dailyTargetHours?.[dayKey] || 0;
  }

  /**
   * Den zu einem Datum gültigen Satz finden: der jüngste Eintrag, dessen
   * validFrom nicht in der Zukunft liegt.
   *
   * Der Vergleich läuft über 'YYYY-MM-DD'-Strings. Das ist lexikografisch
   * korrekt und umgeht die Zeitzonen-Fallen, die es bei Date-Objekten schon
   * einmal gab (der Stichtag verschob sich per toISOString um einen Tag).
   *
   * @param {Date} date
   * @param {Object} settings
   * @returns {{dailyTargetHours: Object, onCallRate: number, hourlyWage: number}}
   */
  getRateForDate(date, settings) {
    const wtSettings = settings?.workTimeTracking;
    const history = wtSettings?.rateHistory;

    const empty = { dailyTargetHours: {}, onCallRate: 0, hourlyWage: 0 };

    if (!Array.isArray(history) || history.length === 0) {
      // Fallback auf den flachen Altbestand, solange die Migration noch nicht
      // gelaufen ist (siehe app.migrateRateHistory)
      return wtSettings?.dailyTargetHours
        ? { ...empty, dailyTargetHours: wtSettings.dailyTargetHours }
        : empty;
    }

    const target = this._toDateKey(date);

    let best = null;
    let oldest = history[0];

    for (const rate of history) {
      if (rate.validFrom < oldest.validFrom) oldest = rate;
      if (rate.validFrom <= target && (!best || rate.validFrom > best.validFrom)) {
        best = rate;
      }
    }

    // Liegt das Datum vor dem ersten Satz, gilt der älteste - sonst stünde
    // für frühe Einträge plötzlich ein Soll von 0 in der Rechnung
    return best || oldest;
  }

  /**
   * Date -> 'YYYY-MM-DD' in Lokalzeit (nicht toISOString, das rechnet nach UTC)
   */
  _toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Calculate actual hours worked from a worklog entry
   * @param {Object} entry - Worklog entry
   * @param {Object} settings - Settings (for target hours on vacation/sick/holiday)
   * @returns {number} Actual hours worked
   */
  getActualHours(entry, settings) {
    // Vacation, sick days, and holidays: 0 actual hours (didn't work)
    // Target is also set to 0 in recalculation → balance = 0 - 0 = neutral
    if (entry.entryType === 'vacation' ||
        entry.entryType === 'sick' ||
        entry.entryType === 'holiday') {
      return 0;
    }

    // Unpaid leave and Zeitausgleich: 0 actual hours
    // But target stays → balance = 0 - target = negative (debt)
    if (entry.entryType === 'unpaid' || entry.entryType === 'timeoff') {
      return 0;
    }

    // Normal work entry - calculate from start/end/pause
    if (!entry.startTime || !entry.endTime) {
      return 0;
    }

    const start = this._parseTimeToMinutes(entry.startTime);
    let end = this._parseTimeToMinutes(entry.endTime);
    const pause = this._parseTimeToMinutes(entry.pause || '00:00');

    if (end < start) {
      // Nachtschicht: Ende liegt am Folgetag (z.B. 22:00 -> 06:00)
      end += 24 * 60;
    }

    const totalMinutes = (end - start) - pause;
    return Math.max(0, totalMinutes) / 60;  // Convert to hours
  }

  // ===== Private Helper Methods =====

  /**
   * Parse time string (HH:MM) to minutes
   * @param {string} timeStr
   * @returns {number} Minutes
   */
  _parseTimeToMinutes(timeStr) {
    if (!timeStr || timeStr === '') return 0;

    const parts = timeStr.split(':');
    if (parts.length !== 2) return 0;

    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;

    return (hours * 60) + minutes;
  }




}

// Create singleton instance
const timeAccount = new TimeAccount();
