# Quick Start Guide - LIFTEC Timer PWA

## 5-Minute Setup

### Step 1: Generate Icons (2 min)

1. Open `generate-icons.html` in your browser
2. Icons will be generated automatically
3. Right-click each icon → "Save Image As..."
4. Save all icons to the `/icons` folder with these exact names:
   - `icon-72.png`
   - `icon-96.png`
   - `icon-128.png`
   - `icon-144.png`
   - `icon-152.png`
   - `icon-192.png`
   - `icon-384.png`
   - `icon-512.png`

### Step 2: Run Locally (1 min)

Choose one method:

**Option A - Python (easiest if you have Python installed):**
```bash
python -m http.server 8000
```

**Option B - Node.js:**
```bash
npx http-server -p 8000
```

**Option C - PHP:**
```bash
php -S localhost:8000
```

**Option D - VS Code:**
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

### Step 3: Test (2 min)

1. Open browser: `http://localhost:8000`
2. App should load successfully
3. Try these actions:
   - ✅ Click "Sitzung starten" (Start Session)
   - ✅ Add a task
   - ✅ End the session
   - ✅ Check menu (⋯) in top right

🎉 **That's it! Your app is running locally.**

---

## Deploy to GitHub Pages (10 min)

### Step 1: Create GitHub Repository

```bash
# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - LIFTEC Timer PWA"

# Create repo on GitHub (do this manually on github.com)
# Then connect it:
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/liftec-timer.git
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click "Settings"
3. Scroll to "Pages" section
4. Under "Source", select "main" branch
5. Click "Save"
6. Wait 2-3 minutes

### Step 3: Update Paths (if needed)

If your repo name is NOT `liftec-timer`, update `manifest.json`:

```json
{
  "start_url": "/YOUR-REPO-NAME/",
  "scope": "/YOUR-REPO-NAME/"
}
```

Also update `sw.js` paths if needed.

### Step 4: Access Your App

Your app will be live at:
```
https://YOUR_USERNAME.github.io/liftec-timer/
```

🌐 **Your app is now online and accessible from any device!**

---

## Install on Your Phone

### iPhone/iPad
1. Open the app URL in Safari
2. Tap Share button (square with arrow ↑)
3. Tap "Add to Home Screen"
4. Tap "Add"
5. ✅ App appears on home screen

### Android
1. Open the app URL in Chrome
2. Tap menu (⋮)
3. Tap "Add to Home Screen" or "Install"
4. Tap "Install"
5. ✅ App appears in app drawer

---

## Common Issues

### Icons not showing?
- Make sure all icon files are in `/icons` folder
- Check filenames match exactly (case-sensitive)
- Try hard refresh: `Ctrl + Shift + R` (or `Cmd + Shift + R` on Mac)

### App won't install?
- Must use HTTPS (GitHub Pages does this automatically)
- Make sure all icons exist
- Check browser console for errors (F12)

### Service Worker errors?
- Don't use private/incognito mode
- Check that `sw.js` is accessible
- Clear browser cache and retry

### Data not saving?
- Check browser permissions for storage
- Make sure you're not in private mode
- Try a different browser

---

## What's Next?

- ✅ Customize settings (⚙️ menu)
- ✅ Add your name and email
- ✅ Adjust surcharge percentage
- ✅ Start tracking your work!
- ✅ Export monthly reports

---

## Need Help?

Check the full [README.md](README.md) for:
- Detailed documentation
- Troubleshooting guide
- Advanced features
- Data backup/restore
- Contributing guidelines

---

**Happy time tracking! 🚀**
