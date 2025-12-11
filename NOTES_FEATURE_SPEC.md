# Notizfunktion - Design-Spezifikation v1.6

**Erstellt:** 2025-12-11
**Ziel-Version:** v1.6 (oder später nach Tests)
**Status:** Design-Phase

---

## Überblick

Die Notizfunktion ermöglicht es Benutzern, kategorisierte Notizen zu erstellen und zu verwalten. Die Notizen können als freier Text oder als Checkliste (Items mit Erledigungs-Status) gespeichert werden.

---

## UI/UX Design

### 1. FAB-Button (Floating Action Button)

**Position:** Unten links (ähnlich wie Quick-Export FAB)
**Symbol:** Notizblock-Icon
**Farbe:** Primärfarbe (oder unterscheidbar vom Quick-Export Button)
**Verhalten:**
- Klick öffnet das Notizen-Modal
- Sichtbar auf der Homepage
- Badge mit Anzahl der unerledigten Items (optional)

```html
<!-- Konzept -->
<button id="notes-fab" class="fixed bottom-4 left-4 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg">
  ${ui.icon('notepad')} <!-- Notizblock-Symbol -->
</button>
```

---

### 2. Notizen-Modal

**Struktur:**
```
┌─────────────────────────────────────┐
│  📝 Meine Notizen              [X]  │
├─────────────────────────────────────┤
│  [Kategorie auswählen ▼]            │
│  [+ Neue Kategorie]                 │
├─────────────────────────────────────┤
│  ┌─ Nicht vergessen ─────────────┐ │
│  │ ○ Ersatzteile bestellen        │ │
│  │ ✓ Termin mit Chef             │ │
│  │ ○ Dokumentation aktualisieren │ │
│  │ [+ Neues Item]                 │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌─ Material im Auto ersetzen ───┐ │
│  │ Freier Text:                   │ │
│  │ - 3x Sicherungen (10A)         │ │
│  │ - Kabelbinder nachkaufen       │ │
│  │ [Bearbeiten]                   │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Funktionale Anforderungen

### 3. Kategorien

**Features:**
- Dropdown zur Auswahl der aktuellen Kategorie
- Standard-Kategorien (optional):
  - "Nicht vergessen"
  - "Material im Auto ersetzen"
  - "Allgemein"

**Verwaltung:**
- ➕ **Neu:** Dialog zum Erstellen einer neuen Kategorie
- ✏️ **Bearbeiten:** Kategorie-Name ändern
- 🗑️ **Löschen:** Kategorie löschen (mit Bestätigung)
  - Warnung: "Alle Notizen in dieser Kategorie werden gelöscht"

**Datenstruktur:**
```javascript
{
  id: 1,
  name: "Nicht vergessen",
  color: "#3B82F6", // optional
  createdAt: "2025-12-11T10:00:00Z"
}
```

---

### 4. Notizen

**Zwei Stile:**

#### A) **Text-Notiz**
- Freies Textfeld (mehrzeilig)
- Einfache Formatierung (optional: Markdown-Support)
- Zeitstempel

**Datenstruktur:**
```javascript
{
  id: 1,
  categoryId: 1,
  type: "text",
  content: "3x Sicherungen (10A)\nKabelbinder nachkaufen",
  createdAt: "2025-12-11T10:00:00Z",
  updatedAt: "2025-12-11T11:30:00Z"
}
```

#### B) **Checklist-Notiz (Items)**
- Liste von Items mit Checkbox
- Visuelle Darstellung: Leere Kreise (○) für unerledigt, Häkchen (✓) für erledigt
- Items können als erledigt markiert werden
- Erledigte Items bleiben sichtbar (durchgestrichen oder ausgegraut)

**Datenstruktur:**
```javascript
{
  id: 2,
  categoryId: 1,
  type: "checklist",
  items: [
    { id: 1, text: "Ersatzteile bestellen", completed: false },
    { id: 2, text: "Termin mit Chef", completed: true },
    { id: 3, text: "Dokumentation aktualisieren", completed: false }
  ],
  createdAt: "2025-12-11T10:00:00Z",
  updatedAt: "2025-12-11T12:00:00Z"
}
```

---

### 5. Notiz-Aktionen

**Pro Notiz:**
- ✏️ **Bearbeiten:** Inhalt ändern
- 🗑️ **Löschen:** Notiz entfernen (mit Bestätigung)
- 🔄 **Typ wechseln:** Text ↔ Checklist (optional)

**Pro Checklist-Item:**
- ✓ **Toggle:** Als erledigt/unerledigt markieren
- ✏️ **Bearbeiten:** Text ändern
- 🗑️ **Löschen:** Item entfernen

---

## Datenspeicherung (IndexedDB)

### Object Stores

#### **notes_categories**
```javascript
{
  id: auto-increment,
  name: string,
  color: string (optional),
  createdAt: ISO timestamp
}
```

#### **notes**
```javascript
{
  id: auto-increment,
  categoryId: number,
  type: "text" | "checklist",
  content: string (für type=text),
  items: array (für type=checklist),
  createdAt: ISO timestamp,
  updatedAt: ISO timestamp
}
```

**Indexes:**
- `categoryId` (für schnelles Filtern)
- `createdAt` (für Sortierung)

---

## Cloud-Sync (Optional, Firebase)

- Sync von Kategorien und Notizen
- Gleiche offline-first Strategie wie Worklog
- Fire-and-forget Sync im Hintergrund

---

## Implementierungs-Phasen

### Phase 1: Grundstruktur (v1.6.0-beta)
- [x] FAB-Button hinzufügen
- [ ] Notizen-Modal erstellen
- [ ] Kategorien-Verwaltung (CRUD)
- [ ] Storage-Methoden (IndexedDB)

### Phase 2: Notizen (v1.6.0)
- [ ] Text-Notizen erstellen/bearbeiten/löschen
- [ ] Checklist-Notizen erstellen/bearbeiten/löschen
- [ ] Item-Toggle (erledigt/unerledigt)

### Phase 3: Erweiterungen (v1.6.1+)
- [ ] Such-Funktion
- [ ] Export (CSV/Excel)
- [ ] Farbige Kategorien
- [ ] Archivierung erledigter Items
- [ ] Cloud-Sync Integration

---

## Wireframes / UI-Mockup

### Kategorien-Dropdown
```
┌──────────────────────────┐
│ Nicht vergessen       ▼  │ ← Aktuell ausgewählt
├──────────────────────────┤
│ Material im Auto         │
│ Allgemein                │
├──────────────────────────┤
│ + Neue Kategorie         │
│ ⚙ Kategorien verwalten   │
└──────────────────────────┘
```

### Notiz-Card (Checklist)
```
┌─ Nicht vergessen ──────────────┐
│                                 │
│ ○ Ersatzteile bestellen         │
│ ✓ Termin mit Chef              │
│ ○ Dokumentation aktualisieren  │
│                                 │
│ [+ Neues Item] [Bearbeiten]    │
└─────────────────────────────────┘
```

### Notiz-Card (Text)
```
┌─ Material im Auto ─────────────┐
│                                 │
│ - 3x Sicherungen (10A)          │
│ - Kabelbinder nachkaufen        │
│ - Isolierband                   │
│                                 │
│ Zuletzt bearbeitet: vor 2 Std   │
│                                 │
│ [Bearbeiten] [Löschen]         │
└─────────────────────────────────┘
```

---

## Accessibility & UX

- **Tastatur-Navigation:** Tab-Reihenfolge für alle Buttons
- **Screen Reader:** ARIA-Labels für Icons
- **Mobile:** Touch-freundliche Buttons (min. 44x44px)
- **Dark Mode:** Unterstützung für dunkle Themes
- **Offline:** Funktioniert ohne Internet (IndexedDB)

---

## Offene Fragen / Entscheidungen

1. **Soll es eine Suchfunktion geben?**
   - Ja, später in Phase 3

2. **Wie sollen erledigte Items dargestellt werden?**
   - Option A: Durchgestrichen + ausgegraut
   - Option B: In separate "Erledigt"-Sektion verschieben
   - **Entscheidung:** Option A (einfacher)

3. **Sollen Notizen ein Fälligkeitsdatum haben?**
   - Nein, erstmal nicht (kann später ergänzt werden)

4. **Export-Format?**
   - CSV: Kategorie, Typ, Inhalt, Status
   - Markdown: Für einfaches Teilen

---

## Testing-Plan

### Manuell am Handy testen:
- [ ] FAB-Button klickbar und sichtbar
- [ ] Modal öffnet/schließt korrekt
- [ ] Kategorie erstellen/bearbeiten/löschen
- [ ] Text-Notiz erstellen/bearbeiten/löschen
- [ ] Checklist-Notiz erstellen
- [ ] Items hinzufügen/toggle/löschen
- [ ] Offline-Funktionalität
- [ ] Dark Mode

### Edge Cases:
- [ ] Kategorie mit vielen Notizen löschen
- [ ] Leere Kategorien
- [ ] Sehr lange Notiz-Texte
- [ ] Sehr viele Checklist-Items (>50)

---

## Nächste Schritte

1. **Review dieser Spezifikation** durch User (Daniel)
2. **Am Handy testen** (vor Code-Implementierung):
   - Paper-Prototyp oder Figma-Mockup
   - Interaktions-Flow durchspielen
3. **Code-Implementierung** für v1.6.0 oder v1.6.1
4. **Beta-Testing** mit echten Daten
5. **Release** nach erfolgreichen Tests

---

**Fragen/Feedback bitte an:** daniel@liftec.at
