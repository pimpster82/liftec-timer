// LIFTEC Timer - Diagramm-Renderer
//
// Handgebautes Inline-SVG, bewusst ohne Bibliothek: sw.js löscht beim
// Aktivieren alle alten Caches, CDN-Dateien liegen nur im Laufzeit-Cache.
// Nach einem Versionsbump wäre eine Bibliothek beim ersten Offline-Start weg.
//
// Dieses Modul rechnet NICHT und kennt weder storage noch ui, app oder
// document - es bekommt Zahlen und Beschriftungen und gibt einen String
// zurück. Dadurch ist es ohne jedes Stub prüfbar und kann nicht anfangen,
// eine zweite Auswertung zu werden.

class Chart {
  constructor() {
    this.BUCKET_W = 44;      // Tap-Ziel, bewusst nicht kleiner
    this.BAR_W = 26;
    this.PANEL_A_H = 110;    // Balken
    this.PANEL_B_H = 56;     // Zeitkonto
    this.GAP = 16;
    this.AXIS_H = 22;
    this.PAD_TOP = 12;

    // Reihenfolge von unten nach oben. Nur das unterste Segment steht auf
    // gemeinsamer Basislinie und ist über Zeiträume hinweg exakt vergleichbar -
    // dafür qualifiziert sich "wie viel habe ich gearbeitet". Fehltage nach
    // oben, wo sie sofort auffallen.
    this.DAY_SERIES = [
      { key: 'workDays', label: 'work', color: 'var(--chart-work)' },
      { key: 'vacationDays', label: 'vacation', color: 'var(--chart-vacation)' },
      { key: 'sickDays', label: 'sick', color: 'var(--chart-sick)' },
      { key: 'holidayDays', label: 'holiday', color: 'var(--chart-holiday)' },
      { key: 'timeoffDays', label: 'timeoff', color: 'var(--chart-timeoff)' },
      // Fehltage als Geist: blasse Fläche mit dünnem Rand. Inhaltlich richtig -
      // ein Fehltag ist gerade KEINE Erfassung - und es löst eine echte
      // Kollision: Krankenstand ist bereits Rot, gestapelt wären beide
      // kaum zu trennen gewesen.
      { key: 'missingDays', label: 'missing', color: 'var(--chart-missing)', ghost: true }
    ];
  }

  // ===== Hilfsmittel =====

  _escape(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Hairlines liegen auf halben Pixeln, sonst verwaschen sie
  _crisp(value) {
    return Math.round(value) + 0.5;
  }

  _num(value) {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  }

  /**
   * Breite je Zeitraum. Bei wenigen Zeiträumen aufgeweitet, damit das
   * Diagramm die Fläche füllt statt links in der Ecke zu kleben.
   */
  bucketWidth(count, containerWidth = 320) {
    if (count <= 0) return this.BUCKET_W;
    if (count * this.BUCKET_W >= containerWidth) return this.BUCKET_W;

    return Math.max(this.BUCKET_W, Math.min(72, Math.floor(containerWidth / count)));
  }

  // ===== Beschriftung der X-Achse =====

  _bucketLabel(bucket, mode, options) {
    if (mode === 'week') return `${options.weekPrefix || 'KW'} ${bucket.weekNumber}`;

    const names = options.monthNames || [];
    return names[bucket.month] ? String(names[bucket.month]).slice(0, 3) : String(bucket.month + 1);
  }

  /**
   * Nicht jeder Zeitraum wird beschriftet - auf 360px kollidieren sonst die
   * Texte. Der gewählte und der letzte bekommen immer eine.
   */
  _showLabel(index, count, mode, selectedIndex) {
    if (index === count - 1 || index === selectedIndex) return true;

    const every = mode === 'week' ? 2 : (count > 14 ? 2 : 1);
    return (count - 1 - index) % every === 0;
  }

  // ===== Panel A: Balken =====

  _barScale(series, barMode) {
    const s = series.scale;

    if (barMode === 'balance') {
      const m = Math.max(Math.abs(s.balanceMin), Math.abs(s.balanceMax), 1);
      return { min: -m, max: m, zeroed: true };
    }

    if (barMode === 'hours') {
      return { min: 0, max: Math.max(s.maxHours, 1), zeroed: false };
    }

    return { min: 0, max: Math.max(s.maxStackDays, 1), zeroed: false };
  }

  _renderBars(series, barMode, geo, scale) {
    const { top, height, bucketW, barW } = geo;
    const span = scale.max - scale.min;
    const yOf = (v) => top + height * (1 - (v - scale.min) / span);
    const parts = [];

    for (const bucket of series.buckets) {
      const x = bucket.index * bucketW + (bucketW - barW) / 2;

      if (barMode === 'days') {
        let baseline = top + height;

        for (const serie of this.DAY_SERIES) {
          const days = bucket[serie.key] || 0;
          if (days <= 0) continue;

          const full = days / scale.max * height;
          // Ein Ein-Tages-Segment darf durch den Fugenabzug nicht verschwinden
          const drawn = full > 3 ? full - 2 : full;
          baseline -= full;

          if (serie.ghost) {
            // Ein Strich liegt mittig auf der Kante - deshalb das Rechteck um
            // einen halben Pixel einrücken, sonst ragt der halbe Rand über
            // die Balkenbreite hinaus
            parts.push(`<rect x="${this._num(x + 0.5)}" y="${this._num(baseline + 0.5)}" width="${this._num(barW - 1)}" height="${this._num(Math.max(0, drawn - 1))}" rx="2" fill="${serie.color}" stroke="var(--chart-missing-border)" stroke-width="1"/>`);
            continue;
          }

          parts.push(`<rect x="${this._num(x)}" y="${this._num(baseline)}" width="${barW}" height="${this._num(drawn)}" rx="2" fill="${serie.color}"/>`);
        }

        // Vorschau: was im laufenden Zeitraum noch aussteht. Gestrichelter
        // Rand statt durchgezogen - durchgezogen heisst "versaeumt",
        // gestrichelt heisst "steht noch aus".
        const offen = bucket.remainingWorkDays || 0;
        if (offen > 0) {
          const h = offen / scale.max * height;
          parts.push(this._forecastRect(x, baseline - h, barW, h));
        }
        continue;
      }

      if (barMode === 'hours') {
        const h = (bucket.actualHours || 0) / scale.max * height;
        if (h > 0) {
          parts.push(`<rect x="${this._num(x)}" y="${this._num(top + height - h)}" width="${barW}" height="${this._num(h)}" rx="2" fill="var(--chart-work)"/>`);
        }

        // Vorschau: die noch ausstehenden Sollstunden oben drauf. Reicht der
        // Stapel bis zur Soll-Marke, liegt man im Plan.
        const offen = bucket.remainingTargetHours || 0;
        if (offen > 0) {
          const oh = offen / scale.max * height;
          parts.push(this._forecastRect(x, top + height - h - oh, barW, oh));
        }

        // Soll als Markierung, nicht als zweiter Balken - es ist die Referenz.
        // Im laufenden Zeitraum das VOLLE Periodensoll, damit die Vorschau
        // etwas zum Anstreben hat.
        const soll = (bucket.targetHours || 0) + offen;
        if (soll > 0) {
          const y = this._crisp(yOf(soll));
          parts.push(`<line x1="${this._num(x - 3)}" y1="${y}" x2="${this._num(x + barW + 3)}" y2="${y}" stroke="var(--chart-line)" stroke-width="1.5" stroke-dasharray="3 2" opacity="0.75"/>`);
        }
        continue;
      }

      // Saldo: um die Nulllinie
      const zeroY = yOf(0);
      const valueY = yOf(bucket.balance || 0);
      const h = Math.abs(valueY - zeroY);
      if (h < 0.5) continue;

      parts.push(`<rect x="${this._num(x)}" y="${this._num(Math.min(zeroY, valueY))}" width="${barW}" height="${this._num(h)}" rx="2" fill="${bucket.balance >= 0 ? 'var(--chart-plus)' : 'var(--chart-minus)'}"/>`);
    }

    // Nulllinie bzw. Grundlinie
    const zeroY = this._crisp(scale.zeroed ? yOf(0) : top + height);
    parts.push(`<line x1="0" y1="${zeroY}" x2="${geo.totalW}" y2="${zeroY}" stroke="var(--chart-grid)" stroke-width="1"/>`);

    return parts.join('');
  }

  /**
   * Das Vorschau-Segment: blasse Flaeche mit duennem GESTRICHELTEM Rand.
   * Der Fehltage-Geist traegt denselben Aufbau mit durchgezogenem Rand -
   * daran unterscheidet man "versaeumt" von "steht noch aus".
   */
  _forecastRect(x, y, width, height) {
    if (height <= 0) return '';

    return `<rect x="${this._num(x + 0.5)}" y="${this._num(y + 0.5)}" width="${this._num(width - 1)}" height="${this._num(Math.max(0, height - 1))}" rx="2" fill="var(--chart-forecast)" stroke="var(--chart-forecast-border)" stroke-width="1" stroke-dasharray="3 2"/>`;
  }

  // ===== Panel B: Zeitkonto-Linie =====

  _renderAccountLine(series, geo, options) {
    const { top, height, bucketW } = geo;
    const s = series.scale;

    let min = Math.min(0, s.accountMin);
    let max = Math.max(0, s.accountMax);
    if (max - min < 1e-9) { min -= 1; max += 1; }         // sonst Division durch null

    const pad = (max - min) * 0.08;
    min -= pad;
    max += pad;

    const yOf = (v) => top + height * (1 - (v - min) / (max - min));
    const xOf = (i) => i * bucketW + bucketW / 2;

    const parts = [];

    // Null ist immer im Bild - ohne sie hat der Trend keinen Bezugspunkt
    const zeroY = this._crisp(yOf(0));
    parts.push(`<line x1="0" y1="${zeroY}" x2="${geo.totalW}" y2="${zeroY}" stroke="var(--chart-grid)" stroke-width="1" stroke-dasharray="4 3"/>`);

    // Lücken vor dem Stichtag trennen die Linie, statt darüber zu interpolieren
    let run = [];
    const flush = () => {
      if (run.length >= 2) {
        parts.push(`<polyline points="${run.join(' ')}" fill="none" stroke="var(--chart-line)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
      } else if (run.length === 1) {
        const [x, y] = run[0].split(',');
        parts.push(`<circle cx="${x}" cy="${y}" r="2.5" fill="var(--chart-line)"/>`);
      }
      run = [];
    };

    let last = null;
    for (const bucket of series.buckets) {
      if (bucket.accountBalance === null) { flush(); continue; }

      const x = this._num(xOf(bucket.index));
      const y = this._num(yOf(bucket.accountBalance));
      run.push(`${x},${y}`);
      last = { x, y, value: bucket.accountBalance };
    }
    flush();

    // Der letzte Punkt wird direkt beschriftet: der aktuelle Kontostand ist
    // die eine Zahl, auf die es ankommt. Keine Zahl an jedem Punkt.
    if (last && options.formatHours) {
      const text = options.formatHours(last.value);
      const above = last.y > top + height / 2;

      parts.push(`<circle cx="${last.x}" cy="${last.y}" r="3" fill="var(--chart-line)"/>`);
      parts.push(`<text x="${this._num(last.x - 6)}" y="${this._num(above ? last.y - 7 : last.y + 14)}" text-anchor="end" font-size="10" font-weight="600" fill="var(--chart-line)">${this._escape(text)}</text>`);
    }

    return parts.join('');
  }

  // ===== Gesamtbild =====

  /**
   * @param {Object} series - Rückgabe von statistics.calculateSeries()
   * @param {Object} options - { barMode, monthNames, weekPrefix, selected,
   *                             containerWidth, formatHours, ariaLabel }
   * @returns {string} vollständiges <svg>, breiter als der Container
   */
  renderSeriesChart(series, options = {}) {
    const buckets = series?.buckets || [];
    if (buckets.length === 0) return '';

    const barMode = options.barMode || (series.mode === 'week' ? 'hours' : 'days');
    const selected = Number.isInteger(options.selected) ? options.selected : buckets.length - 1;
    const showAccount = !!series.accountAvailable;

    const bucketW = this.bucketWidth(buckets.length, options.containerWidth);
    const barW = Math.min(this.BAR_W, bucketW - 14);
    const totalW = buckets.length * bucketW;

    const panelA = { top: this.PAD_TOP, height: this.PANEL_A_H, bucketW, barW, totalW };
    const panelB = {
      top: this.PAD_TOP + this.PANEL_A_H + this.GAP,
      height: this.PANEL_B_H, bucketW, barW, totalW
    };

    const totalH = showAccount
      ? panelB.top + this.PANEL_B_H + this.AXIS_H
      : this.PAD_TOP + this.PANEL_A_H + this.AXIS_H;

    const scale = this._barScale(series, barMode);
    const parts = [];

    // Hinterlegung des gewählten Zeitraums, ganz nach hinten
    parts.push(`<rect class="chart-sel" x="${this._num(selected * bucketW)}" y="0" width="${bucketW}" height="${totalH - this.AXIS_H + 4}" rx="4" fill="var(--chart-sel)"/>`);

    // Obergrenze der Balkenskala beschriften - eine Zahl genügt
    const topLabel = barMode === 'days'
      ? String(Math.round(scale.max))
      : (options.formatHours ? options.formatHours(scale.max) : String(Math.round(scale.max)));
    parts.push(`<line x1="0" y1="${this._crisp(panelA.top)}" x2="${totalW}" y2="${this._crisp(panelA.top)}" stroke="var(--chart-grid)" stroke-width="1"/>`);
    parts.push(`<text x="2" y="${panelA.top - 3}" font-size="9" fill="var(--chart-muted)">${this._escape(topLabel)}</text>`);

    parts.push(this._renderBars(series, barMode, panelA, scale));

    if (showAccount) {
      parts.push(this._renderAccountLine(series, panelB, options));
    }

    // X-Achse
    const axisY = totalH - 6;
    for (const bucket of buckets) {
      if (!this._showLabel(bucket.index, buckets.length, series.mode, selected)) continue;

      const x = bucket.index * bucketW + bucketW / 2;
      const bold = bucket.index === selected;
      parts.push(`<text x="${this._num(x)}" y="${axisY}" text-anchor="middle" font-size="10" font-weight="${bold ? '700' : '400'}" fill="${bold ? 'var(--chart-line)' : 'var(--chart-muted)'}">${this._escape(this._bucketLabel(bucket, series.mode, options))}</text>`);

      // Jahreszahl nur beim Wechsel, sonst wiederholt sie sich sinnlos
      if (series.mode === 'month' && (bucket.month === 0 || bucket.index === 0)) {
        parts.push(`<text x="${this._num(x)}" y="${axisY - 11}" text-anchor="middle" font-size="8" fill="var(--chart-muted)">${bucket.year}</text>`);
      }
    }

    // Tap-Ziele zuletzt, also über allem
    for (const bucket of buckets) {
      parts.push(`<rect class="chart-hit" data-index="${bucket.index}" x="${this._num(bucket.index * bucketW)}" y="0" width="${bucketW}" height="${totalH}" fill="transparent" pointer-events="all"/>`);
    }

    return `<svg width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" class="block" role="img" aria-label="${this._escape(options.ariaLabel || '')}">${parts.join('')}</svg>`;
  }

  /**
   * Legende als HTML - bewusst getrennt vom SVG, damit sie beim seitlichen
   * Scrollen stehen bleibt.
   */
  renderLegend(barMode, options = {}) {
    const labels = options.labels || {};
    let items;

    if (barMode === 'days') {
      items = this.DAY_SERIES.map(s => ({
        color: s.color,
        label: labels[s.label] || s.label,
        // Der Geist braucht auch in der Legende seinen Rand, sonst sieht man
        // dort ein leeres Kästchen
        border: s.ghost ? 'var(--chart-missing-border)' : null
      }));
    } else if (barMode === 'balance') {
      items = [
        { color: 'var(--chart-plus)', label: labels.plus || '+' },
        { color: 'var(--chart-minus)', label: labels.minus || '−' }
      ];
    } else {
      items = [{ color: 'var(--chart-work)', label: labels.actual || '' }];
    }

    // Der Eintrag erscheint nur, wenn im Bild tatsaechlich etwas aussteht
    if (options.showForecast && barMode !== 'balance') {
      items.push({
        color: 'var(--chart-forecast)',
        label: labels.stillOpen || '',
        border: 'var(--chart-forecast-border)',
        dashed: true
      });
    }

    if (options.showAccount) {
      items.push({ color: 'var(--chart-line)', label: labels.account || '', line: true });
    }

    return `
      <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        ${items.map(item => `
          <span class="flex items-center gap-1.5">
            <span class="inline-block ${item.line ? 'w-3 h-0.5' : 'w-2.5 h-2.5 rounded-sm'}" style="background:${item.color}${item.border ? `;border:1px ${item.dashed ? 'dashed' : 'solid'} ${item.border}` : ''}"></span>
            <span>${this._escape(item.label)}</span>
          </span>
        `).join('')}
      </div>
    `;
  }

  /**
   * Auswahl umhängen, ohne neu zu zeichnen. Zwei Attributänderungen statt
   * eines kompletten Neuaufbaus - dadurch bleibt die Scrollposition erhalten,
   * weil das Element dasselbe bleibt.
   */
  setSelection(svgElement, index) {
    if (!svgElement) return;

    const marker = svgElement.querySelector('.chart-sel');
    const hit = svgElement.querySelector(`.chart-hit[data-index="${index}"]`);
    if (!marker || !hit) return;

    marker.setAttribute('x', hit.getAttribute('x'));
  }
}

// Singleton-Instanz
const chart = new Chart();

// Für Node-basierte Tests (im Browser nicht vorhanden)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Chart, chart };
}
