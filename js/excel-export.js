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
      fitToHeight: 1,
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

    // Set column widths
    worksheet.columns = [
      { width: 11 },  // Datum
      { width: 11 },  // Wochentag
      { width: 10 },  // ein
      { width: 10 },  // aus
      { width: 9 },   // Pause
      { width: 9 },   // Fahrt
      { width: 9 },   // Schmutz
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

    const nameCell = worksheet.getCell('L1');
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

      row.getCell(8).value = flags.N;
      row.getCell(9).value = flags.D;
      row.getCell(10).value = flags.R;
      row.getCell(11).value = flags.W;

      row.getCell(12).value = tasksDescription;

      // Format
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        // Align
        if (colNumber <= 11) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }

        cell.font = { size: 10 };

        // FIXED weekend coloring: 0 = Sunday, 6 = Saturday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
        }
      });

      currentRow++;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const monthNameForFile = this.monthNames[month - 1];
    const filename = `Arbeitszeit ${userName} ${monthNameForFile} ${year}.xlsx`;

    return { buffer, blob, filename };
  }

  // === NEU: EXACT WIE BEIM CSV – MAIL & SHARE ===
  async exportAndSend(entries, year, month, userName, settings) {
    const { blob, filename } = await this.generateXLSX(entries, year, month, userName);
    this.sendEmail(blob, filename, settings);
  }

  // Send Excel via email (using Web Share API or mailto)
  sendEmail(blob, filename, settings) {
  const monthStr = filename.match(/(\w+) \d{4}/)[1];
  const subject = settings.emailSubject
    .replace('{month}', monthStr)
    .replace('{name}', settings.username);
  const body = settings.emailBody
    .replace('{month}', monthStr)
    .replace('{name}', settings.username);

  const file = new File([blob], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({
      title: subject,
      text: body,
      files: [file]
    })
    .then(() => console.log('Excel geteilt'))
    .catch(() => this.sendMailto(settings.email, subject, body));
  } else {
    this.sendMailto(settings.email, subject, body);
  }
}

  // Send email using mailto (without attachment)
  sendMailto(email, subject, body) {
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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

// Create singleton instance
const excelExport = new ExcelExport();