// LIFTEC Timer - Austrian Holidays Module
// Gesetzliche Feiertage in Österreich

class AustrianHolidays {
  constructor() {
    // Fixed holidays (month is 1-based: 1=January, 12=December)
    this.fixedHolidays = [
      { month: 1, day: 1, name: { de: 'Neujahr', en: 'New Year', hr: 'Nova godina' } },
      { month: 1, day: 6, name: { de: 'Heilige Drei Könige', en: 'Epiphany', hr: 'Bogojavljenje' } },
      { month: 5, day: 1, name: { de: 'Staatsfeiertag', en: 'Labour Day', hr: 'Praznik rada' } },
      { month: 8, day: 15, name: { de: 'Mariä Himmelfahrt', en: 'Assumption Day', hr: 'Velika Gospa' } },
      { month: 10, day: 26, name: { de: 'Nationalfeiertag', en: 'National Day', hr: 'Nacionalni praznik' } },
      { month: 11, day: 1, name: { de: 'Allerheiligen', en: 'All Saints Day', hr: 'Svi sveti' } },
      { month: 12, day: 8, name: { de: 'Mariä Empfängnis', en: 'Immaculate Conception', hr: 'Bezgrešno začeće' } },
      { month: 12, day: 25, name: { de: 'Christtag', en: 'Christmas Day', hr: 'Božić' } },
      { month: 12, day: 26, name: { de: 'Stefanitag', en: 'St. Stephen\'s Day', hr: 'Sveti Stjepan' } }
    ];
  }

  /**
   * Calculate Easter Sunday using the Meeus/Jones/Butcher algorithm
   * Returns a Date object set at 12:00 to avoid timezone issues
   */
  calculateEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month - 1, day, 12, 0, 0);
  }

  /**
   * Calculate movable holidays (Easter-based)
   * All dates are set at 12:00 to avoid timezone issues
   */
  getMovableHolidays(year) {
    const easter = this.calculateEaster(year);
    const holidays = [];

    // Easter Monday (Easter + 1 day)
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    holidays.push({
      date: easterMonday,
      name: { de: 'Ostermontag', en: 'Easter Monday', hr: 'Uskršnji ponedjeljak' }
    });

    // Ascension Day (Easter + 39 days)
    const ascension = new Date(easter);
    ascension.setDate(easter.getDate() + 39);
    holidays.push({
      date: ascension,
      name: { de: 'Christi Himmelfahrt', en: 'Ascension Day', hr: 'Uzašašće' }
    });

    // Whit Monday (Easter + 50 days)
    const whitMonday = new Date(easter);
    whitMonday.setDate(easter.getDate() + 50);
    holidays.push({
      date: whitMonday,
      name: { de: 'Pfingstmontag', en: 'Whit Monday', hr: 'Duhovski ponedjeljak' }
    });

    // Corpus Christi (Easter + 60 days)
    const corpusChristi = new Date(easter);
    corpusChristi.setDate(easter.getDate() + 60);
    holidays.push({
      date: corpusChristi,
      name: { de: 'Fronleichnam', en: 'Corpus Christi', hr: 'Tijelovo' }
    });

    return holidays;
  }

  /**
   * Get all holidays for a specific year
   * Returns array of { date: Date, name: {de, en, hr} }
   */
  getAllHolidays(year) {
    const holidays = [];

    // Add fixed holidays
    for (const holiday of this.fixedHolidays) {
      holidays.push({
        date: new Date(year, holiday.month - 1, holiday.day, 12, 0, 0),
        name: holiday.name
      });
    }

    // Add movable holidays
    holidays.push(...this.getMovableHolidays(year));

    return holidays;
  }

  /**
   * Check if a date string (DD.MM.YYYY) is a holiday
   * Returns { isHoliday: boolean, name?: {de, en, hr} }
   */
  isHoliday(dateString) {
    const [day, month, year] = dateString.split('.').map(Number);
    const checkDate = new Date(year, month - 1, day, 12, 0, 0);

    const holidays = this.getAllHolidays(year);

    for (const holiday of holidays) {
      if (holiday.date.getFullYear() === checkDate.getFullYear() &&
          holiday.date.getMonth() === checkDate.getMonth() &&
          holiday.date.getDate() === checkDate.getDate()) {
        return {
          isHoliday: true,
          name: holiday.name
        };
      }
    }

    return { isHoliday: false };
  }

  /**
   * Get holiday name for a date string in specified language
   * Returns null if not a holiday
   */
  getHolidayName(dateString, language = 'de') {
    const result = this.isHoliday(dateString);
    if (result.isHoliday) {
      return result.name[language] || result.name.de;
    }
    return null;
  }

  /**
   * Parse DD.MM.YYYY to Date (timezone-safe at 12:00)
   */
  parseDate(dateStr) {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  /**
   * Format Date to DD.MM.YYYY
   */
  formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Get all holidays in a month as date strings
   * Returns array of DD.MM.YYYY strings
   */
  getHolidaysInMonth(year, month) {
    const holidays = this.getAllHolidays(year);
    const monthHolidays = [];

    for (const holiday of holidays) {
      if (holiday.date.getMonth() === month - 1) {
        monthHolidays.push({
          date: this.formatDate(holiday.date),
          name: holiday.name
        });
      }
    }

    return monthHolidays;
  }
}

// Create singleton instance
const austrianHolidays = new AustrianHolidays();
