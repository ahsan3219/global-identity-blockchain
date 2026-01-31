/**
 * Global Digital Identity Blockchain - Backend API Server
 * This server provides RESTful API endpoints for identity management
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');
const crypto = require('crypto');
const redis = require('redis');
// const ipfsClient = require('ipfs-http-client');

// Configuration
const config = {
    port: process.env.PORT || 3000,
    nodeUrl: process.env.ETHEREUM_NODE_URL || 'http://localhost:8545',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    ipfsUrl: process.env.IPFS_URL || 'http://localhost:5001',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
};

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Redis client for caching
const redisClient = redis.createClient({ url: config.redisUrl });
redisClient.connect().catch(console.error);

// IPFS client
// const ipfs = ipfsClient.create({ url: config.ipfsUrl });

// Ethereum provider and contracts
let provider;
let identityContract;
let verificationContract;

async function initializeBlockchain() {
    provider = new ethers.JsonRpcProvider(config.nodeUrl);
    
    // Load contract ABIs and addresses
    const identityContractAddress = process.env.CONTRACT_ADDRESS;
    const verificationContractAddress = process.env.VERIFICATION_CONTRACT_ADDRESS;
    
    console.log('Identity contract address:', identityContractAddress);
    console.log('Verification contract address:', verificationContractAddress);
    
    // Load ABIs from artifacts
    const identityArtifact = require('./artifacts/contracts/GlobalIdentityRegistry.sol/GlobalIdentityRegistry.json');
    const verificationArtifact = require('./artifacts/contracts/PlatformVerificationRegistry.sol/PlatformVerificationRegistry.json');
    
    const identityABI = identityArtifact.abi;
    const verificationABI = verificationArtifact.abi;
    
    console.log('Identity ABI loaded:', identityABI.length, 'functions');
    console.log('Verification ABI loaded:', verificationABI.length, 'functions');
    
    identityContract = new ethers.Contract(identityContractAddress, identityABI, provider);
    verificationContract = new ethers.Contract(verificationContractAddress, verificationABI, provider);
    
    console.log('Contracts initialized successfully');
}

// Utility functions
function generateDID(identityHash, address) {
    return ethers.keccak256(
        ethers.solidityPacked(['bytes32', 'address', 'uint256'], 
        [identityHash, address, Date.now()])
    );
}

function hashIdentityData(data) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return '0x' + hash.digest('hex');
}

async function uploadToIPFS(data) {
    // Mock IPFS upload - return a hash of the data
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return 'Qm' + hash.digest('hex').substring(0, 44); // Mock IPFS hash
}

function encryptData(data) {
    // Implement proper encryption using user's public key
    const cipher = crypto.createCipher('aes-256-cbc', config.jwtSecret);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// ==================== API ROUTES ====================

/**
 * Health check endpoint
 */
app.get('/api/health', async (req, res) => {
    try {
        const blockNumber = await provider.getBlockNumber();
        const redisStatus = redisClient.isOpen ? 'connected' : 'disconnected';
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            blockchain: {
                connected: true,
                blockNumber: blockNumber
            },
            redis: redisStatus,
            version: '1.0.0'
        });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});

/**
 * Create new identity
 * POST /api/identity/create
 */
app.post('/api/identity/create', async (req, res) => {
    try {
        const { personalData, biometricData, address, privateKey } = req.body;
        
        // Validate input
        if (!personalData || !address) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Hash identity data
        const identityHash = hashIdentityData({
            personal: personalData,
            biometric: biometricData
        });
        
        // Upload encrypted metadata to IPFS
        const ipfsHash = await uploadToIPFS({
            personalData,
            timestamp: Date.now()
        });
        
        // Create identity on blockchain
        const wallet = new ethers.Wallet(privateKey, provider);
        const contractWithSigner = identityContract.connect(wallet);
        
        const tx = await contractWithSigner.createIdentity(identityHash, ipfsHash);
        const receipt = await tx.wait();
        
        // Extract DID from event
        const event = receipt.logs.find(log => log.topics[0] === ethers.id('IdentityCreated(bytes32,address,uint256)'));
        const did = event.topics[1];
        
        // Cache in Redis
        await redisClient.set(`identity:${did}`, JSON.stringify({
            did,
            address,
            ipfsHash,
            createdAt: Date.now()
        }), { EX: 3600 }); // Cache for 1 hour
        
        res.json({
            success: true,
            did: did,
            transactionHash: receipt.hash,
            ipfsHash: ipfsHash
        });
        
    } catch (error) {
        console.error('Error creating identity:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get identity details
 * GET /api/identity/:did
 */
app.get('/api/identity/:did', async (req, res) => {
    try {
        const { did } = req.params;
        
        // Check cache first
        const cached = await redisClient.get(`identity:${did}`);
        if (cached) {
            return res.json({ success: true, data: JSON.parse(cached), cached: true });
        }
        
        // Fetch from blockchain
        const identity = await identityContract.getIdentity(did);
        
        const result = {
            did: did,
            owner: identity.owner,
            createdAt: Number(identity.createdAt),
            lastUpdated: Number(identity.lastUpdated),
            isActive: identity.isActive,
            isRevoked: identity.isRevoked,
            ipfsHash: identity.ipfsHash,
            verificationLevel: Number(identity.verificationLevel)
        };
        
        // Cache result
        await redisClient.set(`identity:${did}`, JSON.stringify(result), { EX: 3600 });
        
        res.json({ success: true, data: result, cached: false });
        
    } catch (error) {
        console.error('Error fetching identity:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Verify identity ownership
 * POST /api/identity/verify-ownership
 */
app.post('/api/identity/verify-ownership', async (req, res) => {
    try {
        const { did, address, signature } = req.body;
        
        // Verify signature
        const message = `Verify ownership of DID: ${did}`;
        const recoveredAddress = ethers.verifyMessage(message, signature);
        
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
            return res.status(401).json({ error: 'Invalid signature' });
        }
        
        // Check on blockchain
        const isOwner = await identityContract.verifyOwnership(did, address);
        
        res.json({
            success: true,
            isOwner: isOwner,
            verifiedAddress: recoveredAddress
        });
        
    } catch (error) {
        console.error('Error verifying ownership:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Add verification to identity
 * POST /api/verification/add
 */
app.post('/api/verification/add', async (req, res) => {
    try {
        const { did, verificationType, proofData, verifierPrivateKey } = req.body;
        
        // Validate verification type (1=email, 2=phone, 3=gov_id, 4=biometric)
        if (verificationType < 1 || verificationType > 4) {
            return res.status(400).json({ error: 'Invalid verification type' });
        }
        
        // Hash proof data
        const proofHash = hashIdentityData(proofData);
        
        // Add verification
        const wallet = new ethers.Wallet(verifierPrivateKey, provider);
        const contractWithSigner = identityContract.connect(wallet);
        
        const tx = await contractWithSigner.addVerification(did, verificationType, proofHash);
        const receipt = await tx.wait();
        
        res.json({
            success: true,
            transactionHash: receipt.hash,
            verificationType: verificationType
        });
        
    } catch (error) {
        console.error('Error adding verification:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Create platform verification
 * POST /api/platform/verify
 */
app.post('/api/platform/verify', async (req, res) => {
    try {
        const { identityDID, platformId, platformUserId, expirationDays, platformAdminKey } = req.body;
        
        // Create attestation
        const attestationData = {
            identityDID,
            platformId,
            platformUserId,
            timestamp: Date.now()
        };
        const attestationHash = hashIdentityData(attestationData);
        
        // Create verification on blockchain
        const wallet = new ethers.Wallet(platformAdminKey, provider);
        const contractWithSigner = verificationContract.connect(wallet);
        
        const tx = await contractWithSigner.createVerification(
            identityDID,
            platformId,
            platformUserId,
            expirationDays || 365,
            attestationHash
        );
        const receipt = await tx.wait();
        
        res.json({
            success: true,
            transactionHash: receipt.hash,
            attestationHash: attestationHash
        });
        
    } catch (error) {
        console.error('Error creating platform verification:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Check if identity is verified on platform
 * GET /api/platform/check/:platformId/:identityDID
 */
app.get('/api/platform/check/:platformId/:identityDID', async (req, res) => {
    try {
        const { platformId, identityDID } = req.params;
        
        // Check cache
        const cacheKey = `verification:${platformId}:${identityDID}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            return res.json({ success: true, data: JSON.parse(cached), cached: true });
        }
        
        // Check blockchain
        const isValid = await verificationContract.isVerificationValid(identityDID, platformId);
        const verification = await verificationContract.getVerification(identityDID, platformId);
        
        const result = {
            isValid: isValid,
            platformUserId: verification.platformUserId,
            verifiedAt: Number(verification.verifiedAt),
            expiresAt: Number(verification.expiresAt),
            trustScore: Number(verification.trustScore)
        };
        
        // Cache for 5 minutes
        await redisClient.set(cacheKey, JSON.stringify(result), { EX: 300 });
        
        res.json({ success: true, data: result, cached: false });
        
    } catch (error) {
        console.error('Error checking verification:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get platform user's identity DID
 * GET /api/platform/identity/:platformId/:platformUserId
 */
app.get('/api/platform/identity/:platformId/:platformUserId', async (req, res) => {
    try {
        const { platformId, platformUserId } = req.params;
        
        const identityDID = await verificationContract.getIdentityByPlatformUser(
            platformId,
            platformUserId
        );
        
        if (identityDID === ethers.ZeroHash) {
            return res.status(404).json({ error: 'No identity found for this platform user' });
        }
        
        res.json({
            success: true,
            identityDID: identityDID,
            platformUserId: platformUserId
        });
        
    } catch (error) {
        console.error('Error fetching identity:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get statistics
 * GET /api/stats
 */
app.get('/api/stats', async (req, res) => {
    try {
        const totalIdentities = await identityContract.totalIdentities();
        const totalVerifications = await identityContract.totalVerifications();
        const totalPlatforms = await verificationContract.totalPlatforms();
        const totalPlatformVerifications = await verificationContract.totalPlatformVerifications();
        
        res.json({
            success: true,
            statistics: {
                totalIdentities: Number(totalIdentities),
                totalVerifications: Number(totalVerifications),
                totalPlatforms: Number(totalPlatforms),
                totalPlatformVerifications: Number(totalPlatformVerifications),
                timestamp: Date.now()
            }
        });
        
    } catch (error) {
        console.error('Error fetching statistics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

// Start server
async function startServer() {
    try {
        await initializeBlockchain();
        
        app.listen(config.port, () => {
            console.log(`🚀 Global Identity Blockchain API Server running on port ${config.port}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`⛓️  Connected to blockchain: ${config.nodeUrl}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle shutdown gracefully
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await redisClient.quit();
    process.exit(0);
});

// Start the server
if (require.main === module) {
    startServer();
}

module.exports = app;
