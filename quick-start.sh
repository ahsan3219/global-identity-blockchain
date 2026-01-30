#!/bin/bash

# Global Digital Identity Blockchain - Quick Start Script
# This script sets up and runs the entire system for testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing_deps=0
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_success "Node.js installed: $NODE_VERSION"
    else
        print_error "Node.js is not installed"
        missing_deps=1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        print_success "npm installed: $NPM_VERSION"
    else
        print_error "npm is not installed"
        missing_deps=1
    fi
    
    # Check Docker (optional but recommended)
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker -v)
        print_success "Docker installed: $DOCKER_VERSION"
    else
        print_warning "Docker is not installed (optional)"
    fi
    
    # Check Git
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version)
        print_success "Git installed: $GIT_VERSION"
    else
        print_warning "Git is not installed"
    fi
    
    if [ $missing_deps -eq 1 ]; then
        print_error "Please install missing dependencies before continuing"
        exit 1
    fi
    
    echo ""
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    print_info "Installing backend dependencies..."
    npm install
    
    if [ -d "src/frontend" ]; then
        print_info "Installing frontend dependencies..."
        cd src/frontend
        npm install
        cd ../..
    fi
    
    print_success "All dependencies installed"
    echo ""
}

# Setup environment
setup_environment() {
    print_header "Setting Up Environment"
    
    if [ ! -f ".env" ]; then
        print_info "Creating .env file..."
        cat > .env << EOF
# Environment Configuration
NODE_ENV=development

# Blockchain
ETHEREUM_NODE_URL=http://localhost:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# API
PORT=3000
CORS_ORIGIN=http://localhost:3001

# Redis
REDIS_URL=redis://localhost:6379

# IPFS
IPFS_URL=http://localhost:5001

# JWT
JWT_SECRET=$(openssl rand -hex 32)

# Database
DATABASE_URL=postgresql://gdib_user:changeme@localhost:5432/gdib
EOF
        print_success ".env file created"
    else
        print_info ".env file already exists"
    fi
    
    echo ""
}

# Start services with Docker
start_services_docker() {
    print_header "Starting Services with Docker"
    
    print_info "Starting Docker containers..."
    docker-compose up -d postgres redis ipfs
    
    print_info "Waiting for services to be ready..."
    sleep 10
    
    print_success "Services started"
    echo ""
}

# Start services manually
start_services_manual() {
    print_header "Starting Services Manually"
    
    # Check if Redis is running
    if ! nc -z localhost 6379 2>/dev/null; then
        print_warning "Redis is not running. Please start Redis manually:"
        print_info "  docker run -d -p 6379:6379 redis:latest"
    else
        print_success "Redis is running"
    fi
    
    # Check if IPFS is running
    if ! nc -z localhost 5001 2>/dev/null; then
        print_warning "IPFS is not running. Please start IPFS manually:"
        print_info "  docker run -d -p 5001:5001 ipfs/go-ipfs:latest"
    else
        print_success "IPFS is running"
    fi
    
    echo ""
}

# Compile contracts
compile_contracts() {
    print_header "Compiling Smart Contracts"
    
    print_info "Compiling contracts..."
    npx hardhat compile
    
    print_success "Contracts compiled"
    echo ""
}

# Start blockchain node
start_blockchain() {
    print_header "Starting Local Blockchain"
    
    print_info "Starting Hardhat node..."
    print_warning "Keep this terminal window open"
    print_info "The node will be available at http://localhost:8545"
    
    echo ""
    npx hardhat node
}

# Deploy contracts
deploy_contracts() {
    print_header "Deploying Smart Contracts"
    
    print_info "Deploying contracts to local network..."
    npx hardhat run scripts/deploy.js --network localhost
    
    print_success "Contracts deployed"
    echo ""
}

# Run tests
run_tests() {
    print_header "Running Tests"
    
    print_info "Running test suite..."
    npm test
    
    echo ""
}

# Start backend
start_backend() {
    print_header "Starting Backend API Server"
    
    print_info "Starting backend server..."
    print_warning "Keep this terminal window open"
    print_info "API will be available at http://localhost:3000"
    
    echo ""
    npm run start:backend
}

# Start frontend
start_frontend() {
    print_header "Starting Frontend Application"
    
    print_info "Starting frontend..."
    print_warning "Keep this terminal window open"
    print_info "Frontend will be available at http://localhost:3001"
    
    echo ""
    cd src/frontend
    npm start
}

# Display access info
display_access_info() {
    print_header "Access Information"
    
    echo ""
    echo -e "${GREEN}🎉 System is ready!${NC}"
    echo ""
    echo -e "${BLUE}Access the application:${NC}"
    echo -e "  Frontend:  ${YELLOW}http://localhost:3001${NC}"
    echo -e "  API:       ${YELLOW}http://localhost:3000${NC}"
    echo -e "  Blockchain: ${YELLOW}http://localhost:8545${NC}"
    echo ""
    echo -e "${BLUE}Default Accounts (for testing):${NC}"
    echo -e "  Account #0: ${YELLOW}0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266${NC}"
    echo -e "  Private Key: ${YELLOW}0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80${NC}"
    echo -e "  Balance: ${YELLOW}10000 ETH${NC}"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo -e "  Run tests:     ${YELLOW}npm test${NC}"
    echo -e "  View logs:     ${YELLOW}docker-compose logs -f${NC}"
    echo -e "  Stop services: ${YELLOW}docker-compose down${NC}"
    echo ""
}

# Main menu
show_menu() {
    clear
    print_header "Global Digital Identity Blockchain - Quick Start"
    
    echo ""
    echo "Select an option:"
    echo ""
    echo "  1) Full Setup (Recommended for first-time users)"
    echo "  2) Start Services Only"
    echo "  3) Deploy Contracts"
    echo "  4) Run Tests"
    echo "  5) Start Backend API"
    echo "  6) Start Frontend"
    echo "  7) Complete Docker Setup"
    echo "  8) Display Access Information"
    echo "  9) Exit"
    echo ""
    echo -n "Enter your choice [1-9]: "
}

# Main execution
main() {
    if [ "$1" == "--auto" ]; then
        # Automated setup
        check_prerequisites
        install_dependencies
        setup_environment
        compile_contracts
        
        print_header "Starting All Services"
        print_info "This will open multiple terminal windows..."
        
        # Use tmux or screen if available
        if command -v tmux &> /dev/null; then
            tmux new-session -d -s gdib "npx hardhat node"
            sleep 5
            tmux new-window -t gdib "npm run deploy:localhost && npm run start:backend"
            tmux new-window -t gdib "cd src/frontend && npm start"
            
            print_success "Services started in tmux session 'gdib'"
            print_info "Attach to session: tmux attach -t gdib"
        else
            print_warning "tmux not found. Please start services manually:"
            print_info "  1. Terminal 1: npm run start:node"
            print_info "  2. Terminal 2: npm run deploy:localhost && npm run start:backend"
            print_info "  3. Terminal 3: cd src/frontend && npm start"
        fi
        
        sleep 2
        display_access_info
        
    else
        # Interactive menu
        while true; do
            show_menu
            read -r choice
            
            case $choice in
                1)
                    check_prerequisites
                    install_dependencies
                    setup_environment
                    start_services_manual
                    compile_contracts
                    echo ""
                    print_success "Setup complete!"
                    print_info "Next steps:"
                    print_info "  1. Start blockchain: npm run start:node (Terminal 1)"
                    print_info "  2. Deploy contracts: npm run deploy:localhost (Terminal 2)"
                    print_info "  3. Start backend: npm run start:backend (Terminal 2)"
                    print_info "  4. Start frontend: npm run start:frontend (Terminal 3)"
                    echo ""
                    read -p "Press Enter to continue..."
                    ;;
                2)
                    start_services_manual
                    read -p "Press Enter to continue..."
                    ;;
                3)
                    deploy_contracts
                    read -p "Press Enter to continue..."
                    ;;
                4)
                    run_tests
                    read -p "Press Enter to continue..."
                    ;;
                5)
                    start_backend
                    ;;
                6)
                    start_frontend
                    ;;
                7)
                    check_prerequisites
                    install_dependencies
                    setup_environment
                    start_services_docker
                    compile_contracts
                    print_info "Now run 'docker-compose up' to start all services"
                    read -p "Press Enter to continue..."
                    ;;
                8)
                    display_access_info
                    read -p "Press Enter to continue..."
                    ;;
                9)
                    echo ""
                    print_success "Goodbye!"
                    echo ""
                    exit 0
                    ;;
                *)
                    print_error "Invalid option"
                    sleep 2
                    ;;
            esac
        done
    fi
}

# Run main function
main "$@"
