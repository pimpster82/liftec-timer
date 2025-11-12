# LIFTEC Timer - Progressive Web App

A modern, offline-first time tracking application for LIFTEC. Converted from iOS Scriptable app to a cross-platform Progressive Web App (PWA).

## ⚠️ Important: Storage Limitations

**Current Version (1.0.0) stores all data locally in your browser using IndexedDB.**

This means:
- ❌ **No sync between devices** - Data on your phone won't appear on your desktop
- ❌ **No cloud backup** - Data can be lost if browser cache/data is cleared
- ❌ **Browser-specific** - Chrome and Safari on the same device have separate data
- ✅ **Fully offline** - Works without internet, completely private
- ✅ **Manual export** - You can export CSV reports anytime

**📋 See [ROADMAP.md](ROADMAP.md) for upcoming cloud sync features (Supabase, Dropbox, iCloud, etc.)**

**💡 Recommendation:** Export your data regularly until cloud sync is implemented!

---

## Features

- ⏱️ **Time Tracking** - Track work sessions with start/end times
- 📝 **Task Management** - Add and categorize tasks (Neuanlage, Demontage, Reparatur, Wartung)
- 📊 **CSV Export** - Export monthly reports as CSV files
- 🌐 **Offline First** - Works completely offline, no internet required
- 📱 **Installable** - Install as a native-like app on any device
- 🔄 **Auto Updates** - Over-The-Air (OTA) updates with user notification
- 🎨 **Modern UI** - Clean, responsive design with dark mode support
- 💾 **Local Storage** - All data stored locally using IndexedDB
- 🌍 **Multi-language** - Support for German, English, and Croatian

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Storage**: IndexedDB
- **PWA**: Service Worker, Web Manifest
- **Icons**: Need to be generated (see below)

## Installation & Setup

### 1. Development Setup

1. **Clone or download** this repository to your local machine

2. **Generate App Icons** (required):
   - You need to create PNG icons in the `/icons` directory
   - Required sizes: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
   - Use the LIFTEC branding colors (primary: #FFB300)
   - Tool recommendations:
     - [PWA Asset Generator](https://github.com/elegantapp/pwa-asset-generator)
     - [RealFaviconGenerator](https://realfavicongenerator.net/)
   - Quick setup with a simple logo:
     ```bash
     # If you have ImageMagick installed:
     # Create a simple colored square as placeholder
     convert -size 512x512 xc:#FFB300 icons/icon-512.png
     convert icons/icon-512.png -resize 192x192 icons/icon-192.png
     convert icons/icon-512.png -resize 384x384 icons/icon-384.png
     # ... repeat for other sizes
     ```

3. **Local Development**:
   - Option A: Use Python's built-in server
     ```bash
     python -m http.server 8000
     ```
   - Option B: Use Node.js http-server
     ```bash
     npx http-server -p 8000
     ```
   - Option C: Use PHP
     ```bash
     php -S localhost:8000
     ```
   - Option D: Use VS Code Live Server extension

4. **Open in browser**:
   - Navigate to `http://localhost:8000`
   - The app should load and work offline

### 2. Production Deployment

#### Option A: GitHub Pages (Recommended - FREE)

1. **Create a GitHub repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - LIFTEC Timer PWA"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/liftec-timer.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository settings on GitHub
   - Navigate to "Pages" section
   - Select "main" branch as source
   - Click Save

3. **Access your app**:
   - Your app will be available at: `https://YOUR_USERNAME.github.io/liftec-timer/`
   - It may take a few minutes for deployment

4. **Update the manifest.json**:
   - Update the `start_url` and `scope` to match your GitHub Pages URL
   - Example:
     ```json
     {
       "start_url": "/liftec-timer/",
       "scope": "/liftec-timer/"
     }
     ```

#### Option B: Netlify (Alternative - FREE)

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**:
   ```bash
   netlify deploy
   # Follow the prompts
   # When asked for deploy path, enter: .

   # For production:
   netlify deploy --prod
   ```

3. **Or use drag-and-drop**:
   - Go to [Netlify Drop](https://app.netlify.com/drop)
   - Drag the entire project folder
   - Get instant deployment

#### Option C: Vercel (Alternative - FREE)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   # Follow the prompts
   ```

### 3. Custom Domain (Optional)

If you want to use your own domain:

1. **GitHub Pages**:
   - Add a `CNAME` file with your domain
   - Configure DNS with your domain provider

2. **Netlify/Vercel**:
   - Add custom domain in dashboard
   - Update DNS records

## Installation on Devices

### iOS (iPhone/iPad)

1. Open the app URL in Safari
2. Tap the Share button (square with arrow)
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add" in the top right
5. The app is now installed on your home screen

### Android

1. Open the app URL in Chrome
2. Tap the menu (three dots)
3. Tap "Add to Home Screen" or "Install App"
4. Tap "Install"
5. The app is now installed in your app drawer

### Desktop (Chrome, Edge, etc.)

1. Open the app URL
2. Look for the install icon in the address bar (⊕ or computer icon)
3. Click "Install"
4. The app opens in its own window

## Usage

### Starting a Session

1. Click "Sitzung starten" (Start Session)
2. Select start time
3. Session begins tracking

### Adding Tasks

1. During active session, click "+ Aufgabe hinzufügen"
2. Select task type (N, D, R, W, or Other)
3. Enter task description
4. Task is added to current session

### Ending a Session

1. Click "■ Beenden" (End Session)
2. Select end time
3. Enter pause time (in hours, e.g., 0.5 for 30 min)
4. Enter travel time (in hours)
5. Review summary
6. Click "Speichern" (Save)
7. Data is saved to worklog

### Exporting Data

1. Click menu (⋯) in top right
2. Select "📤 Monatsübersicht senden"
3. Choose download or email
4. CSV file includes all entries for the month

## Configuration

Edit settings via the Settings screen (⚙️):

- **Name**: Your username for exports
- **Language**: de (German), en (English), hr (Croatian)
- **Surcharge %**: Default overtime surcharge percentage (default: 80%)
- **Email**: Default email for exports
- **Email Subject**: Template for email subject
- **Email Body**: Template for email body

## OTA Updates

The app automatically checks for updates. When a new version is available:

1. A blue banner appears at the top
2. Click "Aktualisieren" (Update)
3. App reloads with new version
4. All data is preserved

### Deploying Updates

1. Make changes to your code
2. Update `APP_VERSION` in `js/app.js`
3. Update `CACHE_VERSION` in `sw.js`
4. Commit and push changes
5. Users will see update notification on next visit

## Data Management

### Backup

Export all data via:
1. Open browser console (F12)
2. Run: `storage.exportAllData()`
3. Copy the JSON output
4. Save to a file

### Restore

1. Open browser console (F12)
2. Paste your backup data into a variable:
   ```javascript
   const backup = { /* your backup data */ };
   storage.importData(backup);
   ```

### Clear Data

To reset the app:
1. Open browser console (F12)
2. Run:
   ```javascript
   indexedDB.deleteDatabase('LiftecTimerDB');
   location.reload();
   ```

## Browser Support

- ✅ Chrome 80+ (Desktop & Mobile)
- ✅ Edge 80+
- ✅ Safari 13+ (iOS & macOS)
- ✅ Firefox 75+
- ✅ Samsung Internet 12+

## Offline Functionality

The app works 100% offline:

- ✅ All features available without internet
- ✅ Data stored locally on device
- ✅ Service Worker caches all assets
- ✅ Updates only when online
- ✅ No server or database required

## File Structure

```
liftec-timer/
├── index.html              # Main HTML file
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── css/
│   └── styles.css         # Custom styles
├── js/
│   ├── app.js             # Main application logic
│   ├── storage.js         # IndexedDB wrapper
│   ├── csv.js             # CSV export functionality
│   └── ui.js              # UI components and helpers
├── icons/                 # App icons (need to be generated)
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   └── icon-512.png
└── screenshots/           # App screenshots (optional)
```

## Troubleshooting

### App won't install
- Ensure you're using HTTPS (required for PWA)
- GitHub Pages automatically uses HTTPS
- Check that manifest.json is valid
- Verify all icon files exist

### Service Worker not working
- Check browser console for errors
- Ensure you're not in private/incognito mode
- Verify sw.js is accessible
- Try clearing cache and hard reload (Ctrl+Shift+R)

### Data not persisting
- Check browser storage permissions
- Ensure IndexedDB is not disabled
- Check available storage space
- Try different browser

### Updates not showing
- Clear browser cache
- Check that CACHE_VERSION was updated in sw.js
- Verify you're online for update check
- Try force refresh (Ctrl+Shift+R)

## Contributing

This is a private project for LIFTEC. For modifications:

1. Fork or clone the repository
2. Make changes
3. Test thoroughly in multiple browsers
4. Update version numbers
5. Deploy

## License

Proprietary - LIFTEC Internal Use Only

## Version History

- **1.0.0** (2025-01-XX) - Initial PWA release
  - Converted from Scriptable iOS app
  - Offline-first architecture
  - IndexedDB storage
  - OTA update mechanism
  - Multi-platform support

## Support

For issues or questions, contact: daniel@liftec.at

---

**Made with ❤️ for LIFTEC**
