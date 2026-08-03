// LIFTEC Timer - Excel Export Module
// Generates formatted XLSX files matching the template

class ExcelExport {
  constructor() {
    this.monthNames = [
      'Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    this.dayNames = [
      'Sonntag', 'Montag', 'Dienstag', 'Mittwoch',
      'Donnerstag', 'Freitag', 'Samstag'
    ];
  }

  // Parse DD.MM.YYYY to Date  (FIX: DST/Timezone safe → always 12:00)
  parseDate(dateStr) {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }

  // === DEIN ORIGINALER EXCEL-GENERATOR (UNVERÄNDERT) ===
  async generateXLSX(entries, year, month, userName) {
    const workbook = new ExcelJS.Workbook();
    const pad2 = (n) => String(n).padStart(2, '0');
    const sheetName = `Arbeitszeit ${userName} ${pad2(month)} ${year}`;
    const worksheet = workbook.addWorksheet(sheetName)
    worksheet.pageSetup = {
      paperSize: 9,                // A4
      orientation: 'landscape',    // Querformat
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,             // Breite auf 1 Seite, Höhe darf umbrechen
                                  // (sonst schrumpfen Summen + Einsätze das Raster)
      horizontalCentered: true,    // horizontal zentriert
      verticalCentered: true,      // vertikal zentriert
      margins: {
        left: 0.25,                // schmale Ränder
        right: 0.25,
        top: 0.25,
        bottom: 0.25,
        header: 0.3,
        footer: 0.3
      }
    };

    // Bereitschaft je Kalendertag. Nur wenn der Monat überhaupt welche hat,
    // bekommt das Blatt die zusätzliche Spalte - sonst bleibt es wie gehabt.
    const onCallByDay = await callouts.getOnCallHoursByDay(year, month);
    const hasOnCall = onCallByDay.size > 0;

    // Die Bereitschaftsspalte sitzt hinter der Schmutzzulage (G). Alles ab den
    // Tätigkeitskürzeln rückt dadurch um eine Spalte nach rechts.
    const COL_ONCALL = 8;
    const shift = hasOnCall ? 1 : 0;
    const COL_N = 8 + shift;
    const COL_W = 11 + shift;
    const COL_DESC = 12 + shift;

    // Set column widths
    worksheet.columns = [
      { width: 11 },  // Datum
      { width: 11 },  // Wochentag
      { width: 10 },  // ein
      { width: 10 },  // aus
      { width: 9 },   // Pause
      { width: 9 },   // Fahrt
      { width: 9 },   // Schmutz
      ...(hasOnCall ? [{ width: 10 }] : []),  // Bereitschaft
      { width: 4 },   // Neuanlage (N)
      { width: 4 },   // Demontage (D)
      { width: 4 },   // Reparatur (R)
      { width: 4 },   // Wartung (W)
      { width: 65 }   // Einsatzort
    ];

    // Header Row 1: Month/Year and Name
    const headerRow1 = worksheet.getRow(1);
    const monthName = this.monthNames[month - 1];

    worksheet.mergeCells('A1:B1');
    const monthCell = worksheet.getCell('A1');
    monthCell.value = `${monthName} ${year}`;
    monthCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF92D050' }
    };
    monthCell.font = { bold: true, size: 14 };
    monthCell.alignment = { vertical: 'middle', horizontal: 'center' };
    monthCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    const nameCell = worksheet.getCell(1, COL_DESC);
    nameCell.value = `NAME: ${userName}`;
    nameCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' }
    };
    nameCell.font = { bold: true, size: 14 };
    nameCell.alignment = { vertical: 'middle', horizontal: 'right' };
    nameCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    headerRow1.height = 25;

    // Header Row 2
    const headerRow2 = worksheet.getRow(2);
    headerRow2.values = [
      'Datum',
      'Wochentag',
      'Arbeitszeit\nein',
      'Arbeitszeit\naus',
      'Pause\nDauer',
      'Fahrt\nzeit',
      'Schmutz\nzulage',
      ...(hasOnCall ? ['Bereit\nschaft'] : []),
      'Neuanlage',
      'Demontage',
      'Reparatur',
      'Wartung',
      'Einsatzort, Tätigkeit, Bemerkungen'
    ];

    headerRow2.eachCell((cell, colNumber) => {
      cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' }
      };
      cell.font = { bold: true, size: 10 };

      if (colNumber >= COL_N && colNumber <= COL_W) {
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          textRotation: 90
        };
      } else {
        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true
        };
      }

      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    headerRow2.height = 71;

    // Create entry map
    const entriesMap = new Map();
    entries.forEach(entry => {
      entriesMap.set(entry.date, entry);
    });

    const lastDay = new Date(year, month, 0).getDate();

    let currentRow = 3;

    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${pad2(day)}.${pad2(month)}.${year}`;
      const date = this.parseDate(dateStr);
      const dayName = this.dayNames[date.getDay()];
      const dayOfWeek = date.getDay(); // 0=Sonntag, 6=Samstag

      const entry = entriesMap.get(dateStr);

      // Check if this date is a holiday
      const holidayInfo = austrianHolidays.isHoliday(dateStr);
      const isHoliday = holidayInfo.isHoliday;
      const holidayName = isHoliday ? holidayInfo.name.de : '';

      let startTime = '';
      let endTime = '';
      let pause = '';
      let travelTime = '';
      let schmutzZulage = '';
      let flags = { N: '', D: '', R: '', W: '' };
      let tasksDescription = '';

      if (entry) {
        startTime = entry.startTime || '';
        endTime = entry.endTime || '';
        pause = entry.pause || '';
        travelTime = entry.travelTime || '';
        schmutzZulage = entry.surcharge || '';

        if (entry.tasks && entry.tasks.length > 0) {
          entry.tasks.forEach(task => {
            if (flags.hasOwnProperty(task.type)) {
              flags[task.type] = 'X';
            }
          });
        }

        tasksDescription = entry.tasks && entry.tasks.length > 0
          ? entry.tasks.map(t => t.type ? `${t.description} [${t.type}]` : t.description).join(', ')
          : '';
      }

      // Add holiday name to description if it's a holiday (even without entry)
      if (isHoliday && !tasksDescription) {
        tasksDescription = holidayName + ' (Feiertag)';
      }

      const row = worksheet.getRow(currentRow);

      // A: Datum
      row.getCell(1).value = date;
      row.getCell(1).numFmt = 'dd.mm.yyyy';

      // B: Wochentag
      row.getCell(2).value = { formula: `A${currentRow}` };
      row.getCell(2).numFmt = 'dddd'

      const timeToExcelTime = (timeStr) => {
        if (!timeStr) return '';
        const [h, m] = timeStr.split(':').map(Number);
        return (h + m / 60) / 24;
      };

      row.getCell(3).value = timeToExcelTime(startTime);
      row.getCell(3).numFmt = '[h]:mm;;';

      row.getCell(4).value = timeToExcelTime(endTime);
      row.getCell(4).numFmt = '[h]:mm;;';

      row.getCell(5).value = timeToExcelTime(pause);
      row.getCell(5).numFmt = '[h]:mm;;';

      row.getCell(6).value = timeToExcelTime(travelTime);
      row.getCell(6).numFmt = '[h]:mm;;';

      row.getCell(7).value = timeToExcelTime(schmutzZulage);
      row.getCell(7).numFmt = '[h]:mm;;';

      if (hasOnCall) {
        // Tage ohne Bereitschaft bleiben leer - das ';;' im Format blendet
        // die Null aus, damit die Spalte nur zeigt, wo wirklich etwas war
        const onCallHours = onCallByDay.get(dateStr) || 0;
        row.getCell(COL_ONCALL).value = onCallHours / 24;
        row.getCell(COL_ONCALL).numFmt = '[h]:mm;;';
      }

      row.getCell(COL_N).value = flags.N;
      row.getCell(COL_N + 1).value = flags.D;
      row.getCell(COL_N + 2).value = flags.R;
      row.getCell(COL_W).value = flags.W;

      row.getCell(COL_DESC).value = tasksDescription;

      // Format
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        // Align
        if (colNumber <= COL_W) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }

        cell.font = { size: 10 };

        // Highlight holidays with red background
        if (isHoliday) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCCCC' }  // Light red for holidays
          };
        }
        // FIXED weekend coloring: 0 = Sunday, 6 = Saturday
        else if (dayOfWeek === 0 || dayOfWeek === 6) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
        }
      });

      currentRow++;
    }

    // Summen-Block (Arbeitszeit / Einsätze / Gesamt)
    currentRow = await this.addTotalsBlock(worksheet, currentRow, entries, year, month);

    // Add on-call summary if applicable
    currentRow = await this.addOnCallSummary(worksheet, currentRow, year, month);

    // Bereitschaftseinsätze
    currentRow = await this.addCalloutsTable(worksheet, currentRow, year, month, COL_DESC);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const monthNameForFile = this.monthNames[month - 1];
    const filename = `Arbeitszeit ${userName} ${monthNameForFile} ${year}.xlsx`;

    return { buffer, blob, filename };
  }

  // Summen-Block: Arbeitszeit, Einsätze, Gesamt
  // Gibt die nächste freie Zeile zurück
  async addTotalsBlock(worksheet, startRow, entries, year, month) {
    try {
      const workHours = callouts.getWorkHoursForEntries(entries);
      const calloutHours = await callouts.getCalloutHoursForMonth(year, month);
      const totalHours = workHours + calloutHours;

      // Leerzeile als Abstand
      startRow++;

      const rows = [
        { label: 'Summe Arbeitszeit', hours: workHours, highlight: false },
        { label: 'Summe Einsätze', hours: calloutHours, highlight: false },
        { label: 'Gesamt', hours: totalHours, highlight: true }
      ];

      for (const item of rows) {
        const row = worksheet.getRow(startRow);

        worksheet.mergeCells(startRow, 1, startRow, 2);

        const labelCell = row.getCell(1);
        labelCell.value = item.label;
        labelCell.font = { bold: true, size: 10 };
        labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
        labelCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        const valueCell = row.getCell(3);
        valueCell.value = item.hours / 24;
        valueCell.numFmt = '[h]:mm';
        valueCell.font = { bold: true, size: 10 };
        this.formatDataCell(valueCell);

        // "Gesamt" bekommt den Akzent-Grünton der Kopfzelle
        if (item.highlight) {
          const fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF92D050' }
          };
          labelCell.fill = fill;
          valueCell.fill = fill;
        }

        startRow++;
      }

      return startRow;
    } catch (error) {
      console.error('Error adding totals block to Excel:', error);
      // Silent fail - don't break export if totals fail
      return startRow;
    }
  }

  // Add on-call summary section to worksheet.
  // Handles multiple periods and adjusts dates to month boundaries.
  // Laufende Perioden werden mitgenommen und auf "jetzt" bzw. Monatsende geclamped.
  // Gibt die nächste freie Zeile zurück.
  async addOnCallSummary(worksheet, startRow, year, month) {
    try {
      const { start, end } = callouts.getMonthBounds(year, month);
      const overlappingPeriods = await callouts.getOnCallPeriodsInWindow(start, end);

      if (overlappingPeriods.length === 0) {
        return startRow;
      }

      // Add empty row for spacing
      startRow++;

      // Add on-call summary header row
      const headerRow = worksheet.getRow(startRow);
      this.formatHeaderCell(headerRow.getCell(1), 'Bereitschaft');
      this.formatHeaderCell(headerRow.getCell(2), 'Von');
      this.formatHeaderCell(headerRow.getCell(3), 'Bis');
      this.formatHeaderCell(headerRow.getCell(4), 'Insgesamt');

      startRow++;

      // Add each period as a data row
      for (const period of overlappingPeriods) {
        const dataRow = worksheet.getRow(startRow);

        // Column 1: Bereitschaft #X
        dataRow.getCell(1).value = `Bereitschaft #${period.id}`;
        this.formatDataCell(dataRow.getCell(1));

        // Column 2: Von (date + time)
        dataRow.getCell(2).value = period.from;
        this.formatDataCell(dataRow.getCell(2));

        // Column 3: Bis (date + time)
        dataRow.getCell(3).value = period.to;
        this.formatDataCell(dataRow.getCell(3));

        // Column 4: Hours
        dataRow.getCell(4).value = period.hours / 24;
        dataRow.getCell(4).numFmt = '[h]:mm';
        this.formatDataCell(dataRow.getCell(4));

        startRow++;
      }

      return startRow;
    } catch (error) {
      console.error('Error adding on-call summary to Excel:', error);
      // Silent fail - don't break export if on-call summary fails
      return startRow;
    }
  }

  // Tabelle der Bereitschaftseinsätze des Monats
  // lastCol: letzte Spalte des Rasters - die Beschreibung reicht bis dorthin
  // Gibt die nächste freie Zeile zurück
  async addCalloutsTable(worksheet, startRow, year, month, lastCol = 12) {
    try {
      const monthCallouts = await callouts.getCalloutsForMonth(year, month);

      if (monthCallouts.length === 0) {
        return startRow;
      }

      // Leerzeile als Abstand
      startRow++;

      const headerRow = worksheet.getRow(startRow);
      this.formatHeaderCell(headerRow.getCell(1), 'Einsätze');
      this.formatHeaderCell(headerRow.getCell(2), 'Datum');
      this.formatHeaderCell(headerRow.getCell(3), 'Von');
      this.formatHeaderCell(headerRow.getCell(4), 'Bis');
      this.formatHeaderCell(headerRow.getCell(5), 'Dauer');

      worksheet.mergeCells(startRow, 6, startRow, lastCol);
      this.formatHeaderCell(headerRow.getCell(6), 'Beschreibung');

      startRow++;

      let index = 1;
      for (const callout of monthCallouts) {
        const dataRow = worksheet.getRow(startRow);

        dataRow.getCell(1).value = `Einsatz #${index}`;
        this.formatDataCell(dataRow.getCell(1));

        dataRow.getCell(2).value = callout.date;
        this.formatDataCell(dataRow.getCell(2));

        dataRow.getCell(3).value = callout.startTime;
        this.formatDataCell(dataRow.getCell(3));

        dataRow.getCell(4).value = callout.endTime;
        this.formatDataCell(dataRow.getCell(4));

        dataRow.getCell(5).value = callouts.getCalloutHours(callout) / 24;
        dataRow.getCell(5).numFmt = '[h]:mm';
        this.formatDataCell(dataRow.getCell(5));

        worksheet.mergeCells(startRow, 6, startRow, lastCol);
        const descCell = dataRow.getCell(6);
        descCell.value = callout.description || '';
        descCell.alignment = { vertical: 'middle', horizontal: 'left' };
        descCell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        startRow++;
        index++;
      }

      return startRow;
    } catch (error) {
      console.error('Error adding callouts table to Excel:', error);
      // Silent fail - don't break export if callouts table fails
      return startRow;
    }
  }

  // Helper: Format header cell (gray background)
  formatHeaderCell(cell, value) {
    cell.value = value;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' }
    };
    cell.font = { bold: true, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  }

  // Helper: Format data cell
  formatDataCell(cell) {
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  }





  // === NEU: EXACT WIE BEIM CSV – MAIL & SHARE ===
  async exportAndSend(entries, year, month, userName, settings) {
    const { blob, filename } = await this.generateXLSX(entries, year, month, userName);
    this.sendEmail(blob, filename, settings);
  }

  // Send Excel via email (using Web Share API + Clipboard for subject)
  async sendEmail(blob, filename, settings) {
    // Extract month name from filename: "Arbeitszeit USERNAME MONAT JAHR.xlsx"
    // Using split is more robust than regex for umlauts (ä, ö, ü)
    const parts = filename.replace('.xlsx', '').split(' ');
    const monthStr = parts[parts.length - 2]; // Second-to-last part is the month

    const subject = settings.emailSubject
      .replace('{month}', monthStr)
      .replace('{name}', settings.username);
    const body = settings.emailBody
      .replace('{month}', monthStr)
      .replace('{name}', settings.username);

    const file = new File([blob], filename, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    // Strategy: Copy SUBJECT to clipboard, share file with BODY as text
    // User pastes subject into email subject field

    // Step 1: Try to copy subject to clipboard
    let subjectCopied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(subject);
        subjectCopied = true;
        console.log('✅ Betreff in Zwischenablage kopiert');
      }
    } catch (clipboardError) {
      console.log('⚠️ Clipboard API failed:', clipboardError);
    }

    // Step 2: Try Web Share API with file and body text
    if (navigator.share && navigator.canShare) {
      try {
        const canShareFiles = await navigator.canShare({ files: [file] });

        if (canShareFiles) {
          // Share with file and body text
          await navigator.share({
            files: [file],
            text: body
          });
          console.log('✅ Excel via Share API geteilt');

          // Show toast about clipboard
          if (subjectCopied) {
            setTimeout(() => {
              if (window.ui) {
                ui.showToast('📋 Betreff in Zwischenablage - im Email einfügen!', 'success');
              }
            }, 500);
          }

          return true;
        }
      } catch (error) {
        // User cancelled or error occurred
        if (error.name === 'AbortError') {
          console.log('❌ Share cancelled by user');
          return false;
        }
        console.error('Share API error:', error);
      }
    }

    // Fallback: Open mailto with subject and body (no recipient)
    this.sendMailto(subject, body);

    if (subjectCopied) {
      setTimeout(() => {
        if (window.ui) {
          ui.showToast('Email geöffnet - Betreff aus Zwischenablage einfügen', 'info');
        }
      }, 500);
    }

    return false;
  }

  // Send email using mailto (without attachment, without recipient)
  sendMailto(subject, body) {
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  }

  // Download Excel file (wie downloadCSV)
  downloadExcel(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

// Create singleton instance and make it globally available
// Wait for ExcelJS to be loaded
if (typeof ExcelJS === 'undefined') {
  console.error('❌ ExcelJS not loaded yet!');
  // Create placeholder that will be replaced
  window.excelExport = null;
  // Try to create instance when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.excelExport = new ExcelExport();
      console.log('✅ excelExport instance created (DOM ready)');
    });
  } else {
    // DOM already loaded, try after small delay
    setTimeout(() => {
      window.excelExport = new ExcelExport();
      console.log('✅ excelExport instance created (delayed)');
    }, 100);
  }
} else {
  window.excelExport = new ExcelExport();
  console.log('✅ excelExport instance created immediately');
}
