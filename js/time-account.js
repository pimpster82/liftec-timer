// LIFTEC Timer - Time Account & Vacation Tracking Module
// Calculations for work time tracking (Zeitkonto & Urlaubsverwaltung)

class TimeAccount {
  constructor() {
    this.austrianHolidays = null;  // Will be populated by app
  }

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

    // Holiday check: If it's a holiday AND the day has target hours, REDUCE target to 0
    // This means the weekly target is automatically reduced on holidays
    // If target hours = 0 (e.g., weekend), holiday doesn't matter
    if (this.isAustrianHoliday(date)) {
      return 0;  // Holiday = no target hours (reduces weekly target)
    }

    return targetHours;
  }

  /**
   * Calculate actual hours worked from a worklog entry
   * @param {Object} entry - Worklog entry
   * @param {Object} settings - Settings (for target hours on vacation/sick)
   * @returns {number} Actual hours worked
   */
  getActualHours(entry, settings) {
    // Vacation and sick days count as target fulfilled (they had a target before the day off)
    if (entry.entryType === 'vacation' || entry.entryType === 'sick') {
      // Return the target hours for this day (what would have been worked)
      return entry.targetHours || 0;
    }

    // Holidays and unpaid leave don't count as hours worked
    if (entry.entryType === 'holiday' || entry.entryType === 'unpaid') {
      return 0;
    }

    // Normal work entry - calculate from start/end/pause
    if (!entry.startTime || !entry.endTime) {
      return 0;
    }

    const start = this._parseTimeToMinutes(entry.startTime);
    const end = this._parseTimeToMinutes(entry.endTime);
    const pause = this._parseTimeToMinutes(entry.pause || '00:00');

    if (end < start) {
      // End is next day (e.g., night shift) - not implemented yet, treat as 0
      return 0;
    }

    const totalMinutes = (end - start) - pause;
    return totalMinutes / 60;  // Convert to hours
  }

  /**
   * Calculate weekly summary
   * @param {Array} entries - Worklog entries for the week
   * @param {Object} settings - Work time tracking settings
   * @returns {Object} Summary with actual, target, and balance
   */
  calculateWeeklySummary(entries, settings) {
    let totalActual = 0;
    let totalTarget = 0;

    for (const entry of entries) {
      const actual = this.getActualHours(entry, settings);
      const target = entry.targetHours || 0;

      totalActual += actual;
      totalTarget += target;
    }

    return {
      actualHours: totalActual,
      targetHours: totalTarget,
      balance: totalActual - totalTarget
    };
  }

  /**
   * Calculate monthly summary
   * @param {Array} entries - Worklog entries for the month
   * @param {Object} settings - Work time tracking settings
   * @returns {Object} Summary with stats
   */
  calculateMonthlySummary(entries, settings) {
    let totalActual = 0;
    let totalTarget = 0;
    let workDays = 0;
    let vacationDays = 0;
    let sickDays = 0;
    let holidays = 0;

    for (const entry of entries) {
      const actual = this.getActualHours(entry, settings);
      const target = entry.targetHours || 0;

      totalActual += actual;
      totalTarget += target;

      // Count day types
      if (entry.entryType === 'work') {
        workDays++;
      } else if (entry.entryType === 'vacation') {
        vacationDays += entry.vacationDays || 1;
      } else if (entry.entryType === 'sick') {
        sickDays++;
      } else if (entry.entryType === 'holiday') {
        holidays++;
      }
    }

    return {
      actualHours: totalActual,
      targetHours: totalTarget,
      balance: totalActual - totalTarget,
      workDays,
      vacationDays,
      sickDays,
      holidays
    };
  }

  /**
   * Update time account balance for a new entry
   * @param {Object} entry - Worklog entry (will be modified with calculated values)
   * @param {Object} settings - Current settings
   * @returns {Object} Updated entry with targetHours, actualHours, balance
   */
  updateEntryWithCalculations(entry, settings) {
    // Parse date from DD.MM.YYYY format
    const [day, month, year] = entry.date.split('.');
    const date = new Date(year, month - 1, day);

    // Calculate target hours for this day
    entry.targetHours = this.getDailyTargetHours(date, settings);

    // Calculate actual hours
    entry.actualHours = this.getActualHours(entry, settings);

    // Set entry type if not set
    if (!entry.entryType) {
      entry.entryType = 'work';
    }

    return entry;
  }

  /**
   * Recalculate time account balance from all entries
   * @param {Array} allEntries - All worklog entries (sorted by date)
   * @param {Object} settings - Current settings
   * @returns {number} Current time account balance
   */
  recalculateTimeAccount(allEntries, settings) {
    const wtSettings = settings.workTimeTracking;
    let balance = 0;

    // Sort entries by date
    const sortedEntries = [...allEntries].sort((a, b) => {
      const dateA = this._parseDate(a.date);
      const dateB = this._parseDate(b.date);
      return dateA - dateB;
    });

    for (const entry of sortedEntries) {
      const actual = this.getActualHours(entry, settings);
      const target = entry.targetHours || 0;
      balance += (actual - target);
    }

    return balance;
  }

  /**
   * Check if a date is an Austrian holiday
   * @param {Date} date
   * @returns {boolean}
   */
  isAustrianHoliday(date) {
    // This will use the existing Austrian holidays implementation
    // For now, return false - will be integrated with existing holiday detection
    if (!this.austrianHolidays) {
      return false;
    }

    const dateStr = this._formatDate(date);
    return this.austrianHolidays.includes(dateStr);
  }

  /**
   * Set Austrian holidays (called from app.js)
   * @param {Array} holidays - Array of holiday date strings
   */
  setAustrianHolidays(holidays) {
    this.austrianHolidays = holidays;
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

  /**
   * Parse DD.MM.YYYY to Date object
   * @param {string} dateStr
   * @returns {Date}
   */
  _parseDate(dateStr) {
    const [day, month, year] = dateStr.split('.');
    return new Date(year, month - 1, day);
  }

  /**
   * Format Date to DD.MM.YYYY
   * @param {Date} date
   * @returns {string}
   */
  _formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Get week number for a date (ISO 8601)
   * @param {Date} date
   * @returns {number}
   */
  getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  /**
   * Get entries for a specific week
   * @param {Array} allEntries - All worklog entries
   * @param {number} weekNumber - ISO week number
   * @param {number} year
   * @returns {Array} Entries for that week
   */
  getEntriesForWeek(allEntries, weekNumber, year) {
    return allEntries.filter(entry => {
      const date = this._parseDate(entry.date);
      const entryWeek = this.getWeekNumber(date);
      const entryYear = date.getFullYear();
      return entryWeek === weekNumber && entryYear === year;
    });
  }
}

// Create singleton instance
const timeAccount = new TimeAccount();
