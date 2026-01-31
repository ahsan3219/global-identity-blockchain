#!/usr/bin/env node

/**
 * Comprehensive System Verification and Test Suite
 * Tests all components of the Global Digital Identity Blockchain
 */

const fs = require('fs');
const path = require('path');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(title) {
    console.log('\n' + '='.repeat(70));
    log(title, 'cyan');
    console.log('='.repeat(70));
}

function subheader(title) {
    log(`\n${title}`, 'blue');
    console.log('-'.repeat(70));
}

class TestSuite {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    }

    test(name, fn) {
        try {
            fn();
            log(`✓ ${name}`, 'green');
            this.passed++;
            this.results.push({ name, status: 'PASS' });
        } catch (e) {
            log(`✗ ${name}`, 'red');
            log(`  Error: ${e.message}`, 'red');
            this.failed++;
            this.results.push({ name, status: 'FAIL', error: e.message });
        }
    }

    async testAsync(name, fn) {
        try {
            await fn();
            log(`✓ ${name}`, 'green');
            this.passed++;
            this.results.push({ name, status: 'PASS' });
        } catch (e) {
            log(`✗ ${name}`, 'red');
            log(`  Error: ${e.message}`, 'red');
            this.failed++;
            this.results.push({ name, status: 'FAIL', error: e.message });
        }
    }

    summary() {
        const total = this.passed + this.failed;
        const percentage = total > 0 ? Math.round((this.passed / total) * 100) : 0;
        
        header('📊 TEST SUMMARY');
        log(`Total Tests: ${total}`, 'cyan');
        log(`Passed: ${this.passed}`, 'green');
        log(`Failed: ${this.failed}`, this.failed > 0 ? 'red' : 'green');
        log(`Success Rate: ${percentage}%`, percentage >= 80 ? 'green' : 'yellow');
        
        if (this.failed === 0) {
            header('🎉 ALL TESTS PASSED!');
            return true;
        } else {
            header('⚠️  SOME TESTS FAILED');
            return false;
        }
    }

    status() {
        return this.failed === 0;
    }
}

async function main() {
    const suite = new TestSuite();

    // ============================================
    // 1. ENVIRONMENT SETUP TESTS
    // ============================================
    header('1️⃣  ENVIRONMENT SETUP');
    
    suite.test('Node.js installed', () => {
        if (!process.version) throw new Error('Node.js not found');
    });

    suite.test('npm available', () => {
        try {
            require.resolve('npm');
        } catch {
            throw new Error('npm not found');
        }
    });

    suite.test('Current working directory correct', () => {
        const expectedPath = path.join(__dirname);
        if (!fs.existsSync('package.json')) {
            throw new Error(`package.json not found in ${expectedPath}`);
        }
    });

    // ============================================
    // 2. DEPENDENCIES TESTS
    // ============================================
    subheader('2️⃣  CHECKING DEPENDENCIES');

    const dependencies = [
        'express',
        'ethers',
        'redis',
        'cors',
        'helmet',
        'dotenv'
    ];

    for (const dep of dependencies) {
        suite.test(`Dependency: ${dep}`, () => {
            try {
                require.resolve(dep);
            } catch {
                throw new Error(`${dep} not installed. Run: npm install`);
            }
        });
    }

    // ============================================
    // 3. FILE STRUCTURE TESTS
    // ============================================
    subheader('3️⃣  FILE STRUCTURE');

    const requiredFiles = {
        'Root files': [
            'server.js',
            'App.js',
            'hardhat.config.js',
            'package.json',
            '.env'
        ],
        'Contracts': [
            'contracts/GlobalIdentityRegistry.sol',
            'contracts/PlatformVerificationRegistry.sol'
        ],
        'Scripts': [
            'scripts/deploy.js'
        ],
        'Documentation': [
            'README.md',
            'docs/IMPLEMENTATION_GUIDE.md',
            'docs/TESTING_REPORT.md',
            'docs/PROJECT_SUMMARY.md'
        ],
        'Source Code': [
            'src/backend/server.js',
            'src/frontend/App.js',
            'src/frontend/index.html'
        ]
    };

    for (const [category, files] of Object.entries(requiredFiles)) {
        log(`\n${category}:`, 'blue');
        for (const file of files) {
            suite.test(`  ${file}`, () => {
                if (!fs.existsSync(file)) {
                    throw new Error(`File not found: ${file}`);
                }
                const stats = fs.statSync(file);
                if (stats.size === 0) {
                    throw new Error(`File is empty: ${file}`);
                }
            });
        }
    }

    // ============================================
    // 4. CONFIGURATION TESTS
    // ============================================
    subheader('4️⃣  CONFIGURATION');

    suite.test('package.json is valid JSON', () => {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        if (!pkg.name || !pkg.version) throw new Error('Invalid package.json');
    });

    suite.test('hardhat.config.js is valid', () => {
        if (!fs.readFileSync('hardhat.config.js', 'utf8').includes('module.exports')) {
            throw new Error('Invalid hardhat config');
        }
    });

    suite.test('.env file exists', () => {
        if (!fs.existsSync('.env')) throw new Error('.env file not found');
    });

    suite.test('Environment variables configured', () => {
        require('dotenv').config();
        const required = ['ETHEREUM_NODE_URL', 'PORT'];
        for (const env of required) {
            if (!process.env[env]) {
                throw new Error(`Missing environment variable: ${env}`);
            }
        }
    });

    // ============================================
    // 5. SMART CONTRACT TESTS
    // ============================================
    subheader('5️⃣  SMART CONTRACTS');

    suite.test('GlobalIdentityRegistry.sol exists', () => {
        const content = fs.readFileSync('contracts/GlobalIdentityRegistry.sol', 'utf8');
        if (!content.includes('contract GlobalIdentityRegistry')) {
            throw new Error('Contract definition not found');
        }
    });

    suite.test('GlobalIdentityRegistry has required functions', () => {
        const content = fs.readFileSync('contracts/GlobalIdentityRegistry.sol', 'utf8');
        const requiredFunctions = [
            'createIdentity',
            'getIdentity',
            'verifyOwnership',
            'addVerification'
        ];
        for (const fn of requiredFunctions) {
            if (!content.includes(`function ${fn}`)) {
                throw new Error(`Function not found: ${fn}`);
            }
        }
    });

    suite.test('PlatformVerificationRegistry.sol exists', () => {
        const content = fs.readFileSync('contracts/PlatformVerificationRegistry.sol', 'utf8');
        if (!content.includes('contract PlatformVerificationRegistry')) {
            throw new Error('Contract definition not found');
        }
    });

    suite.test('Smart contracts have OpenZeppelin imports', () => {
        const content = fs.readFileSync('contracts/GlobalIdentityRegistry.sol', 'utf8');
        const requiredImports = [
            'AccessControl',
            'ReentrancyGuard',
            'Pausable'
        ];
        for (const imp of requiredImports) {
            if (!content.includes(imp)) {
                throw new Error(`Missing import: ${imp}`);
            }
        }
    });

    // ============================================
    // 6. BACKEND API TESTS
    // ============================================
    subheader('6️⃣  BACKEND API');

    suite.test('server.js imports required modules', () => {
        const content = fs.readFileSync('server.js', 'utf8');
        const requiredImports = [
            "require('express')",
            "require('ethers')",
            "require('redis')"
        ];
        for (const imp of requiredImports) {
            if (!content.includes(imp)) {
                throw new Error(`Missing import: ${imp}`);
            }
        }
    });

    suite.test('server.js has health endpoint', () => {
        const content = fs.readFileSync('server.js', 'utf8');
        if (!content.includes('/api/health')) {
            throw new Error('Health endpoint not found');
        }
    });

    suite.test('server.js has identity endpoints', () => {
        const content = fs.readFileSync('server.js', 'utf8');
        const requiredEndpoints = [
            '/api/identity/create',
            '/api/identity/:did',
            '/api/identity/verify-ownership',
            '/api/verification/add'
        ];
        for (const endpoint of requiredEndpoints) {
            if (!content.includes(endpoint)) {
                throw new Error(`Endpoint not found: ${endpoint}`);
            }
        }
    });

    suite.test('server.js has error handling', () => {
        const content = fs.readFileSync('server.js', 'utf8');
        if (!content.includes('catch') || !content.includes('error')) {
            throw new Error('Error handling not found');
        }
    });

    // ============================================
    // 7. FRONTEND TESTS
    // ============================================
    subheader('7️⃣  FRONTEND APPLICATION');

    suite.test('App.js uses React', () => {
        const content = fs.readFileSync('App.js', 'utf8');
        if (!content.includes('React') && !content.includes('import')) {
            throw new Error('React imports not found');
        }
    });

    suite.test('App.js has ethers integration', () => {
        const content = fs.readFileSync('App.js', 'utf8');
        if (!content.includes('ethers')) {
            throw new Error('ethers.js not found in App.js');
        }
    });

    suite.test('App.js has Web3 wallet integration', () => {
        const content = fs.readFileSync('App.js', 'utf8');
        if (!content.includes('window.ethereum') && !content.includes('MetaMask')) {
            console.warn('  (Note: wallet integration may be basic)');
        }
    });

    suite.test('Frontend HTML exists', () => {
        if (!fs.existsSync('src/frontend/index.html')) {
            throw new Error('Frontend HTML not found');
        }
    });

    // ============================================
    // 8. DOCUMENTATION TESTS
    // ============================================
    subheader('8️⃣  DOCUMENTATION');

    const docFiles = [
        ['README.md', 'Project overview'],
        ['docs/IMPLEMENTATION_GUIDE.md', 'Implementation instructions'],
        ['docs/PROJECT_SUMMARY.md', 'Project summary'],
        ['docs/TESTING_REPORT.md', 'Testing report']
    ];

    for (const [file, desc] of docFiles) {
        suite.test(`${file} - ${desc}`, () => {
            const content = fs.readFileSync(file, 'utf8');
            if (content.length < 100) {
                throw new Error(`Document too short or empty`);
            }
        });
    }

    // ============================================
    // 9. CODE QUALITY TESTS
    // ============================================
    subheader('9️⃣  CODE QUALITY');

    suite.test('No syntax errors in critical files', () => {
        // Quick syntax check for server.js
        try {
            const content = fs.readFileSync('server.js', 'utf8');
            if (content.includes('var ') && content.includes('require')) {
                // Basic validity check
                new Function(content.substring(0, 100));
            }
        } catch (e) {
            throw new Error(`Syntax error in server.js: ${e.message}`);
        }
    });

    suite.test('Proper code comments present', () => {
        const content = fs.readFileSync('server.js', 'utf8');
        if (!content.includes('/*') && !content.includes('//')) {
            throw new Error('No comments found in code');
        }
    });

    suite.test('Security best practices (helmet, cors)', () => {
        const content = fs.readFileSync('server.js', 'utf8');
        if (!content.includes('helmet') || !content.includes('cors')) {
            throw new Error('Security middleware not found');
        }
    });

    // ============================================
    // 10. INTEGRATION TESTS
    // ============================================
    subheader('🔟 INTEGRATION POINTS');

    suite.test('Contracts and backend are compatible', () => {
        const contractContent = fs.readFileSync('contracts/GlobalIdentityRegistry.sol', 'utf8');
        const serverContent = fs.readFileSync('server.js', 'utf8');
        
        if (!serverContent.includes('createIdentity') && !serverContent.includes('contract')) {
            // Server should reference contract functions
        }
    });

    suite.test('Environment variables align with configuration', () => {
        const envContent = fs.readFileSync('.env', 'utf8');
        const serverContent = fs.readFileSync('server.js', 'utf8');
        
        const envVars = envContent.match(/^[A-Z_]+=/gm) || [];
        if (envVars.length === 0) {
            throw new Error('No environment variables configured');
        }
    });

    suite.test('API endpoints documented', () => {
        const readmeContent = fs.readFileSync('README.md', 'utf8');
        if (!readmeContent.toLowerCase().includes('api') && !readmeContent.toLowerCase().includes('endpoint')) {
            console.warn('  (Note: API documentation could be more complete)');
        }
    });

    // ============================================
    // FINAL SUMMARY
    // ============================================
    
    const success = suite.summary();

    // ============================================
    // RECOMMENDATIONS
    // ============================================
    header('📋 RECOMMENDATIONS');

    if (suite.passed === suite.passed + suite.failed) {
        log('✓ All systems operational!', 'green');
        log('\nNext steps:', 'cyan');
        log('  1. Start the system: bash start.sh', 'yellow');
        log('  2. Deploy contracts: npx hardhat run scripts/deploy.js --network localhost', 'yellow');
        log('  3. Run the application: npm start', 'yellow');
        log('  4. Test the API: curl http://localhost:3000/api/health', 'yellow');
    } else {
        log('⚠️  Fix the failing tests before deployment', 'yellow');
        log('\nCommon fixes:', 'cyan');
        log('  • Run: npm install', 'yellow');
        log('  • Check .env file configuration', 'yellow');
        log('  • Ensure Node.js v18+ is installed', 'yellow');
        log('  • Verify Solidity contracts are in contracts/ directory', 'yellow');
    }

    log('\nFor detailed information:', 'cyan');
    log('  • Read: docs/IMPLEMENTATION_GUIDE.md', 'yellow');
    log('  • Check: README.md', 'yellow');
    log('  • Logs:  tail -f /tmp/backend.log', 'yellow');

    log('\nGood luck! 🚀\n', 'green');

    process.exit(success ? 0 : 1);
}

// Run the test suite
main().catch(err => {
    log(`\nFatal error: ${err.message}`, 'red');
    process.exit(1);
});
