#!/usr/bin/env bash

echo "🧪 Global Identity Blockchain - Verification Tests"
echo "=================================================="
echo ""

# Test counters
PASS=0
FAIL=0

# Test function
test_file() {
    local name="$1"
    local file="$2"
    
    if [ -f "$file" ]; then
        size=$(wc -c < "$file")
        if [ "$size" -gt 0 ]; then
            echo "✓ $name ($size bytes)"
            ((PASS++))
        else
            echo "✗ $name (empty file)"
            ((FAIL++))
        fi
    else
        echo "✗ $name (not found)"
        ((FAIL++))
    fi
}

# Test dependencies
echo "📦 Checking Dependencies..."
npm ls express > /dev/null 2>&1 && echo "✓ express" && ((PASS++)) || { echo "✗ express"; ((FAIL++)); }
npm ls ethers > /dev/null 2>&1 && echo "✓ ethers" && ((PASS++)) || { echo "✗ ethers"; ((FAIL++)); }
npm ls redis > /dev/null 2>&1 && echo "✓ redis" && ((PASS++)) || { echo "✗ redis"; ((FAIL++)); }

echo ""
echo "📁 Checking File Structure..."
test_file "Smart Contract: GlobalIdentityRegistry" "contracts/GlobalIdentityRegistry.sol"
test_file "Smart Contract: PlatformVerificationRegistry" "contracts/PlatformVerificationRegistry.sol"
test_file "Backend Server" "server.js"
test_file "Frontend App" "App.js"
test_file "Hardhat Config" "hardhat.config.js"
test_file "Deploy Script" "scripts/deploy.js"
test_file "README" "README.md"
test_file "Implementation Guide" "docs/IMPLEMENTATION_GUIDE.md"

echo ""
echo "🔍 Checking Contract Content..."
grep -q "function createIdentity" contracts/GlobalIdentityRegistry.sol && echo "✓ createIdentity function" && ((PASS++)) || { echo "✗ createIdentity function"; ((FAIL++)); }
grep -q "function getIdentity" contracts/GlobalIdentityRegistry.sol && echo "✓ getIdentity function" && ((PASS++)) || { echo "✗ getIdentity function"; ((FAIL++)); }
grep -q "function verifyOwnership" contracts/GlobalIdentityRegistry.sol && echo "✓ verifyOwnership function" && ((PASS++)) || { echo "✗ verifyOwnership function"; ((FAIL++)); }

echo ""
echo "🌐 Checking Backend API Endpoints..."
grep -q "/api/health" server.js && echo "✓ Health endpoint" && ((PASS++)) || { echo "✗ Health endpoint"; ((FAIL++)); }
grep -q "/api/identity/create" server.js && echo "✓ Identity create endpoint" && ((PASS++)) || { echo "✗ Identity create endpoint"; ((FAIL++)); }
grep -q "/api/identity.*did" server.js && echo "✓ Identity get endpoint" && ((PASS++)) || { echo "✗ Identity get endpoint"; ((FAIL++)); }
grep -q "/api/verification" server.js && echo "✓ Verification endpoint" && ((PASS++)) || { echo "✗ Verification endpoint"; ((FAIL++)); }

echo ""
echo "⚙️  Checking Configuration..."
[ -f ".env" ] && echo "✓ .env file" && ((PASS++)) || { echo "✗ .env file"; ((FAIL++)); }
[ -f "package.json" ] && echo "✓ package.json" && ((PASS++)) || { echo "✗ package.json"; ((FAIL++)); }
grep -q "ETHEREUM_NODE_URL" .env && echo "✓ Ethereum node URL configured" && ((PASS++)) || { echo "✗ Ethereum node URL"; ((FAIL++)); }

echo ""
echo "=================================================="
echo "📊 Test Results"
echo "=================================================="
TOTAL=$((PASS + FAIL))
if [ "$TOTAL" -gt 0 ]; then
    PERCENTAGE=$((PASS * 100 / TOTAL))
else
    PERCENTAGE=0
fi

echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Total:  $TOTAL"
echo "Success Rate: ${PERCENTAGE}%"

echo ""
if [ "$FAIL" -eq 0 ]; then
    echo "✅ ALL TESTS PASSED!"
    echo ""
    echo "Next steps:"
    echo "  1. Start system: bash start.sh"
    echo "  2. Deploy contracts: npx hardhat run scripts/deploy.js --network localhost"
    echo "  3. Test API: curl http://localhost:3000/api/health"
    exit 0
else
    echo "❌ Some tests failed. Please fix the issues above."
    exit 1
fi
