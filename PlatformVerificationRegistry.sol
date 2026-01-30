// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PlatformVerificationRegistry
 * @dev Manages verification relationships between identities and platforms (social media, services)
 * @notice This contract enables platforms to verify user identities and manage access control
 */
contract PlatformVerificationRegistry is AccessControl, ReentrancyGuard {
    
    bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");
    
    // Platform registration
    struct Platform {
        string name;
        string domain;
        address adminAddress;
        bool isActive;
        uint256 registeredAt;
        uint256 totalVerifications;
        PlatformType platformType;
    }
    
    enum PlatformType {
        SocialMedia,
        Financial,
        Healthcare,
        Government,
        Education,
        Other
    }
    
    // Platform verification record
    struct PlatformVerification {
        bytes32 identityDID;
        bytes32 platformId;
        string platformUserId;      // Platform-specific user ID
        uint256 verifiedAt;
        uint256 expiresAt;
        bool isActive;
        uint8 trustScore;          // 0-100 trust score
        bytes32 attestationHash;   // Hash of verification proof
    }
    
    // Mapping from platform ID to Platform
    mapping(bytes32 => Platform) public platforms;
    
    // Mapping from domain to platform ID
    mapping(string => bytes32) public domainToPlatform;
    
    // Mapping from identity DID to platform verifications
    mapping(bytes32 => mapping(bytes32 => PlatformVerification)) public verifications;
    
    // Mapping from platform to list of verified identities
    mapping(bytes32 => bytes32[]) public platformVerifiedIdentities;
    
    // Reverse lookup: platform user ID to identity DID
    mapping(bytes32 => mapping(string => bytes32)) public platformUserToIdentity;
    
    // Statistics
    uint256 public totalPlatforms;
    uint256 public totalPlatformVerifications;
    
    // Events
    event PlatformRegistered(bytes32 indexed platformId, string name, string domain);
    event PlatformUpdated(bytes32 indexed platformId);
    event PlatformDeactivated(bytes32 indexed platformId);
    event VerificationCreated(bytes32 indexed identityDID, bytes32 indexed platformId, string platformUserId);
    event VerificationRevoked(bytes32 indexed identityDID, bytes32 indexed platformId);
    event VerificationExpired(bytes32 indexed identityDID, bytes32 indexed platformId);
    event TrustScoreUpdated(bytes32 indexed identityDID, bytes32 indexed platformId, uint8 newScore);
    
    /**
     * @dev Constructor
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PLATFORM_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Register a new platform
     * @param _name Platform name
     * @param _domain Platform domain
     * @param _platformType Type of platform
     */
    function registerPlatform(
        string memory _name,
        string memory _domain,
        PlatformType _platformType
    ) external onlyRole(PLATFORM_ADMIN_ROLE) returns (bytes32) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_domain).length > 0, "Domain cannot be empty");
        require(domainToPlatform[_domain] == bytes32(0), "Domain already registered");
        
        bytes32 platformId = keccak256(abi.encodePacked(_name, _domain, block.timestamp));
        
        platforms[platformId] = Platform({
            name: _name,
            domain: _domain,
            adminAddress: msg.sender,
            isActive: true,
            registeredAt: block.timestamp,
            totalVerifications: 0,
            platformType: _platformType
        });
        
        domainToPlatform[_domain] = platformId;
        totalPlatforms++;
        
        emit PlatformRegistered(platformId, _name, _domain);
        
        return platformId;
    }
    
    /**
     * @dev Create verification between identity and platform
     * @param _identityDID User's decentralized identifier
     * @param _platformId Platform identifier
     * @param _platformUserId Platform-specific user ID
     * @param _expirationDays Days until verification expires (0 = no expiration)
     * @param _attestationHash Hash of verification proof
     */
    function createVerification(
        bytes32 _identityDID,
        bytes32 _platformId,
        string memory _platformUserId,
        uint256 _expirationDays,
        bytes32 _attestationHash
    ) external nonReentrant {
        require(platforms[_platformId].isActive, "Platform not active");
        require(
            platforms[_platformId].adminAddress == msg.sender || 
            hasRole(PLATFORM_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(bytes(_platformUserId).length > 0, "Platform user ID required");
        require(_identityDID != bytes32(0), "Invalid identity DID");
        
        // Check if verification already exists
        require(
            !verifications[_identityDID][_platformId].isActive,
            "Verification already exists"
        );
        
        uint256 expiresAt = _expirationDays > 0 
            ? block.timestamp + (_expirationDays * 1 days)
            : 0;
        
        verifications[_identityDID][_platformId] = PlatformVerification({
            identityDID: _identityDID,
            platformId: _platformId,
            platformUserId: _platformUserId,
            verifiedAt: block.timestamp,
            expiresAt: expiresAt,
            isActive: true,
            trustScore: 50, // Default middle score
            attestationHash: _attestationHash
        });
        
        // Update mappings
        platformVerifiedIdentities[_platformId].push(_identityDID);
        platformUserToIdentity[_platformId][_platformUserId] = _identityDID;
        
        // Update statistics
        platforms[_platformId].totalVerifications++;
        totalPlatformVerifications++;
        
        emit VerificationCreated(_identityDID, _platformId, _platformUserId);
    }
    
    /**
     * @dev Revoke verification
     * @param _identityDID User's decentralized identifier
     * @param _platformId Platform identifier
     */
    function revokeVerification(
        bytes32 _identityDID,
        bytes32 _platformId
    ) external {
        require(
            platforms[_platformId].adminAddress == msg.sender || 
            hasRole(PLATFORM_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(verifications[_identityDID][_platformId].isActive, "Verification not active");
        
        verifications[_identityDID][_platformId].isActive = false;
        
        emit VerificationRevoked(_identityDID, _platformId);
    }
    
    /**
     * @dev Update trust score for a verification
     * @param _identityDID User's decentralized identifier
     * @param _platformId Platform identifier
     * @param _newScore New trust score (0-100)
     */
    function updateTrustScore(
        bytes32 _identityDID,
        bytes32 _platformId,
        uint8 _newScore
    ) external {
        require(
            platforms[_platformId].adminAddress == msg.sender || 
            hasRole(PLATFORM_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(_newScore <= 100, "Score must be 0-100");
        require(verifications[_identityDID][_platformId].isActive, "Verification not active");
        
        verifications[_identityDID][_platformId].trustScore = _newScore;
        
        emit TrustScoreUpdated(_identityDID, _platformId, _newScore);
    }
    
    /**
     * @dev Check if verification is valid and not expired
     * @param _identityDID User's decentralized identifier
     * @param _platformId Platform identifier
     */
    function isVerificationValid(
        bytes32 _identityDID,
        bytes32 _platformId
    ) external view returns (bool) {
        PlatformVerification memory verification = verifications[_identityDID][_platformId];
        
        if (!verification.isActive) {
            return false;
        }
        
        if (verification.expiresAt > 0 && block.timestamp > verification.expiresAt) {
            return false;
        }
        
        return true;
    }
    
    /**
     * @dev Get identity DID from platform user ID
     * @param _platformId Platform identifier
     * @param _platformUserId Platform-specific user ID
     */
    function getIdentityByPlatformUser(
        bytes32 _platformId,
        string memory _platformUserId
    ) external view returns (bytes32) {
        return platformUserToIdentity[_platformId][_platformUserId];
    }
    
    /**
     * @dev Get verification details
     * @param _identityDID User's decentralized identifier
     * @param _platformId Platform identifier
     */
    function getVerification(
        bytes32 _identityDID,
        bytes32 _platformId
    ) external view returns (
        string memory platformUserId,
        uint256 verifiedAt,
        uint256 expiresAt,
        bool isActive,
        uint8 trustScore,
        bytes32 attestationHash
    ) {
        PlatformVerification memory verification = verifications[_identityDID][_platformId];
        return (
            verification.platformUserId,
            verification.verifiedAt,
            verification.expiresAt,
            verification.isActive,
            verification.trustScore,
            verification.attestationHash
        );
    }
    
    /**
     * @dev Get platform details
     * @param _platformId Platform identifier
     */
    function getPlatform(bytes32 _platformId) external view returns (
        string memory name,
        string memory domain,
        address adminAddress,
        bool isActive,
        uint256 registeredAt,
        uint256 totalVerifications,
        PlatformType platformType
    ) {
        Platform memory platform = platforms[_platformId];
        return (
            platform.name,
            platform.domain,
            platform.adminAddress,
            platform.isActive,
            platform.registeredAt,
            platform.totalVerifications,
            platform.platformType
        );
    }
    
    /**
     * @dev Get all verified identities for a platform
     * @param _platformId Platform identifier
     */
    function getPlatformVerifiedIdentities(bytes32 _platformId) external view returns (bytes32[] memory) {
        return platformVerifiedIdentities[_platformId];
    }
    
    /**
     * @dev Deactivate platform
     * @param _platformId Platform identifier
     */
    function deactivatePlatform(bytes32 _platformId) external {
        require(
            platforms[_platformId].adminAddress == msg.sender || 
            hasRole(PLATFORM_ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        
        platforms[_platformId].isActive = false;
        
        emit PlatformDeactivated(_platformId);
    }
    
    /**
     * @dev Batch verification check for multiple identities
     * @param _identityDIDs Array of identity DIDs
     * @param _platformId Platform identifier
     */
    function batchVerificationCheck(
        bytes32[] memory _identityDIDs,
        bytes32 _platformId
    ) external view returns (bool[] memory) {
        bool[] memory results = new bool[](_identityDIDs.length);
        
        for (uint256 i = 0; i < _identityDIDs.length; i++) {
            PlatformVerification memory verification = verifications[_identityDIDs[i]][_platformId];
            
            bool isValid = verification.isActive;
            if (verification.expiresAt > 0 && block.timestamp > verification.expiresAt) {
                isValid = false;
            }
            
            results[i] = isValid;
        }
        
        return results;
    }
}
