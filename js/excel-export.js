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
      { width: 5 },   // Neuanlage (N)
      { width: 5 },   // Demontage (D)
      { width: 5 },   // Reparatur (R)
      { width: 5 },   // Wartung (W)
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
    worksheet.mergeCells('E1:L1');
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
        fgColor: { argb: 'FFD9D9D9' } // Light gray
      };
      cell.font = { bold: true, size: 10 };

      // Rotate text 90 degrees for category columns (8-11: N, D, R, W)
      if (colNumber >= 8 && colNumber <= 11) {
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

    headerRow2.height = 35;

    // Create a map of existing entries by date (same as CSV)
    const entriesMap = new Map();
    entries.forEach(entry => {
      entriesMap.set(entry.date, entry);
    });

    // Get number of days in month
    const lastDay = new Date(year, month, 0).getDate();

    // Helper to format date
    const pad2 = (n) => String(n).padStart(2, '0');

    // Data Rows - Generate for ALL days in month
    let currentRow = 3;
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${pad2(day)}.${pad2(month)}.${year}`;
      const date = this.parseDate(dateStr);
      const dayName = this.dayNames[date.getDay()];
      const dayOfWeek = date.getDay(); // 0=Sunday, 6=Saturday

      // Check if we have an entry for this day
      const entry = entriesMap.get(dateStr);

      let startTime = '';
      let endTime = '';
      let pause = '';
      let travelTime = '';
      let schmutzZulage = '';
      let flags = { N: '', D: '', R: '', W: '' };
      let tasksDescription = '';

      if (entry) {
        // Use entry data
        startTime = entry.startTime || '';
        endTime = entry.endTime || '';
        pause = entry.pause || '';
        travelTime = entry.travelTime || '';
        schmutzZulage = entry.surcharge || '';

        // Set flags based on task types (same as CSV export)
        if (entry.tasks && entry.tasks.length > 0) {
          entry.tasks.forEach(task => {
            if (flags.hasOwnProperty(task.type)) {
              flags[task.type] = 'X';
            }
          });
        }

        // Tasks description - match CSV format
        tasksDescription = entry.tasks && entry.tasks.length > 0
          ? entry.tasks.map(t => t.type ? `${t.description} [${t.type}]` : t.description).join(', ')
          : '';
      }

      const row = worksheet.getRow(currentRow);
      row.values = [
        dateStr,                             // Datum
        dayName,                             // Wochentag
        startTime,                           // ein
        endTime,                             // aus
        pause,                               // Pause
        travelTime,                          // Fahrt
        schmutzZulage,                       // Schmutz
        flags.N,                             // Neuanlage
        flags.D,                             // Demontage
        flags.R,                             // Reparatur
        flags.W,                             // Wartung
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

        // Center align for all except last column (Einsatzort)
        if (colNumber <= 11) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }

        cell.font = { size: 10 };

        // Gray background for weekends (Saturday=6, Sunday=0)
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' } // Light gray
          };
        }
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
