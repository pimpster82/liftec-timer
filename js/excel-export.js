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

  // Convert time string "HH:MM" to decimal hours
  timeToDecimal(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours + (minutes / 60);
  }

  // Parse DD.MM.YYYY to Date
  parseDate(dateStr) {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
  }

  async generateXLSX(entries, year, month, userName) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`Arbeitszeit {name} MM JJJJ`);

    // Set column widths
    worksheet.columns = [
      { width: 12 },  // Datum
      { width: 12 },  // Wochentag
      { width: 10 },  // ein
      { width: 10 },  // aus
      { width: 8 },   // Pause
      { width: 8 },   // Fahrt
      { width: 10 },  // Schmutz
      { width: 5 },   // X1
      { width: 5 },   // X2
      { width: 5 },   // X3
      { width: 60 }   // Einsatzort
    ];

    // Header Row 1: Month/Year and Name
    const headerRow1 = worksheet.getRow(1);
    const monthName = this.monthNames[month - 1];

    // Merge cells for month
    worksheet.mergeCells('A1:B1');
    const monthCell = worksheet.getCell('A1');
    monthCell.value = `${monthName} ${year}`;
    monthCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF92D050' } // Green
    };
    monthCell.font = { bold: true, size: 14 };
    monthCell.alignment = { vertical: 'middle', horizontal: 'center' };
    monthCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    // Merge cells for name
    worksheet.mergeCells('E1:K1');
    const nameCell = worksheet.getCell('E1');
    nameCell.value = `NAME: ${userName}`;
    nameCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' } // White
    };
    nameCell.font = { bold: true, size: 14 };
    nameCell.alignment = { vertical: 'middle', horizontal: 'left' };
    nameCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    headerRow1.height = 25;

    // Header Row 2: Column Headers
    const headerRow2 = worksheet.getRow(2);
    headerRow2.values = [
      'Datum',
      'Wochentag',
      'Arbeitszeit\nein',
      'Arbeitszeit\naus',
      'Pause\nDauer',
      'Fahrt\nzeit',
      'Schmutz\nzulage',
      '',
      '',
      '',
      'Einsatzort, Tätigkeit, Bemerkungen'
    ];

    headerRow2.eachCell((cell, colNumber) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' } // Light gray
      };
      cell.font = { bold: true, size: 10 };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    headerRow2.height = 35;

    // Sort entries by date
    const sortedEntries = entries.sort((a, b) => {
      const dateA = this.parseDate(a.date);
      const dateB = this.parseDate(b.date);
      return dateA - dateB;
    });

    // Data Rows
    let currentRow = 3;
    for (const entry of sortedEntries) {
      const date = this.parseDate(entry.date);
      const dayName = this.dayNames[date.getDay()];

      // Get saved values
      const startTime = entry.startTime || '';
      const endTime = entry.endTime || '';

      // Calculate total work hours for X mark only
      let totalHours = 0;
      if (startTime && endTime) {
        const start = this.timeToDecimal(startTime);
        const end = this.timeToDecimal(endTime);
        const pauseDecimal = this.timeToDecimal(entry.pause || '0:00');
        totalHours = end - start - pauseDecimal;
      }

      // Use saved surcharge from entry (don't recalculate!)
      const schmutzZulage = entry.surcharge || '';

      // Tasks description - match CSV format
      const tasksDescription = entry.tasks && entry.tasks.length > 0
        ? entry.tasks.map(t => t.type ? `${t.description} [${t.type}]` : t.description).join(', ')
        : '';

      const row = worksheet.getRow(currentRow);
      row.values = [
        entry.date,                          // Datum
        dayName,                             // Wochentag
        startTime,                           // ein
        endTime,                             // aus
        entry.pause || '',                   // Pause (use saved value)
        entry.travelTime || '',              // Fahrt (use saved value)
        schmutzZulage,                       // Schmutz (use saved value)
        totalHours > 0 ? 'X' : '',          // X1
        '',                                  // X2 (leer)
        '',                                  // X3 (leer)
        tasksDescription                     // Einsatzort
      ];

      // Format cells
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        // Center align for all except last column
        if (colNumber <= 10) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }

        cell.font = { size: 10 };
      });

      currentRow++;
    }

    // Generate buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const monthNameForFile = this.monthNames[month - 1];
    const filename = `Arbeitszeit ${userName} ${monthNameForFile} ${year}.xlsx`;

    // Download
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  }
}

// Create singleton instance
const excelExport = new ExcelExport();
