#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🏗️  Setting up Minecraft Server Admin...\n');

// Create necessary directories
const directories = [
  'src/renderer/components',
  'src/renderer/pages',
  'src/renderer/hooks', 
  'src/renderer/utils',
  'src/renderer/types',
  'src/backend',
  'src/bots',
  'resources',
  'server'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Create placeholder files
const placeholderFiles = [
  'src/renderer/hooks/.gitkeep',
  'src/renderer/utils/.gitkeep',
  'src/backend/.gitkeep',
  'src/bots/.gitkeep',
  'resources/.gitkeep'
];

placeholderFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '');
    console.log(`✅ Created placeholder: ${file}`);
  }
});

// Check if package.json exists
if (!fs.existsSync('package.json')) {
  console.log('❌ package.json not found. Please ensure you are in the correct directory.');
  process.exit(1);
}

// Install dependencies
console.log('\n📦 Installing dependencies...\n');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('\n✅ Dependencies installed successfully!\n');
} catch (error) {
  console.log('\n❌ Failed to install dependencies. Please run "npm install" manually.\n');
  process.exit(1);
}

// Create a simple icon if it doesn't exist
const iconPath = 'resources/icon.ico';
if (!fs.existsSync(iconPath)) {
  console.log('🎨 Creating placeholder icon...\n');
  // Create a simple SVG and convert it to ICO (this is a placeholder)
  const svgContent = `<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
    <rect width="256" height="256" fill="#22c55e"/>
    <text x="128" y="140" font-family="Arial" font-size="120" fill="white" text-anchor="middle">MC</text>
  </svg>`;
  
  fs.writeFileSync('resources/icon.svg', svgContent);
  console.log('✅ Created placeholder SVG icon (convert to ICO for production)');
}

console.log('\n🎉 Setup complete! Here\'s what you can do next:\n');
console.log('📋 Development commands:');
console.log('   npm run dev          - Start development mode');
console.log('   npm run build        - Build for production');
console.log('   npm run dist         - Create installer');
console.log('');
console.log('🎮 To get started:');
console.log('   1. Run "npm run dev" to start the app');
console.log('   2. Configure your Java path and server settings');
console.log('   3. Download PaperMC server jar');
console.log('   4. Start managing your Minecraft server!');
console.log('');
console.log('📚 For more information, check the README.md file');
console.log('');

// Create a simple example configuration
const exampleConfig = {
  javaPath: 'java',
  serverJar: 'server.jar',
  maxMemory: '2G',
  minMemory: '1G',
  serverDir: './server',
  rcon: {
    port: 25575,
    password: 'your-secure-password'
  },
  appSettings: {
    theme: 'dark',
    autoStart: false,
    minimizeToTray: true
  }
};

fs.writeFileSync('config.example.json', JSON.stringify(exampleConfig, null, 2));
console.log('✅ Created example configuration file: config.example.json');