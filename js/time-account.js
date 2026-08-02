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

    const wtSettings = settings.workTimeTracking;
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

    // Map to our settings keys
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = dayMap[dayOfWeek];

    // Get target hours for this weekday
    const targetHours = wtSettings.dailyTargetHours[dayKey] || 0;

    // Holidays: Keep the normal target (will be counted as fulfilled in getActualHours)
    // If target hours = 0 (e.g., weekend), holiday doesn't change anything
    return targetHours;
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
