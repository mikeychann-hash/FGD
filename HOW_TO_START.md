# 🚀 FGD Desktop App - Quick Start Scripts

## Batch Files Created

### For Easy Launching

I've created 4 convenient batch files to start your FGD Desktop App:

---

## 📋 Available Scripts

### 1. `START_ALL.bat` ⭐ RECOMMENDED
**Location:** `C:\Users\Admin\Desktop\FGD-main\START_ALL.bat`

**What it does:**
- Starts backend server in one window
- Starts frontend dev server in another window
- Automatically waits for backend to initialize
- Opens both in separate terminal windows

**How to use:**
1. Double-click `START_ALL.bat`
2. Wait for both windows to open
3. Open browser to http://localhost:5173

**Perfect for:** Full stack development

---

### 2. `start-backend.bat`
**Location:** `C:\Users\Admin\Desktop\FGD-main\start-backend.bat`

**What it does:**
- Checks for node_modules
- Installs dependencies if needed
- Starts Express backend server on port 3000

**How to use:**
1. Double-click `start-backend.bat`
2. Wait for "Server running at http://localhost:3000"

**Perfect for:** Testing backend separately

---

### 3. `start-frontend.bat`
**Location:** `C:\Users\Admin\Desktop\FGD-main\desktop-app\start-frontend.bat`

**What it does:**
- Installs missing Radix UI dependencies
- Checks for node_modules
- Starts Vite dev server on port 5173

**How to use:**
1. Double-click `start-frontend.bat`
2. Wait for "Local: http://localhost:5173"
3. Open browser to that URL

**Perfect for:** Frontend-only development

---

### 4. `start-electron.bat`
**Location:** `C:\Users\Admin\Desktop\FGD-main\desktop-app\start-electron.bat`

**What it does:**
- Installs missing dependencies
- Starts Electron desktop window
- Runs as native Windows app

**How to use:**
1. Make sure backend is running first!
2. Double-click `start-electron.bat`
3. Desktop window will open

**Perfect for:** Testing desktop app experience

---

## 🎯 Recommended Workflow

### First Time Setup
```
1. Double-click: START_ALL.bat
2. Wait for both servers to start
3. Open browser: http://localhost:5173
4. Test all features
```

### Daily Development
```
Option A - Full Stack:
1. Run: START_ALL.bat
2. Develop and test

Option B - Frontend Only:
1. Run: start-frontend.bat
2. Work on UI components

Option C - Desktop App:
1. Run: start-backend.bat (Terminal 1)
2. Run: start-electron.bat (Terminal 2)
3. Test native app
```

---

## 📝 What Each Script Does

### START_ALL.bat Flow
```
1. Open Terminal Window 1
   → Run start-backend.bat
   → Backend starts on :3000

2. Wait 5 seconds

3. Open Terminal Window 2
   → Run start-frontend.bat
   → Frontend starts on :5173

4. Both running simultaneously
```

### start-backend.bat Flow
```
1. Check if in correct directory
2. Check for node_modules
3. Install deps if needed
4. Run: npm start
5. Server listening on :3000
```

### start-frontend.bat Flow
```
1. Install @radix-ui/react-toast
2. Install @radix-ui/react-progress
3. Check for node_modules
4. Install all deps if needed
5. Run: npm run dev
6. Vite server on :5173
```

### start-electron.bat Flow
```
1. Install missing Radix deps
2. Check for node_modules
3. Install all deps if needed
4. Run: npm run electron:dev
5. Desktop window opens
```

---

## ⚠️ Troubleshooting

### Script won't run
- Right-click → "Run as Administrator"
- Make sure you're not in a restricted folder

### Backend fails to start
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill process if needed
taskkill /PID [PID_NUMBER] /F
```

### Frontend fails to start
```bash
# Check if port 5173 is in use
netstat -ano | findstr :5173

# Delete node_modules and reinstall
cd desktop-app
rmdir /s /q node_modules
npm install
```

### Missing dependencies error
```bash
# Manually install
cd desktop-app
npm install @radix-ui/react-toast @radix-ui/react-progress
```

### Electron won't open
- Make sure backend is running first
- Check Windows Firewall isn't blocking
- Try running frontend first to test

---

## 🔍 What to Expect

### When Backend Starts
```
✓ Loading configuration...
✓ Connecting to Redis...
✓ Connecting to PostgreSQL...
✓ Starting WebSocket server...
✓ Server running at http://localhost:3000
```

### When Frontend Starts
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### When Electron Opens
```
Desktop window appears with:
- Title: "FGD Desktop App"
- Size: 1400x900
- Dark theme enabled
- All pages working
```

---

## 🌐 URLs

After starting:

- **Backend API:** http://localhost:3000
- **Frontend Web:** http://localhost:5173
- **Electron:** Native window (no URL)

---

## 🎨 Testing Checklist

After running `START_ALL.bat`:

### 1. Check Backend (2 min)
- [ ] Terminal shows "Server running"
- [ ] Visit http://localhost:3000/health
- [ ] Should see `{"status":"ok"}`

### 2. Check Frontend (5 min)
- [ ] Terminal shows "Local: http://localhost:5173"
- [ ] Open http://localhost:5173
- [ ] Dashboard page loads
- [ ] Navigate to Admin
- [ ] Navigate to Fusion
- [ ] Theme toggle works
- [ ] No errors in browser console

### 3. Test Features (10 min)
- [ ] Dashboard shows cluster grid
- [ ] Metrics charts render
- [ ] Admin shows login dialog
- [ ] Enter API key (default: `admin123`)
- [ ] Bot list appears
- [ ] Fusion page has search & tabs
- [ ] Animations are smooth

---

## 📞 Need Help?

### Check Documentation
- **Quick Start:** `/docs/migration/QUICK_START.md`
- **Launch Checklist:** `/docs/migration/LAUNCH_CHECKLIST.md`
- **Troubleshooting:** `/docs/migration/BUILD_STATUS.md`

### Common Issues
1. **Port already in use:** Kill the process or change port
2. **Dependencies missing:** Run `npm install` manually
3. **Backend won't connect:** Check `.env` file
4. **Styles not loading:** Restart Vite server

---

## 🎯 Quick Commands

### Manual Start (Alternative to batch files)

**Terminal 1 - Backend:**
```bash
cd C:\Users\Admin\Desktop\FGD-main
npm start
```

**Terminal 2 - Frontend:**
```bash
cd C:\Users\Admin\Desktop\FGD-main\desktop-app
npm install @radix-ui/react-toast @radix-ui/react-progress
npm run dev
```

**Terminal 3 - Electron (optional):**
```bash
cd C:\Users\Admin\Desktop\FGD-main\desktop-app
npm run electron:dev
```

---

## 🎉 Success!

When everything is working:

✅ Backend: `http://localhost:3000` shows API  
✅ Frontend: `http://localhost:5173` shows beautiful UI  
✅ Console: No errors  
✅ Features: All working  
✅ Theme: Dark mode looking great  

**You're ready to develop!** 🚀

---

## 📚 Next Steps

1. **Read the docs:** `/docs/migration/INDEX.md`
2. **Explore features:** `/docs/migration/FEATURE_GUIDE.md`
3. **Start coding:** `/docs/migration/CODE_EXAMPLES.md`
4. **Test thoroughly:** `/docs/migration/LAUNCH_CHECKLIST.md`

---

**Happy coding!** 🎊

If you encounter any issues, check the documentation in `/docs/migration/` - we have 12 comprehensive guides covering everything!
