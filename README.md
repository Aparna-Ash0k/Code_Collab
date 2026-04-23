# 🚀 CodeCollab - Real-time Collaborative Code Editor

Welcome to CodeCollab! This is a complete real-time collaborative coding environment that allows multiple users to code together simultaneously.

## 📋 What's Included

- **Frontend**: React-based collaborative editor with real-time synchronization
- **Backend**: Node.js server with Socket.IO for real-time communication
- **Database**: Firebase Firestore for data persistence
- **Features**: Real-time code editing, chat, file management, code execution

## 🎯 Quick Setup (3 Steps)

### Step 1: Prerequisites
You need **Node.js** installed on your Windows system:
- Download from: https://nodejs.org/
- Choose the **LTS version** (Long Term Support)
- This includes npm which we need for dependencies

### Step 2: Install Dependencies
1. **Double-click** `SETUP_DEPENDENCIES.bat`
2. **Wait** for the setup to complete (may take 3-5 minutes)
3. The script will automatically install all required packages

### Step 3: Start the Application
1. **Double-click** `START_APPLICATION.bat`
2. The application will start automatically
3. Your browser will open to http://localhost:3000

## 🌐 Access URLs

- **Frontend (React App)**: http://localhost:3000
- **Backend (API Server)**: http://localhost:5000

## 📁 Project Structure

```
CodeCollab/
├── client/                 # React frontend application
├── server/                 # Node.js backend server
├── database/              # Database configuration
├── .env                   # Environment variables
├── SETUP_DEPENDENCIES.bat # Automatic dependency installer
├── START_APPLICATION.bat  # Application launcher
└── README.md              # This file
```

## 🔧 Manual Setup (Alternative)

If the batch files don't work, you can set up manually:

1. **Install root dependencies:**
   ```bash
   npm install
   ```

2. **Install server dependencies:**
   ```bash
   cd server
   npm install
   cd ..
   ```

3. **Install client dependencies:**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Start the server:**
   ```bash
   cd server
   node index.js
   ```

5. **Start the client (in a new terminal):**
   ```bash
   cd client
   npm start
   ```

## 🎮 How to Use

1. **Create or Join Sessions**: Start a new collaborative session or join an existing one
2. **Real-time Editing**: Type code and see changes from other users instantly
3. **File Management**: Create, edit, and manage files in the collaborative workspace
4. **Code Execution**: Run your code directly in the browser
5. **Chat**: Communicate with other collaborators in real-time

## 🛠️ Troubleshooting

### Common Issues:

**❌ "Cannot find module" errors**
- Solution: Run `SETUP_DEPENDENCIES.bat` to install all dependencies

**❌ Port already in use**
- Solution: Close any applications using ports 3000 or 5000, or restart your computer

**❌ Node.js not recognized**
- Solution: Install Node.js from https://nodejs.org/ and restart your terminal

**❌ Dependencies fail to install**
- Solution: Try running `npm install --legacy-peer-deps` in the affected folder

## 🔐 Environment Configuration

The `.env` file contains necessary configuration variables. No changes are typically needed for local development.

## 📞 Support

If you encounter any issues:
1. Make sure Node.js is properly installed
2. Run the setup script as administrator if needed
3. Check that ports 3000 and 5000 are available
4. Restart your computer and try again

## 🎉 Enjoy Collaborative Coding!

Once everything is set up, you'll have a powerful real-time collaborative coding environment ready to use. Invite others to join your sessions and code together in real-time!