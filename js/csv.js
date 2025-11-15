// LIFTEC Timer - CSV Export Module

class CSVExport {
  constructor() {
    this.BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    this.header = 'Datum;Start;Ende;Pause;Fahrtzeit;SZ;N;D;R;W;Taetigkeiten';
  }

  // Quote CSV values
  quote(str) {
    if (str == null) return '""';
    const escaped = String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return `"${escaped}"`;
  }

  // Pad number with leading zero
  pad2(n) {
    return String(n).padStart(2, '0');
  }

  // Convert hours to HH:MM format
  hoursToHHMM(hours) {
    const totalMins = Math.round(hours * 60);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return `${this.pad2(h)}:${this.pad2(m)}`;
  }

  // Create a single CSV row from session data
  createRow(entry) {
    const flags = { N: '', D: '', R: '', W: '' };

    // Set flags based on task types
    if (entry.tasks && entry.tasks.length > 0) {
      entry.tasks.forEach(task => {
        if (flags.hasOwnProperty(task.type)) {
          flags[task.type] = 'X';
        }
      });
    }

    // Create tasks string
    const tasksStr = entry.tasks
      ? entry.tasks
          .map(t => t.type ? `${t.description} [${t.type}]` : t.description)
          .join(', ')
      : '';

    // Build row
    const row = [
      entry.date,
      entry.startTime,
      entry.endTime,
      entry.pause || '',
      entry.travelTime || '',
      entry.surcharge || '',
      flags.N,
      flags.D,
      flags.R,
      flags.W,
      this.quote(tasksStr)
    ].join(';');

    return row;
  }

  // Create empty row for a specific date
  createEmptyRow(dateStr) {
    return `"${dateStr}";"";"";"";"";"";"";"";"";"";""`;;
  }

  // Generate monthly CSV
  async generateMonthlyCSV(year, month, username = 'User') {
    // Get entries for the month
    const entries = await storage.getMonthEntries(year, month);

    // Create a map of existing entries by date
    const entriesMap = new Map();
    entries.forEach(entry => {
      entriesMap.set(entry.date, entry);
    });

    // Get number of days in month
    const lastDay = new Date(year, month, 0).getDate();

    // Generate rows for all days
    const rows = [];
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${this.pad2(day)}.${this.pad2(month)}.${year}`;

      if (entriesMap.has(dateStr)) {
        // Use existing entry
        rows.push(this.createRow(entriesMap.get(dateStr)));
      } else {
        // Create empty row
        rows.push(this.createEmptyRow(dateStr));
      }
    }

    // Build CSV content
    let content = this.BOM + this.header + '\n' + rows.join('\n') + '\n';

    // Add on-call summary if applicable
    const onCallSummary = await this.getOnCallSummaryForMonth(year, month);
    if (onCallSummary) {
      content += '\n'; // Empty line separator
      content += onCallSummary;
    }

    // Create filename
    const filename = `${username.replace(/\s+/g, '_')}_${year}-${this.pad2(month)}.csv`;

    return { content, filename };
  }

  // Get on-call summary for a specific month
  // Handles multiple periods and adjusts dates to month boundaries
  async getOnCallSummaryForMonth(year, month) {
    try {
      // Get all on-call periods
      const allPeriods = await storage.getAllOnCallPeriods();

      // Filter periods that are completed (have endDate) and overlap with this month
      const completedPeriods = allPeriods.filter(p => p.endDate);

      if (completedPeriods.length === 0) {
        return null;
      }

      // Get month boundaries (midnight to midnight)
      // Month start: first day at 00:01
      // Month end: last day at 23:59
      const monthStart = new Date(year, month - 1, 1, 0, 1);
      const monthEnd = new Date(year, month, 0, 23, 59);

      // Collect periods that overlap with this month
      const overlappingPeriods = [];

      for (const period of completedPeriods) {
        // Parse period dates (with times)
        const periodStart = this.parseDateTime(period.startDate, period.startTime);
        const periodEnd = this.parseDateTime(period.endDate, period.endTime);

        // Check if period overlaps with this month
        if (periodEnd < monthStart || periodStart > monthEnd) {
          continue; // No overlap, skip this period
        }

        // Adjust period boundaries to fit within the month
        const adjustedStart = periodStart < monthStart ? monthStart : periodStart;
        const adjustedEnd = periodEnd > monthEnd ? monthEnd : periodEnd;

        // Format adjusted dates for display
        const adjustedStartDate = this.formatDate(adjustedStart);
        const adjustedStartTime = this.formatTime(adjustedStart);
        const adjustedEndDate = this.formatDate(adjustedEnd);
        const adjustedEndTime = this.formatTime(adjustedEnd);

        // Calculate on-call hours for this adjusted period
        const onCallHours = await this.calculateMonthlyOnCallHours(
          period,
          adjustedStart,
          adjustedEnd
        );

        // Format as HH:MM
        const onCallHHMM = this.hoursToHHMM(onCallHours);

        overlappingPeriods.push({
          id: period.id,
          startDate: adjustedStartDate,
          startTime: adjustedStartTime,
          endDate: adjustedEndDate,
          endTime: adjustedEndTime,
          hours: onCallHHMM
        });
      }

      if (overlappingPeriods.length === 0) {
        return null;
      }

      // Build CSV summary with header
      let summary = 'Bereitschaft;Von;Bis;Insgesamt\n';

      // Add each period as a row
      for (const period of overlappingPeriods) {
        summary += `Bereitschaft #${period.id};${period.startDate} ${period.startTime};${period.endDate} ${period.endTime};${period.hours}\n`;
      }

      return summary;
    } catch (error) {
      console.error('Error generating on-call summary:', error);
      return null;
    }
  }

  // Helper: Parse date and time strings to Date object
  parseDateTime(dateStr, timeStr) {
    const [day, month, year] = dateStr.split('.').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }

  // Helper: Format Date object to DD.MM.YYYY
  formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // Helper: Format Date object to HH:MM
  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // Calculate on-call hours for a period within month boundaries
  // Returns: total_hours_in_range - work_hours_in_range
  async calculateMonthlyOnCallHours(period, adjustedStart, adjustedEnd) {
    // Calculate total hours in adjusted range
    const totalHours = (adjustedEnd - adjustedStart) / 3600000; // milliseconds to hours

    // Get worklog entries in the adjusted range
    const adjustedStartDate = this.formatDate(adjustedStart);
    const adjustedEndDate = this.formatDate(adjustedEnd);

    const entries = await storage.getEntriesByDateRange(
      adjustedStartDate,
      adjustedEndDate
    );

    // Sum up actual work hours (surcharge field contains the work hours)
    let workHours = 0;
    for (const entry of entries) {
      if (entry.surcharge) {
        const [hours, minutes] = entry.surcharge.split(':').map(Number);
        workHours += hours + (minutes / 60);
      }
    }

    // Calculate on-call time (total time minus work time)
    const onCallHours = Math.max(0, totalHours - workHours);
    return onCallHours;
  }

  // Download CSV file
  downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (navigator.msSaveBlob) {
      // IE 10+
      navigator.msSaveBlob(blob, filename);
    } else {
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Send CSV via email (using mailto)
  sendEmail(content, filename, settings) {
    const monthStr = filename.match(/\d{4}-\d{2}/)[0];

    const subject = settings.emailSubject
      .replace('{month}', monthStr)
      .replace('{name}', settings.username);

    const body = settings.emailBody
      .replace('{month}', monthStr)
      .replace('{name}', settings.username);

    // For web, we'll use mailto with base64 encoded attachment (limited support)
    // Or use the Web Share API if available
    if (navigator.share) {
      // Create a file
      const file = new File([content], filename, { type: 'text/csv' });

      navigator.share({
        title: subject,
        text: body,
        files: [file]
      })
      .then(() => console.log('Shared successfully'))
      .catch(error => {
        console.error('Error sharing:', error);
        // Fallback to mailto
        this.sendMailto(settings.email, subject, body);
      });
    } else {
      // Fallback to mailto (without attachment)
      this.sendMailto(settings.email, subject, body);
    }
  }

  // Send email using mailto (without attachment)
  sendMailto(email, subject, body) {
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  }

  // Export all worklog data as CSV
  async exportAllWorklog(username = 'User') {
    const entries = await storage.getAllWorklogEntries();

    if (entries.length === 0) {
      return null;
    }

    // Sort entries by date
    entries.sort((a, b) => {
      const dateA = this.parseDate(a.date);
      const dateB = this.parseDate(b.date);
      return dateA - dateB;
    });

    // Create rows
    const rows = entries.map(entry => this.createRow(entry));

    // Build CSV content
    const content = this.BOM + this.header + '\n' + rows.join('\n') + '\n';

    // Create filename
    const now = new Date();
    const filename = `${username.replace(/\s+/g, '_')}_complete_${now.getFullYear()}-${this.pad2(now.getMonth() + 1)}-${this.pad2(now.getDate())}.csv`;

    return { content, filename };
  }

  // Parse date string (DD.MM.YYYY) to Date object
  parseDate(dateStr) {
    const [day, month, year] = dateStr.split('.');
    return new Date(year, month - 1, day);
  }

  // Import CSV data
  async importCSV(csvContent) {
    const lines = csvContent.split(/\r?\n/);
    const entries = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(';');
      if (parts.length < 11) continue;

      // Parse the row
      const date = parts[0].replace(/"/g, '');
      if (!date) continue; // Skip empty rows

      const startTime = parts[1].replace(/"/g, '');
      const endTime = parts[2].replace(/"/g, '');

      // Skip if no times
      if (!startTime || !endTime) continue;

      const entry = {
        date,
        startTime,
        endTime,
        pause: parts[3].replace(/"/g, ''),
        travelTime: parts[4].replace(/"/g, ''),
        surcharge: parts[5].replace(/"/g, ''),
        tasks: this.parseTasks(parts[10].replace(/"/g, ''), {
          N: parts[6].replace(/"/g, ''),
          D: parts[7].replace(/"/g, ''),
          R: parts[8].replace(/"/g, ''),
          W: parts[9].replace(/"/g, '')
        })
      };

      entries.push(entry);
    }

    // Store entries
    for (const entry of entries) {
      await storage.addWorklogEntry(entry);
    }

    return entries.length;
  }

  // Parse tasks from CSV string
  parseTasks(tasksStr, flags) {
    if (!tasksStr) return [];

    const tasks = [];
    const taskParts = tasksStr.split(',').map(t => t.trim());

    taskParts.forEach(taskStr => {
      const match = taskStr.match(/^(.*?)\s*\[([NDRW])\]$/);
      if (match) {
        tasks.push({
          description: match[1].trim(),
          type: match[2]
        });
      } else if (taskStr) {
        tasks.push({
          description: taskStr,
          type: ''
        });
      }
    });

    return tasks;
  }
}

// Create singleton instance
const csvExport = new CSVExport();
