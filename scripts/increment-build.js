#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const METADATA_FILE = path.resolve(__dirname, '../build-metadata.json');

// Initialize file if it doesn't exist
if (!fs.existsSync(METADATA_FILE)) {
  const initialData = {
    buildNumber: 0,
    lastUpdated: new Date().toISOString(),
    commits: []
  };
  fs.writeFileSync(METADATA_FILE, JSON.stringify(initialData, null, 2));
}

// Read current metadata
const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));

// Increment build number
metadata.buildNumber += 1;
metadata.lastUpdated = new Date().toISOString();

// Get current git commit hash
try {
  const { execSync } = require('child_process');
  const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  metadata.commits.push({
    build: metadata.buildNumber,
    commit: commitHash,
    timestamp: metadata.lastUpdated
  });

  // Keep only last 100 commits to prevent file bloat
  if (metadata.commits.length > 100) {
    metadata.commits = metadata.commits.slice(-100);
  }
} catch (error) {
  console.warn('Could not get git commit hash:', error.message);
}

// Write updated metadata
fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));

console.log(`✅ Build number incremented to #${metadata.buildNumber}`);
