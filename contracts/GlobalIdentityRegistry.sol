// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title GlobalIdentityRegistry
 * @dev Core smart contract for managing global digital identities
 * @notice This contract stores cryptographic proofs of identity while preserving privacy
 */
contract GlobalIdentityRegistry is AccessControl, ReentrancyGuard, Pausable {
    
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    
    // Identity structure
    struct Identity {
        bytes32 identityHash;        // Hash of biometric + personal data
        address owner;               // Ethereum address controlling this identity
        uint256 createdAt;          // Timestamp of creation
        uint256 lastUpdated;        // Timestamp of last update
        bool isActive;              // Identity status
        bool isRevoked;             // Revocation status
        string ipfsHash;            // IPFS hash for encrypted metadata
        uint256 verificationLevel;  // 0=unverified, 1=basic, 2=government, 3=biometric
    }
    
    // Verification attestation
    struct Verification {
        address verifier;           // Who verified this identity
        uint256 timestamp;          // When verification occurred
        uint8 verificationType;     // Type of verification (1=email, 2=phone, 3=gov_id, 4=biometric)
        bytes32 proofHash;          // Hash of verification proof
        bool isValid;               // Current validity status
    }
    
    // Mapping from identity DID to Identity struct
    mapping(bytes32 => Identity) public identities;
    
    // Mapping from owner address to identity DID
    mapping(address => bytes32) public addressToIdentity;
    
    // Mapping from identity DID to verifications
    mapping(bytes32 => Verification[]) public verifications;
    
    // Mapping to track if an identity hash is already used
    mapping(bytes32 => bool) public identityHashExists;
    
    // Recovery mechanism - guardian addresses
    mapping(bytes32 => address[]) public guardians;
    
    // Social recovery - pending recovery requests
    mapping(bytes32 => mapping(address => bool)) public recoveryApprovals;
    mapping(bytes32 => address) public pendingRecoveryAddress;
    mapping(bytes32 => uint256) public recoveryApprovalCount;
    
    // Statistics
    uint256 public totalIdentities;
    uint256 public totalVerifications;
    
    // Events
    event IdentityCreated(bytes32 indexed did, address indexed owner, uint256 timestamp);
    event IdentityUpdated(bytes32 indexed did, uint256 timestamp);
    event IdentityRevoked(bytes32 indexed did, uint256 timestamp);
    event IdentityRecovered(bytes32 indexed did, address oldOwner, address newOwner);
    event VerificationAdded(bytes32 indexed did, address indexed verifier, uint8 verificationType);
    event VerificationRevoked(bytes32 indexed did, uint256 verificationIndex);
    event GuardianAdded(bytes32 indexed did, address indexed guardian);
    event GuardianRemoved(bytes32 indexed did, address indexed guardian);
    event RecoveryInitiated(bytes32 indexed did, address indexed newOwner);
    
    /**
     * @dev Constructor sets up roles
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new digital identity
     * @param _identityHash Cryptographic hash of identity data
     * @param _ipfsHash IPFS hash containing encrypted metadata
     */
    function createIdentity(
        bytes32 _identityHash,
        string memory _ipfsHash
    ) external whenNotPaused nonReentrant returns (bytes32) {
        require(!identityHashExists[_identityHash], "Identity already exists");
        require(addressToIdentity[msg.sender] == bytes32(0), "Address already has identity");
        
        // Generate DID (Decentralized Identifier)
        bytes32 did = keccak256(abi.encodePacked(_identityHash, msg.sender, block.timestamp));
        
        // Create identity
        identities[did] = Identity({
            identityHash: _identityHash,
            owner: msg.sender,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            isActive: true,
            isRevoked: false,
            ipfsHash: _ipfsHash,
            verificationLevel: 0
        });
        
        identityHashExists[_identityHash] = true;
        addressToIdentity[msg.sender] = did;
        totalIdentities++;
        
        emit IdentityCreated(did, msg.sender, block.timestamp);
        
        return did;
    }
    
    /**
     * @dev Update identity metadata
     * @param _did Decentralized identifier
     * @param _newIpfsHash New IPFS hash for updated metadata
     */
    function updateIdentity(
        bytes32 _did,
        string memory _newIpfsHash
    ) external whenNotPaused {
        require(identities[_did].owner == msg.sender, "Not identity owner");
        require(identities[_did].isActive, "Identity not active");
        require(!identities[_did].isRevoked, "Identity revoked");
        
        identities[_did].ipfsHash = _newIpfsHash;
        identities[_did].lastUpdated = block.timestamp;
        
        emit IdentityUpdated(_did, block.timestamp);
    }
    
    /**
     * @dev Add verification attestation to an identity
     * @param _did Decentralized identifier
     * @param _verificationType Type of verification
     * @param _proofHash Hash of verification proof
     */
    function addVerification(
        bytes32 _did,
        uint8 _verificationType,
        bytes32 _proofHash
    ) external whenNotPaused onlyRole(VERIFIER_ROLE) {
        require(identities[_did].isActive, "Identity not active");
        require(!identities[_did].isRevoked, "Identity revoked");
        require(_verificationType >= 1 && _verificationType <= 4, "Invalid verification type");
        
        verifications[_did].push(Verification({
            verifier: msg.sender,
            timestamp: block.timestamp,
            verificationType: _verificationType,
            proofHash: _proofHash,
            isValid: true
        }));
        
        // Update verification level
        if (_verificationType > identities[_did].verificationLevel) {
            identities[_did].verificationLevel = _verificationType;
        }
        
        totalVerifications++;
        
        emit VerificationAdded(_did, msg.sender, _verificationType);
    }
    
    /**
     * @dev Revoke a specific verification
     * @param _did Decentralized identifier
     * @param _verificationIndex Index of verification to revoke
     */
    function revokeVerification(
        bytes32 _did,
        uint256 _verificationIndex
    ) external onlyRole(VERIFIER_ROLE) {
        require(_verificationIndex < verifications[_did].length, "Invalid index");
        require(
            verifications[_did][_verificationIndex].verifier == msg.sender,
            "Not verification owner"
        );
        
        verifications[_did][_verificationIndex].isValid = false;
        
        emit VerificationRevoked(_did, _verificationIndex);
    }
    
    /**
     * @dev Revoke entire identity (emergency use only)
     * @param _did Decentralized identifier
     */
    function revokeIdentity(bytes32 _did) external {
        require(
            identities[_did].owner == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        require(!identities[_did].isRevoked, "Already revoked");
        
        identities[_did].isRevoked = true;
        identities[_did].isActive = false;
        identities[_did].lastUpdated = block.timestamp;
        
        emit IdentityRevoked(_did, block.timestamp);
    }
    
    /**
     * @dev Add a guardian for social recovery
     * @param _did Decentralized identifier
     * @param _guardian Guardian address
     */
    function addGuardian(bytes32 _did, address _guardian) external {
        require(identities[_did].owner == msg.sender, "Not identity owner");
        require(_guardian != address(0), "Invalid guardian address");
        require(_guardian != msg.sender, "Cannot be self");
        
        guardians[_did].push(_guardian);
        
        emit GuardianAdded(_did, _guardian);
    }
    
    /**
     * @dev Initiate recovery process
     * @param _did Decentralized identifier
     * @param _newOwner New owner address after recovery
     */
    function initiateRecovery(
        bytes32 _did,
        address _newOwner
    ) external {
        require(_isGuardian(_did, msg.sender), "Not a guardian");
        require(_newOwner != address(0), "Invalid new owner");
        require(pendingRecoveryAddress[_did] == address(0), "Recovery already pending");
        
        pendingRecoveryAddress[_did] = _newOwner;
        recoveryApprovals[_did][msg.sender] = true;
        recoveryApprovalCount[_did] = 1;
        
        emit RecoveryInitiated(_did, _newOwner);
    }
    
    /**
     * @dev Approve pending recovery
     * @param _did Decentralized identifier
     */
    function approveRecovery(bytes32 _did) external {
        require(_isGuardian(_did, msg.sender), "Not a guardian");
        require(pendingRecoveryAddress[_did] != address(0), "No pending recovery");
        require(!recoveryApprovals[_did][msg.sender], "Already approved");
        
        recoveryApprovals[_did][msg.sender] = true;
        recoveryApprovalCount[_did]++;
        
        // If majority of guardians approved, execute recovery
        uint256 requiredApprovals = (guardians[_did].length / 2) + 1;
        if (recoveryApprovalCount[_did] >= requiredApprovals) {
            _executeRecovery(_did);
        }
    }
    
    /**
     * @dev Execute recovery after sufficient approvals
     * @param _did Decentralized identifier
     */
    function _executeRecovery(bytes32 _did) internal {
        address oldOwner = identities[_did].owner;
        address newOwner = pendingRecoveryAddress[_did];
        
        // Update ownership
        identities[_did].owner = newOwner;
        identities[_did].lastUpdated = block.timestamp;
        
        // Update address mapping
        delete addressToIdentity[oldOwner];
        addressToIdentity[newOwner] = _did;
        
        // Clear recovery state
        delete pendingRecoveryAddress[_did];
        recoveryApprovalCount[_did] = 0;
        
        // Clear all guardian approvals
        for (uint256 i = 0; i < guardians[_did].length; i++) {
            delete recoveryApprovals[_did][guardians[_did][i]];
        }
        
        emit IdentityRecovered(_did, oldOwner, newOwner);
    }
    
    /**
     * @dev Check if address is a guardian
     * @param _did Decentralized identifier
     * @param _address Address to check
     */
    function _isGuardian(bytes32 _did, address _address) internal view returns (bool) {
        for (uint256 i = 0; i < guardians[_did].length; i++) {
            if (guardians[_did][i] == _address) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @dev Verify identity ownership
     * @param _did Decentralized identifier
     * @param _owner Address to verify
     */
    function verifyOwnership(bytes32 _did, address _owner) external view returns (bool) {
        return identities[_did].owner == _owner && 
               identities[_did].isActive && 
               !identities[_did].isRevoked;
    }
    
    /**
     * @dev Get identity details
     * @param _did Decentralized identifier
     */
    function getIdentity(bytes32 _did) external view returns (
        address owner,
        uint256 createdAt,
        uint256 lastUpdated,
        bool isActive,
        bool isRevoked,
        string memory ipfsHash,
        uint256 verificationLevel
    ) {
        Identity memory identity = identities[_did];
        return (
            identity.owner,
            identity.createdAt,
            identity.lastUpdated,
            identity.isActive,
            identity.isRevoked,
            identity.ipfsHash,
            identity.verificationLevel
        );
    }
    
    /**
     * @dev Get verification count for identity
     * @param _did Decentralized identifier
     */
    function getVerificationCount(bytes32 _did) external view returns (uint256) {
        return verifications[_did].length;
    }
    
    /**
     * @dev Get specific verification
     * @param _did Decentralized identifier
     * @param _index Verification index
     */
    function getVerification(bytes32 _did, uint256 _index) external view returns (
        address verifier,
        uint256 timestamp,
        uint8 verificationType,
        bytes32 proofHash,
        bool isValid
    ) {
        require(_index < verifications[_did].length, "Invalid index");
        Verification memory verification = verifications[_did][_index];
        return (
            verification.verifier,
            verification.timestamp,
            verification.verificationType,
            verification.proofHash,
            verification.isValid
        );
    }
    
    /**
     * @dev Get guardians for identity
     * @param _did Decentralized identifier
     */
    function getGuardians(bytes32 _did) external view returns (address[] memory) {
        return guardians[_did];
    }
    
    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
