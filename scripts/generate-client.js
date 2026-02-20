#!/usr/bin/env node

/**
 * Script to generate Codama client from IDL
 * Run with: node scripts/generate-client.js
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const IDL_PATH = path.join(__dirname, '../target/idl/kleos_protocol.json')
const OUTPUT_PATH = path.join(__dirname, '../lib/solana/generated')

console.log('🚀 Generating Codama client...')
console.log(`IDL: ${IDL_PATH}`)
console.log(`Output: ${OUTPUT_PATH}`)

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_PATH)) {
  fs.mkdirSync(OUTPUT_PATH, { recursive: true })
}

try {
  // Check if Codama CLI is available
  try {
    execSync('npx codama --version', { stdio: 'ignore' })
  } catch {
    console.log('📦 Installing Codama CLI...')
    execSync('npm install -g @codama/cli', { stdio: 'inherit' })
  }

  // Run Codama
  console.log('⚙️  Running Codama...')
  execSync(`npx codama run --all`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  })

  console.log('✅ Client generated successfully!')
  console.log(`📁 Generated files in: ${OUTPUT_PATH}`)
} catch (error) {
  console.error('❌ Error generating client:', error.message)
  console.log('\n💡 Manual setup:')
  console.log('1. Install Codama CLI: npm install -g @codama/cli')
  console.log('2. Run: npx codama run --all')
  process.exit(1)
}
