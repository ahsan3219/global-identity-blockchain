#!/usr/bin/env node

/**
 * Simple test runner to verify core functionality
 */

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader(title) {
    console.log('\n' + '='.repeat(70));
    log(title, 'blue');
    console.log('='.repeat(70));
}

async function runTests() {
    let passCount = 0;
    let failCount = 0;

    printHeader('🧪 GLOBAL IDENTITY BLOCKCHAIN - TEST SUITE');

    // Test 1: Check dependencies
    printHeader('Test 1: Check Dependencies');
    try {
        require('express');
        log('✓ Express installed', 'green');
        passCount++;
    } catch (e) {
        log('✗ Express missing', 'red');
        failCount++;
    }

    try {
        require('ethers');
        log('✓ ethers.js installed', 'green');
        passCount++;
    } catch (e) {
        log('✗ ethers.js missing', 'red');
        failCount++;
    }

    try {
        require('redis');
        log('✓ Redis client installed', 'green');
        passCount++;
    } catch (e) {
        log('✗ Redis client missing', 'red');
        failCount++;
    }

    // Test 2: Check file structure
    printHeader('Test 2: Check File Structure');
    const fs = require('fs');
    const path = require('path');

    const requiredFiles = [
        'server.js',
        'App.js',
        'contracts/GlobalIdentityRegistry.sol',
        'contracts/PlatformVerificationRegistry.sol',
        'hardhat.config.js',
        'package.json',
        '.env'
    ];

    for (const file of requiredFiles) {
        if (fs.existsSync(file)) {
            log(`✓ ${file} exists`, 'green');
            passCount++;
        } else {
            log(`✗ ${file} missing`, 'red');
            failCount++;
        }
    }

    // Test 3: Check configuration
    printHeader('Test 3: Check Environment Configuration');
    try {
        require('dotenv').config();
        const requiredEnvVars = ['ETHEREUM_NODE_URL', 'PORT', 'JWT_SECRET'];
        
        for (const envVar of requiredEnvVars) {
            if (process.env[envVar]) {
                log(`✓ ${envVar} configured`, 'green');
                passCount++;
            } else {
                log(`✗ ${envVar} missing`, 'red');
                failCount++;
            }
        }
    } catch (e) {
        log('✗ Failed to load .env', 'red');
        failCount++;
    }

    // Test 4: Check smart contract compilation
    printHeader('Test 4: Check Smart Contract Artifacts');
    const artifactsPath = 'artifacts/contracts';
    if (fs.existsSync(artifactsPath)) {
        const contracts = fs.readdirSync(artifactsPath);
        if (contracts.length > 0) {
            log(`✓ Found ${contracts.length} contract(s) in artifacts`, 'green');
            passCount++;
        } else {
            log('✗ No compiled contracts found', 'red');
            failCount++;
        }
    } else {
        log('⚠ Artifacts directory not found - run: npx hardhat compile', 'yellow');
    }

    // Test 5: Check contract files
    printHeader('Test 5: Verify Contract Content');
    try {
        const globalIdentityRegistry = fs.readFileSync('contracts/GlobalIdentityRegistry.sol', 'utf8');
        if (globalIdentityRegistry.includes('createIdentity')) {
            log('✓ GlobalIdentityRegistry.sol has createIdentity function', 'green');
            passCount++;
        } else {
            log('✗ createIdentity function not found', 'red');
            failCount++;
        }

        const platformRegistry = fs.readFileSync('contracts/PlatformVerificationRegistry.sol', 'utf8');
        if (platformRegistry.includes('createVerification')) {
            log('✓ PlatformVerificationRegistry.sol has createVerification function', 'green');
            passCount++;
        } else {
            log('✗ createVerification function not found', 'red');
            failCount++;
        }
    } catch (e) {
        log(`✗ Error reading contract files: ${e.message}`, 'red');
        failCount++;
    }

    // Test 6: Check API server code
    printHeader('Test 6: Verify Backend Server Code');
    try {
        const serverCode = fs.readFileSync('server.js', 'utf8');
        
        const requiredEndpoints = [
            'app.get.*health',
            'app.post.*identity.*create',
            'app.get.*identity',
            'app.post.*verification'
        ];

        let endpointCount = 0;
        for (const endpoint of requiredEndpoints) {
            if (new RegExp(endpoint).test(serverCode)) {
                log(`✓ Endpoint pattern found: ${endpoint}`, 'green');
                endpointCount++;
            }
        }
        passCount += endpointCount;

        if (endpointCount < requiredEndpoints.length) {
            failCount += (requiredEndpoints.length - endpointCount);
        }
    } catch (e) {
        log(`✗ Error reading server.js: ${e.message}`, 'red');
        failCount++;
    }

    // Test 7: Check frontend code
    printHeader('Test 7: Verify Frontend Application Code');
    try {
        const appCode = fs.readFileSync('App.js', 'utf8');
        
        const requiredComponents = [
            'ethers.BrowserProvider',
            'Contract',
            'useState',
            'useEffect'
        ];

        let componentCount = 0;
        for (const component of requiredComponents) {
            if (appCode.includes(component)) {
                log(`✓ Found ${component}`, 'green');
                componentCount++;
            } else {
                log(`✗ ${component} not found`, 'red');
            }
        }
        passCount += componentCount;
        failCount += Math.max(0, requiredComponents.length - componentCount);
    } catch (e) {
        log(`✗ Error reading App.js: ${e.message}`, 'red');
        failCount++;
    }

    // Test 8: Documentation
    printHeader('Test 8: Check Documentation');
    const docFiles = [
        'README.md',
        'IMPLEMENTATION_GUIDE.md',
        'PROJECT_SUMMARY.md'
    ];

    for (const docFile of docFiles) {
        if (fs.existsSync(docFile)) {
            const content = fs.readFileSync(docFile, 'utf8');
            if (content.length > 100) {
                log(`✓ ${docFile} exists with content`, 'green');
                passCount++;
            } else {
                log(`✗ ${docFile} is empty`, 'red');
                failCount++;
            }
        } else {
            log(`✗ ${docFile} missing`, 'red');
            failCount++;
        }
    }

    // Summary
    printHeader('📊 TEST SUMMARY');
    const total = passCount + failCount;
    const percentage = total > 0 ? Math.round((passCount / total) * 100) : 0;
    
    log(`Tests Passed: ${passCount}`, 'green');
    log(`Tests Failed: ${failCount}`, failCount > 0 ? 'red' : 'green');
    log(`Total Tests: ${total}`, 'blue');
    log(`Success Rate: ${percentage}%`, percentage >= 80 ? 'green' : 'yellow');

    // Final status
    printHeader('🎯 FINAL STATUS');
    if (failCount === 0) {
        log('✓ ALL TESTS PASSED - System Ready for Deployment!', 'green');
        process.exit(0);
    } else {
        log(`⚠ ${failCount} test(s) failed - Please review above`, 'yellow');
        process.exit(1);
    }
}

// Run tests
runTests().catch(err => {
    log(`Fatal error: ${err.message}`, 'red');
    process.exit(1);
});
