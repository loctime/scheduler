// Test CSP headers configuration
const fs = require('fs')
const path = require('path')

// Read the next.config.mjs file
const configPath = path.join(__dirname, 'next.config.mjs')
const configContent = fs.readFileSync(configPath, 'utf8')

console.log('🔍 Checking CSP Configuration...\n')

// Extract the CSP value
const cspMatch = configContent.match(/value:\s*["']([^"']+)["']/s)
if (!cspMatch) {
  console.log('❌ CSP not found in configuration')
  process.exit(1)
}

const cspValue = cspMatch[1]
console.log('📋 Current CSP Policy:')
console.log(cspValue)
console.log('\n')

// Check for required directives
const requiredDirectives = [
  { name: 'worker-src', pattern: /worker-src\s+'self'\s+blob:/, required: true },
  { name: 'script-src', pattern: /script-src\s+'self'\s+'unsafe-inline'\s+'unsafe-eval'\s+https:\/\/vercel\.live\s+blob:/, required: true },
  { name: 'default-src', pattern: /default-src\s+'self'/, required: true },
  { name: 'connect-src', pattern: /connect-src\s+'self'\s+data:\s+blob:/, required: true }
]

console.log('🔍 CSP Directive Analysis:')
let allPassed = true

requiredDirectives.forEach(directive => {
  const found = directive.pattern.test(cspValue)
  const status = found ? '✅' : '❌'
  const requirement = directive.required ? '(required)' : '(optional)'
  
  console.log(`${status} ${directive.name} ${requirement}`)
  
  if (directive.required && !found) {
    allPassed = false
  }
})

// Check for dangerous patterns
const dangerousPatterns = [
  { name: "default-src *", pattern: /default-src\s+\*/, dangerous: true },
  { name: "script-src *", pattern: /script-src\s+\*/, dangerous: true },
  { name: "worker-src *", pattern: /worker-src\s+\*/, dangerous: true }
]

console.log('\n🚨 Security Check:')
dangerousPatterns.forEach(pattern => {
  const found = pattern.pattern.test(cspValue)
  const status = found ? '❌ DANGEROUS' : '✅ SECURE'
  console.log(`${status} ${pattern.name}`)
  if (found) {
    allPassed = false
  }
})

// Final validation
console.log('\n📊 Final Result:')
if (allPassed) {
  console.log('✅ CSP Configuration is CORRECT')
  console.log('✅ Workers from blob are allowed')
  console.log('✅ Security is maintained')
  console.log('✅ Tesseract.js should work without CSP violations')
} else {
  console.log('❌ CSP Configuration has ISSUES')
  console.log('❌ Please review the configuration above')
}

// Extract and show the final CSP header format
console.log('\n📄 Final CSP Header Format:')
const directives = cspValue.split(';').map(d => d.trim()).filter(d => d.length > 0)
directives.forEach(directive => {
  if (directive.includes('worker-src') || directive.includes('script-src')) {
    console.log(`  ${directive}`)
  }
})
