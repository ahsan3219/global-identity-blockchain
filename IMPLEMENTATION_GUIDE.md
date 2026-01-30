# Real-World Implementation Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Local Development Setup](#local-development-setup)
4. [Testing](#testing)
5. [Deployment to Testnet](#deployment-to-testnet)
6. [Production Deployment](#production-deployment)
7. [Platform Integration](#platform-integration)
8. [Monitoring and Maintenance](#monitoring-and-maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **Operating System**: Ubuntu 22.04 LTS (recommended) or macOS
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Docker**: 24.0+ (for Redis, IPFS)
- **PostgreSQL**: 14+ (optional, for analytics)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 100GB SSD minimum

### Required Tools
```bash
# Install Node.js (Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Git
sudo apt-get install git -y
```

### Required Accounts
- Ethereum wallet with testnet ETH (get from faucet)
- Alchemy or Infura API key (for node access)
- Etherscan API key (for contract verification)
- IPFS node or Pinata account

---

## Installation

### 1. Clone Repository
```bash
git clone https://github.com/gdib/global-identity-blockchain.git
cd global-identity-blockchain
```

### 2. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd src/frontend
npm install
cd ../..
```

### 3. Setup Environment
```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env
```

**Required Environment Variables:**
```env
# Blockchain Configuration
ETHEREUM_NODE_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
PRIVATE_KEY=your-private-key-here
ETHERSCAN_API_KEY=your-etherscan-api-key

# API Configuration
PORT=3000
CORS_ORIGIN=http://localhost:3001
JWT_SECRET=your-random-secret-key

# Redis
REDIS_URL=redis://localhost:6379

# IPFS
IPFS_URL=http://localhost:5001

# Database (Optional)
DATABASE_URL=postgresql://user:password@localhost:5432/gdib
```

---

## Local Development Setup

### 1. Start Local Blockchain
```bash
# Terminal 1: Start Hardhat node
npm run start:node
```

This creates a local blockchain with 20 pre-funded accounts.

### 2. Deploy Contracts Locally
```bash
# Terminal 2: Deploy to local network
npm run deploy:localhost
```

Expected output:
```
================================================================================
Global Digital Identity Blockchain - Deployment Script
================================================================================

Deployment Configuration:
- Network: localhost
- Deployer address: 0x...
- Account balance: 10000.0 ETH

✅ GlobalIdentityRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
✅ PlatformVerificationRegistry deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

### 3. Start Backend Services

**Start Redis:**
```bash
docker run -d -p 6379:6379 redis:latest
```

**Start IPFS:**
```bash
docker run -d -p 5001:5001 ipfs/go-ipfs:latest
```

**Start API Server:**
```bash
# Terminal 3: Start backend
npm run start:backend
```

### 4. Start Frontend
```bash
# Terminal 4: Start frontend
cd src/frontend
npm start
```

Access the application at `http://localhost:3001`

---

## Testing

### Run Complete Test Suite
```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run with gas reporting
npm run test:gas
```

### Expected Test Output
```
Global Digital Identity Blockchain - Complete Test Suite
  1. Identity Registration Tests
    ✓ Should create a new identity (142ms)
    ✓ Should retrieve identity details (45ms)
    ✓ Should prevent duplicate identity for same address (38ms)
    ✓ Should verify identity ownership (32ms)

  2. Identity Update Tests
    ✓ Should update identity metadata (89ms)
    ✓ Should prevent unauthorized updates (41ms)

  ... [Additional test results]

  ✅ All tests completed successfully!
```

### Load Testing
```bash
# Install k6
curl https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz -L | tar xvz

# Run load test
./k6 run tests/load-test.js
```

---

## Deployment to Testnet

### 1. Get Testnet ETH
```bash
# Sepolia Faucet
https://sepoliafaucet.com/

# Alternative: Alchemy Faucet
https://sepoliafaucet.com/
```

### 2. Configure Testnet
Edit `.env`:
```env
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-API-KEY
PRIVATE_KEY=your-deployer-private-key
```

### 3. Deploy to Sepolia
```bash
npm run deploy:testnet
```

### 4. Verify Contracts
```bash
# Automatic verification (included in deployment)
# Or manual verification:
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

### 5. Test on Testnet
Update frontend configuration:
```javascript
// src/frontend/src/config.js
export const config = {
  networkId: 11155111, // Sepolia
  contractAddresses: {
    identity: '0x...', // From deployment
    verification: '0x...'
  }
};
```

---

## Production Deployment

### Phase 1: Infrastructure Setup

**1. Setup Production Servers**
```bash
# Recommended: AWS EC2 t3.large or equivalent
# - 2 vCPUs, 8 GB RAM
# - 100 GB SSD
# - Ubuntu 22.04 LTS

# Security group: Allow ports 22, 80, 443, 3000
```

**2. Install Production Dependencies**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js, Docker, Nginx
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs nginx docker.io

# Setup firewall
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

**3. Setup Database**
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Create database
sudo -u postgres createdb gdib
sudo -u postgres createuser gdib_user
```

### Phase 2: Mainnet Deployment

**1. Audit Smart Contracts**
```bash
# Before mainnet deployment, get professional audit from:
# - OpenZeppelin
# - Trail of Bits
# - ConsenSys Diligence
```

**2. Deploy to Mainnet**
```env
# .env.production
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY
PRIVATE_KEY=your-secure-private-key
```

```bash
# Deploy
npm run deploy:mainnet

# IMPORTANT: Backup deployment info
cp deployment/mainnet-deployment.json ~/backups/
```

**3. Setup Domain and SSL**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d api.gdib.org

# Configure Nginx
sudo nano /etc/nginx/sites-available/gdib
```

Nginx configuration:
```nginx
server {
    listen 80;
    server_name api.gdib.org;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.gdib.org;

    ssl_certificate /etc/letsencrypt/live/api.gdib.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.gdib.org/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**4. Setup PM2 for Process Management**
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start src/backend/server.js --name gdib-api

# Setup auto-restart
pm2 startup
pm2 save
```

**5. Setup Monitoring**
```bash
# Install monitoring tools
npm install -g pm2
pm2 install pm2-logrotate

# Setup Grafana + Prometheus
docker run -d -p 3001:3000 grafana/grafana
```

---

## Platform Integration

### Social Media Integration Example (Twitter/X)

**1. Register Platform**
```bash
curl -X POST https://api.gdib.org/api/platform/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Twitter",
    "domain": "twitter.com",
    "platformType": 0,
    "adminKey": "your-admin-private-key"
  }'
```

**2. Integrate SDK**
```javascript
// Twitter backend integration
const { GDIBClient } = require('@gdib/sdk');

const client = new GDIBClient({
  apiUrl: 'https://api.gdib.org',
  platformId: 'your-platform-id'
});

// Verify user identity
async function verifyUser(userId, identityDID) {
  const verification = await client.createVerification({
    identityDID: identityDID,
    platformUserId: userId,
    expirationDays: 365
  });
  
  return verification;
}

// Check if user is verified
async function checkVerification(userId) {
  const isValid = await client.isVerificationValid({
    platformUserId: userId
  });
  
  return isValid;
}
```

**3. Frontend Widget**
```html
<!-- Add to your platform -->
<script src="https://cdn.gdib.org/widget.js"></script>
<div id="gdib-verification" data-platform="twitter"></div>

<script>
  GDIB.init({
    platformId: 'your-platform-id',
    onVerified: (identityDID) => {
      console.log('User verified:', identityDID);
      // Add verification badge to user profile
    }
  });
</script>
```

---

## Monitoring and Maintenance

### 1. Setup Monitoring Dashboard
```bash
# Install monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d
```

**Monitor:**
- Transaction success rate
- API response times
- Contract gas usage
- Identity creation rate
- Verification throughput

### 2. Log Management
```bash
# View API logs
pm2 logs gdib-api

# View blockchain events
npx hardhat run scripts/monitor-events.js --network mainnet
```

### 3. Backup Strategy
```bash
# Daily database backup
0 2 * * * pg_dump gdib > /backups/gdib-$(date +\%Y\%m\%d).sql

# Weekly contract state backup
0 3 * * 0 node scripts/backup-contract-state.js
```

### 4. Security Monitoring
```bash
# Setup security alerts
npm install -g @openzeppelin/defender-client

# Monitor for suspicious transactions
node scripts/security-monitor.js
```

---

## Troubleshooting

### Common Issues

**1. Contract Deployment Fails**
```bash
# Check gas price
npx hardhat run scripts/check-gas.js

# Increase gas limit in hardhat.config.js
gas: 8000000
```

**2. API Connection Issues**
```bash
# Check if services are running
pm2 status
docker ps

# Check logs
pm2 logs gdib-api
```

**3. Transaction Reverts**
```bash
# Debug transaction
npx hardhat run scripts/debug-tx.js --tx-hash 0x...

# Check contract state
npx hardhat console --network mainnet
> const contract = await ethers.getContractAt("GlobalIdentityRegistry", "0x...")
> await contract.totalIdentities()
```

**4. High Gas Costs**
```bash
# Optimize contract
npm run test:gas

# Use Layer 2 solutions (Polygon, Arbitrum, Optimism)
npm run deploy:polygon
```

---

## Production Checklist

Before going live:

- [ ] Smart contracts professionally audited
- [ ] All tests passing (100% coverage)
- [ ] Security review completed
- [ ] Load testing performed (1000+ req/s)
- [ ] Backup systems in place
- [ ] Monitoring and alerts configured
- [ ] Documentation complete
- [ ] Legal compliance reviewed
- [ ] Privacy policy published
- [ ] Terms of service finalized
- [ ] Bug bounty program launched
- [ ] Incident response plan ready
- [ ] Support team trained
- [ ] Marketing materials prepared
- [ ] Partnership agreements signed

---

## Support

- **Documentation**: https://docs.gdib.org
- **Discord**: https://discord.gg/gdib
- **Email**: support@gdib.org
- **GitHub Issues**: https://github.com/gdib/global-identity-blockchain/issues
- **Emergency**: security@gdib.org

---

## License

MIT License - see LICENSE.md for details
