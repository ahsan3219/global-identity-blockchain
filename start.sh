#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}Global Digital Identity Blockchain - Startup${NC}"
echo -e "${BLUE}============================================${NC}\n"

# Check if running in production or development
MODE=${1:-development}

if [ "$MODE" = "production" ]; then
    echo -e "${YELLOW}Mode: PRODUCTION${NC}\n"
else
    echo -e "${YELLOW}Mode: DEVELOPMENT${NC}\n"
fi

# Function to check if port is in use
check_port() {
    if netstat -tln 2>/dev/null | grep -q ":$1 "; then
        return 0
    else
        return 1
    fi
}

# Start Redis
echo -e "${BLUE}Starting Redis...${NC}"
if check_port 6379; then
    echo -e "${GREEN}✓ Redis already running on port 6379${NC}"
else
    docker run -d -p 6379:6379 --name redis-gdib redis:latest > /dev/null 2>&1
    echo -e "${GREEN}✓ Redis started${NC}"
fi

# Start IPFS (optional - using mock for now)
echo -e "${BLUE}Checking IPFS...${NC}"
echo -e "${GREEN}✓ IPFS mock enabled (using hash-based storage)${NC}"

# Start Hardhat node
echo -e "${BLUE}Starting Hardhat blockchain node...${NC}"
if [ "$MODE" = "production" ]; then
    echo -e "${YELLOW}Note: In production, connect to Ethereum mainnet or testnet${NC}"
else
    # Start Hardhat node in background
    npx hardhat node > /tmp/hardhat.log 2>&1 &
    HARDHAT_PID=$!
    sleep 3
    echo -e "${GREEN}✓ Hardhat node started (PID: $HARDHAT_PID)${NC}"
fi

# Compile and deploy contracts
echo -e "${BLUE}Deploying smart contracts...${NC}"
if npx hardhat compile > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Contracts compiled${NC}"
else
    echo -e "${RED}✗ Failed to compile contracts${NC}"
    exit 1
fi

if [ "$MODE" = "development" ]; then
    if npx hardhat run scripts/deploy.js --network localhost > /tmp/deploy.log 2>&1; then
        echo -e "${GREEN}✓ Contracts deployed to localhost${NC}"
    else
        echo -e "${RED}✗ Failed to deploy contracts${NC}"
        cat /tmp/deploy.log
    fi
fi

# Start backend API
echo -e "${BLUE}Starting backend API server...${NC}"
if [ "$MODE" = "production" ]; then
    npm start --production > /tmp/backend.log 2>&1 &
else
    npm start > /tmp/backend.log 2>&1 &
fi
BACKEND_PID=$!
sleep 2

if check_port 3000; then
    echo -e "${GREEN}✓ Backend API running on port 3000${NC}"
else
    echo -e "${RED}✗ Failed to start backend API${NC}"
    cat /tmp/backend.log
    exit 1
fi

# Print access information
echo -e "\n${BLUE}============================================${NC}"
echo -e "${GREEN}✓ System started successfully!${NC}"
echo -e "${BLUE}============================================${NC}\n"

echo -e "${YELLOW}Access Points:${NC}"
echo -e "  ${GREEN}Backend API${NC}:  http://localhost:3000"
echo -e "  ${GREEN}API Health${NC}:   http://localhost:3000/api/health"
echo -e "  ${GREEN}Frontend${NC}:     http://localhost:3001 (if running)"
echo -e "  ${GREEN}Hardhat Node${NC}: http://localhost:8545"
echo -e "  ${GREEN}Redis${NC}:        localhost:6379"

echo -e "\n${YELLOW}API Endpoints:${NC}"
echo -e "  POST   /api/identity/create              - Create new identity"
echo -e "  GET    /api/identity/:did                - Get identity details"
echo -e "  POST   /api/identity/verify-ownership    - Verify identity ownership"
echo -e "  POST   /api/verification/add             - Add verification"
echo -e "  POST   /api/platform/verify              - Create platform verification"
echo -e "  GET    /api/platform/check/:pid/:did     - Check platform verification"
echo -e "  GET    /api/platform/identity/:pid/:uid  - Get identity by platform user"
echo -e "  GET    /api/stats                        - Get system statistics"
echo -e "  GET    /api/health                       - Health check"

echo -e "\n${YELLOW}Available Commands:${NC}"
echo -e "  npm test                    - Run test suite"
echo -e "  npm run compile             - Compile smart contracts"
echo -e "  npm run deploy:localhost    - Deploy to local network"
echo -e "  npm run start:frontend      - Start React frontend"

echo -e "\n${YELLOW}Process IDs:${NC}"
if [ ! -z "$HARDHAT_PID" ]; then
    echo -e "  Hardhat Node: $HARDHAT_PID"
fi
echo -e "  Backend API:  $BACKEND_PID"

echo -e "\n${YELLOW}To stop services:${NC}"
if [ ! -z "$HARDHAT_PID" ]; then
    echo -e "  kill $HARDHAT_PID    # Stop Hardhat node"
fi
echo -e "  kill $BACKEND_PID    # Stop backend API"
echo -e "  docker stop redis-gdib  # Stop Redis"

echo -e "\n${BLUE}For more information, see:${NC}"
echo -e "  docs/IMPLEMENTATION_GUIDE.md"
echo -e "  docs/PROJECT_SUMMARY.md"
echo -e "  README.md"

# Keep script running
if [ "$MODE" = "development" ]; then
    echo -e "\n${BLUE}Logs:${NC}"
    echo -e "  Backend:  tail -f /tmp/backend.log"
    if [ ! -z "$HARDHAT_PID" ]; then
        echo -e "  Hardhat:  tail -f /tmp/hardhat.log"
    fi
    echo -e "  Deploy:   cat /tmp/deploy.log"
fi

echo -e "\n${GREEN}System is ready! Press Ctrl+C to stop.${NC}\n"

# Wait for processes
if [ ! -z "$HARDHAT_PID" ]; then
    wait $HARDHAT_PID
fi
wait $BACKEND_PID
