# Firebase Setup Guide für LIFTEC Timer

## 🎯 Architektur: Offline First

**Wichtig:** Die App funktioniert IMMER offline. Firebase ist nur ein optionaler Sync-Layer.

```
User Action
    ↓
IndexedDB speichern (SOFORT) ✅
    ↓
UI aktualisieren (SOFORT) ✅
    ↓
Firebase Sync (async im Hintergrund) 🔄
    ↓
Bei Offline: Kein Problem! ✅
Bei Online: Sync läuft automatisch 🔄
```

### Garantien:
- ✅ **App funktioniert ohne Internet**
- ✅ **Keine Operation wartet auf Firebase**
- ✅ **Sync-Fehler brechen die App nicht**
- ✅ **IndexedDB ist immer die Source of Truth**

---

## 📦 Firebase Projekt erstellen

### Schritt 1: Firebase Console
1. Gehe zu https://console.firebase.google.com
2. Klicke "Projekt hinzufügen"
3. Projektname: `liftec-timer` (oder beliebig)
4. Google Analytics: Optional (kann deaktiviert werden)
5. Projekt erstellen

### Schritt 2: Web-App registrieren
1. Im Firebase-Projekt: Klicke auf das **Web-Icon** (</>)
2. App-Spitzname: `LIFTEC Timer Web`
3. Firebase Hosting: **NEIN** (wir hosten selbst)
4. "App registrieren"

### Schritt 3: Configuration kopieren
Firebase zeigt dir einen Code-Block wie:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC...",
  authDomain: "liftec-timer-xxx.firebaseapp.com",
  projectId: "liftec-timer-xxx",
  storageBucket: "liftec-timer-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

**Kopiere diese Werte** in `js/firebase-config.js`

---

## 🔧 Firebase Dienste aktivieren

### 1. Authentication aktivieren
1. Linke Sidebar → **Authentication**
2. "Get Started" klicken
3. **Sign-in method** Tab
4. Aktiviere:
   - ✅ **Email/Password** (für registrierte User)
   - ✅ **Anonymous** (für Test/Offline-First)

### 2. Firestore Database erstellen
1. Linke Sidebar → **Firestore Database**
2. "Datenbank erstellen"
3. Produktionsmodus **ODER** Testmodus:
   - **Testmodus** (für Development): Daten sind 30 Tage offen
   - **Produktionsmodus**: Wir setzen eigene Rules (siehe unten)
4. Region wählen: **europe-west3** (Frankfurt - DSGVO konform)
5. "Aktivieren"

### 3. Firestore Security Rules

Gehe zu **Firestore Database** → **Rules** und ersetze mit:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users Collection - nur eigene Daten
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      // Subcollections unter /users/{userId}/
      match /{subcollection}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    // Share Profiles - öffentlich lesbar für Friend-Add via QR-Code
    match /share_profiles/{userId} {
      // Jeder angemeldete User kann Profile lesen (für Friend-Add & Nickname-Check)
      allow read: if request.auth != null;

      // Nur eigenes Profil erstellen/bearbeiten
      allow create, update: if request.auth != null && request.auth.uid == userId;

      // Löschen nicht erlaubt
      allow delete: if false;
    }

    // Shared Entries - für Friend-Sharing (v1.6.0+)
    match /shared_entries/{shareId} {
      // Lesen: Nur wenn du sender (from) oder recipient (recipientId) bist
      allow read: if request.auth != null &&
                  (resource.data.recipientId == request.auth.uid ||
                   resource.data.from == request.auth.uid);

      // Erstellen: Nur als sender (from muss deine User-ID sein)
      allow create: if request.auth != null &&
                    request.resource.data.from == request.auth.uid;

      // Update: Nur als recipient (um status zu ändern: imported/declined)
      allow update: if request.auth != null &&
                    resource.data.recipientId == request.auth.uid;

      // Löschen: Sender oder Recipient können löschen
      allow delete: if request.auth != null &&
                    (resource.data.recipientId == request.auth.uid ||
                     resource.data.from == request.auth.uid);
    }
  }
}
```

**Wichtig:** Diese Rules bedeuten:
- ✅ Jeder User kann nur seine eigenen Daten sehen (`/users/{userId}/...`)
- ✅ Anonyme User haben auch Zugriff (aber nur auf ihre Daten)
- ✅ Share-Profile sind **öffentlich lesbar** für angemeldete User (für QR-Code Friend-Add & Nickname-Suche)
- ✅ Jeder User kann nur sein **eigenes** Share-Profil erstellen/bearbeiten
- ✅ Users können Worklog-Einträge mit Friends teilen (`shared_entries`)
- ✅ Users sehen nur geteilte Einträge, wo sie sender (`from`) oder recipient (`recipientId`) sind

---

## 🔐 Config in App einfügen

Öffne `js/firebase-config.js` und ersetze die Werte:

```javascript
const firebaseConfig = {
  apiKey: "DEIN_API_KEY",              // Von Firebase Console kopieren
  authDomain: "DEIN_PROJECT.firebaseapp.com",
  projectId: "DEIN_PROJECT_ID",
  storageBucket: "DEIN_PROJECT.appspot.com",
  messagingSenderId: "DEINE_SENDER_ID",
  appId: "DEIN_APP_ID"
};
```

**Sicherheit:** Diese Config kann öffentlich sein! Die Security kommt von den Firestore Rules.

---

## 📊 Datenstruktur in Firestore

Firebase erstellt automatisch diese Struktur:

```
users/
  {userId}/
    data/
      settings/          → User-Einstellungen (inkl. Zeitkonto & Urlaub)
      onCall/            → Bereitschaft: alle Perioden in einem Dokument
        periods: [...]
        nextId: 4
        updatedAt: Timestamp

    sessions/
      current/           → Aktuelle Session

    worklog/
      {entryId}/         → Worklog-Einträge
        date: "15.11.2025"
        startTime: "08:00"
        endTime: "16:30"
        tasks: [...]
        updatedAt: Timestamp

    callouts/
      {calloutId}/       → Bereitschaftseinsätze (v1.21.2)
        groupId: "1754..."      zusammengehörige Segmente
        onCallPeriodId: 3
        date: "05.07.2025"
        startTime: "22:00"
        endTime: "24:00"        Einsätze über Mitternacht werden gesplittet
        description: "..."
        yearMonth: "2025-07"
        updatedAt: Timestamp
```

> **Regeln:** `onCall` und `callouts` liegen beide unter `/users/{userId}/`
> und sind damit bereits von der bestehenden Subcollection-Regel abgedeckt.
> Es ist **keine Änderung an den Security Rules nötig**.

---

## 🧪 Testen

### 1. Lokaler Test (ohne Firebase)
- App öffnen
- Settings öffnen
- **KEIN** Cloud-Sync-Bereich sichtbar
- ✅ App funktioniert normal

### 2. Mit Firebase (nach Config)
- App öffnen
- Settings öffnen
- ✅ Cloud-Sync-Bereich ist sichtbar
- "Anonym anmelden" klicken
- ✅ Status zeigt "Anonym angemeldet"
- Worklog-Eintrag erstellen
- ✅ Eintrag erscheint sofort (IndexedDB)
- Firebase Console öffnen → Firestore
- ✅ Eintrag erscheint auch in Cloud (nach paar Sekunden)

### 3. Multi-Device Sync Test
- Gerät A: Anonym anmelden
- ⚠️ User ID notieren! (Im Console: `firebaseService.getUserId()`)
- Gerät B: Mit GLEICHER User ID anmelden (nicht möglich bei anonym)
- **Besser:** Mit Email registrieren, dann auf beiden Geräten anmelden
- ✅ Änderungen synced automatisch

---

## 💰 Kosten Monitor

### Free Tier Limits
- 50.000 Reads/Tag
- 20.000 Writes/Tag
- 1 GB Storage

### In Firebase Console checken:
1. **Usage** Tab (linke Sidebar)
2. Firestore: Aktueller Verbrauch
3. Authentication: Anzahl User

### Warnung einrichten:
1. Firebase Console → **Usage and billing**
2. "Set budget alert"
3. Limit: z.B. 5€/Monat
4. Email-Benachrichtigung bei 80%

---

## 🔄 Wie funktioniert Offline-Sync?

### Scenario 1: Offline arbeiten
```
1. User ist offline
2. Worklog-Eintrag erstellen
   → Sofort in IndexedDB ✅
   → Firebase Sync versucht, scheitert still
3. UI funktioniert normal ✅
4. User geht online
   → Nächster Eintrag triggert Sync
   → ALLE ausstehenden Änderungen werden gesynct
```

### Scenario 2: Multi-Device
```
Device A:                    Device B:
Eintrag erstellen            (offline)
  → IndexedDB ✅
  → Firebase ✅

[Device B geht online]
                            → Firebase Pull
                            → IndexedDB Update
                            → UI Refresh ✅
```

### Scenario 3: Konflikt
```
Device A (offline):    Device B (online):
Eintrag X ändern       Eintrag X ändern
  → IndexedDB ✅         → IndexedDB ✅
                        → Firebase ✅

[Device A geht online]
  → Firebase Sync
  → Konflikt!
  → Cloud gewinnt (Last-Write-Wins)
```

**Hinweis:** Für echtes Conflict Resolution müsste man Timestamps/Versionen vergleichen.

---

## 🐛 Troubleshooting

### Problem: "Cloud Sync" Sektion fehlt in Settings
**Lösung:**
- Browser Console öffnen (F12)
- Check: `typeof firebase` → sollte "object" sein
- Check: `firebaseService.isInitialized` → sollte true sein
- Wenn false: Config in `firebase-config.js` prüfen

### Problem: "Permission denied" beim Sync
**Lösung:**
- Firestore Rules prüfen (siehe oben)
- User muss angemeldet sein
- User ID muss mit Firestore Path übereinstimmen

### Problem: "Share listener error: Missing or insufficient permissions"
**Ursache:** Die Firestore Security Rules fehlen für die `shared_entries` Collection (Friend-Sharing Feature ab v1.6.0)

**Lösung:**
1. Firebase Console öffnen → **Firestore Database** → **Rules**
2. Die Rules mit den **aktualisierten Rules** von oben ersetzen (inkl. `shared_entries` Block)
3. "Veröffentlichen" klicken
4. App neu laden

**Hinweis:** Dieser Fehler ist harmlos für die Hauptfunktionen der App. Er betrifft nur das Friend-Sharing Feature. Die App funktioniert trotzdem normal für normale Worklog-Einträge.

### Problem: "checkNicknameAvailable failed" oder "Create share profile failed: Missing or insufficient permissions"
**Ursache:** Die Firestore Security Rules fehlen für die `share_profiles` Collection

**Lösung:**
1. Firebase Console öffnen → **Firestore Database** → **Rules**
2. Die Rules mit den **aktualisierten Rules** von oben ersetzen (inkl. `share_profiles` Block)
3. "Veröffentlichen" klicken
4. App neu laden

**Wichtig:** Die `share_profiles` Collection muss für **alle angemeldeten User lesbar** sein, damit:
- Nickname-Verfügbarkeit geprüft werden kann
- Friends via QR-Code hinzugefügt werden können
- Friend-Profile angezeigt werden können

### Problem: Daten nicht gesynct
**Lösung:**
- Settings → Cloud Sync **aktiviert**?
- User angemeldet?
- Browser Console: Errors?
- Firebase Console → Firestore → Daten vorhanden?

### Problem: Zu viele Reads
**Lösung:**
- Realtime Listeners deaktivieren wenn nicht gebraucht
- Cache nutzen (ist schon implementiert)
- Nur neue Daten pullen (ist schon implementiert)

---

## 📚 Nächste Schritte

1. ✅ Firebase Projekt erstellen
2. ✅ Config in `firebase-config.js` einfügen
3. ✅ Firestore Rules setzen
4. ✅ Testen: Anonym anmelden
5. ✅ Testen: Eintrag erstellen → Firestore prüfen
6. ⏳ Optional: Email/Password statt Anonym
7. ⏳ Optional: Multi-Device testen

---

## 🔒 Sicherheit & DSGVO

### Datenschutz
- ✅ User-Daten sind isoliert (Security Rules)
- ✅ Server in EU (Frankfurt)
- ✅ Google Firebase DSGVO-konform
- ⚠️ Privacy Policy erforderlich bei Produktion
- ⚠️ Cookie-Banner erforderlich (Firebase nutzt Cookies)

### Empfohlene Maßnahmen
1. Privacy Policy hinzufügen
2. "Impressum" Link
3. Cookie-Consent (z.B. cookie-notice.js)
4. DSGVO-Hinweis in Settings

---

Viel Erfolg! 🚀
