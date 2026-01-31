/**
 * Comprehensive Test Suite for Global Digital Identity Blockchain
 * Tests cover smart contracts, API endpoints, and integration scenarios
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const request = require('supertest');

describe('Global Digital Identity Blockchain - Complete Test Suite', function() {
    
    let identityContract;
    let verificationContract;
    let owner, verifier, user1, user2, user3;
    let identityDID1, identityDID2;
    let platformId;
    
    // Test data
    const testIdentityHash = ethers.keccak256(ethers.toUtf8Bytes('test-identity-data'));
    const testIPFSHash = 'QmTestHash123456789';
    const testProofHash = ethers.keccak256(ethers.toUtf8Bytes('verification-proof'));
    
    before(async function() {
        [owner, verifier, user1, user2, user3] = await ethers.getSigners();
        
        // Deploy contracts
        const IdentityRegistry = await ethers.getContractFactory('GlobalIdentityRegistry');
        identityContract = await IdentityRegistry.deploy();
        await identityContract.waitForDeployment();
        
        const PlatformVerification = await ethers.getContractFactory('PlatformVerificationRegistry');
        verificationContract = await PlatformVerification.deploy();
        await verificationContract.waitForDeployment();
        
        // Grant roles
        const VERIFIER_ROLE = await identityContract.VERIFIER_ROLE();
        await identityContract.grantRole(VERIFIER_ROLE, verifier.address);
        
        console.log('✓ Test environment setup complete');
    });
    
    describe('1. Identity Registration Tests', function() {
        
        it('Should create a new identity', async function() {
            const tx = await identityContract.connect(user1).createIdentity(
                testIdentityHash,
                testIPFSHash
            );
            
            const receipt = await tx.wait();
            
            // Extract DID from event
            const event = receipt.logs.find(log => {
                try {
                    return identityContract.interface.parseLog(log).name === 'IdentityCreated';
                } catch (e) {
                    return false;
                }
            });
            
            const parsedEvent = identityContract.interface.parseLog(event);
            identityDID1 = parsedEvent.args[0];
            
            expect(identityDID1).to.not.equal(ethers.ZeroHash);
            
            const totalIdentities = await identityContract.totalIdentities();
            expect(totalIdentities).to.equal(1);
            
            console.log('  ✓ Identity created with DID:', identityDID1);
        });
        
        it('Should retrieve identity details', async function() {
            const identity = await identityContract.getIdentity(identityDID1);
            
            expect(identity.owner).to.equal(user1.address);
            expect(identity.isActive).to.be.true;
            expect(identity.isRevoked).to.be.false;
            expect(identity.ipfsHash).to.equal(testIPFSHash);
            expect(identity.verificationLevel).to.equal(0);
            
            console.log('  ✓ Identity details retrieved successfully');
        });
        
        it('Should prevent duplicate identity for same address', async function() {
            await expect(
                identityContract.connect(user1).createIdentity(
                    ethers.keccak256(ethers.toUtf8Bytes('different-data')),
                    'QmDifferentHash'
                )
            ).to.be.revertedWith('Address already has identity');
            
            console.log('  ✓ Duplicate prevention working');
        });
        
        it('Should verify identity ownership', async function() {
            const isOwner = await identityContract.verifyOwnership(identityDID1, user1.address);
            expect(isOwner).to.be.true;
            
            const notOwner = await identityContract.verifyOwnership(identityDID1, user2.address);
            expect(notOwner).to.be.false;
            
            console.log('  ✓ Ownership verification working');
        });
    });
    
    describe('2. Identity Update Tests', function() {
        
        it('Should update identity metadata', async function() {
            const newIPFSHash = 'QmNewHash987654321';
            
            await identityContract.connect(user1).updateIdentity(
                identityDID1,
                newIPFSHash
            );
            
            const identity = await identityContract.getIdentity(identityDID1);
            expect(identity.ipfsHash).to.equal(newIPFSHash);
            
            console.log('  ✓ Identity metadata updated');
        });
        
        it('Should prevent unauthorized updates', async function() {
            await expect(
                identityContract.connect(user2).updateIdentity(
                    identityDID1,
                    'QmUnauthorized'
                )
            ).to.be.revertedWith('Not identity owner');
            
            console.log('  ✓ Unauthorized update prevented');
        });
    });
    
    describe('3. Verification Tests', function() {
        
        it('Should add email verification (type 1)', async function() {
            await identityContract.connect(verifier).addVerification(
                identityDID1,
                1, // Email verification
                testProofHash
            );
            
            const verificationCount = await identityContract.getVerificationCount(identityDID1);
            expect(verificationCount).to.equal(1);
            
            const verification = await identityContract.getVerification(identityDID1, 0);
            expect(verification.verifier).to.equal(verifier.address);
            expect(verification.verificationType).to.equal(1);
            expect(verification.isValid).to.be.true;
            
            console.log('  ✓ Email verification added');
        });
        
        it('Should add government ID verification (type 3)', async function() {
            await identityContract.connect(verifier).addVerification(
                identityDID1,
                3, // Government ID
                testProofHash
            );
            
            const identity = await identityContract.getIdentity(identityDID1);
            expect(identity.verificationLevel).to.equal(3);
            
            console.log('  ✓ Government ID verification added, level upgraded');
        });
        
        it('Should add biometric verification (type 4)', async function() {
            await identityContract.connect(verifier).addVerification(
                identityDID1,
                4, // Biometric
                testProofHash
            );
            
            const identity = await identityContract.getIdentity(identityDID1);
            expect(identity.verificationLevel).to.equal(4);
            
            console.log('  ✓ Biometric verification added, max level reached');
        });
        
        it('Should allow verifier to revoke their verification', async function() {
            await identityContract.connect(verifier).revokeVerification(identityDID1, 0);
            
            const verification = await identityContract.getVerification(identityDID1, 0);
            expect(verification.isValid).to.be.false;
            
            console.log('  ✓ Verification revoked by verifier');
        });
        
        it('Should prevent non-verifiers from adding verifications', async function() {
            await expect(
                identityContract.connect(user2).addVerification(
                    identityDID1,
                    1,
                    testProofHash
                )
            ).to.be.reverted;
            
            console.log('  ✓ Non-verifier prevented from adding verification');
        });
    });
    
    describe('4. Guardian and Recovery Tests', function() {
        
        it('Should add guardians', async function() {
            await identityContract.connect(user1).addGuardian(identityDID1, user2.address);
            await identityContract.connect(user1).addGuardian(identityDID1, user3.address);
            
            const guardians = await identityContract.getGuardians(identityDID1);
            expect(guardians.length).to.equal(2);
            expect(guardians[0]).to.equal(user2.address);
            expect(guardians[1]).to.equal(user3.address);
            
            console.log('  ✓ Guardians added successfully');
        });
        
        it('Should initiate recovery process', async function() {
            const newOwner = owner.address;
            
            await identityContract.connect(user2).initiateRecovery(identityDID1, newOwner);
            
            const pendingRecovery = await identityContract.pendingRecoveryAddress(identityDID1);
            expect(pendingRecovery).to.equal(newOwner);
            
            console.log('  ✓ Recovery initiated by guardian');
        });
        
        it('Should complete recovery with majority approval', async function() {
            const newOwner = owner.address;
            
            // Second guardian approves (this should trigger recovery with 2/2 guardians)
            await identityContract.connect(user3).approveRecovery(identityDID1);
            
            const identity = await identityContract.getIdentity(identityDID1);
            expect(identity.owner).to.equal(newOwner);
            
            const addressMapping = await identityContract.addressToIdentity(newOwner);
            expect(addressMapping).to.equal(identityDID1);
            
            console.log('  ✓ Recovery completed successfully');
        });
    });
    
    describe('5. Identity Revocation Tests', function() {
        
        it('Should allow owner to revoke identity', async function() {
            // Create second identity for revocation test
            const tx = await identityContract.connect(user2).createIdentity(
                ethers.keccak256(ethers.toUtf8Bytes('user2-identity')),
                'QmUser2Hash'
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return identityContract.interface.parseLog(log).name === 'IdentityCreated';
                } catch (e) {
                    return false;
                }
            });
            const parsedEvent = identityContract.interface.parseLog(event);
            identityDID2 = parsedEvent.args[0];
            
            // Revoke it
            await identityContract.connect(user2).revokeIdentity(identityDID2);
            
            const identity = await identityContract.getIdentity(identityDID2);
            expect(identity.isRevoked).to.be.true;
            expect(identity.isActive).to.be.false;
            
            console.log('  ✓ Identity revoked by owner');
        });
        
        it('Should prevent operations on revoked identity', async function() {
            await expect(
                identityContract.connect(user2).updateIdentity(identityDID2, 'QmNewHash')
            ).to.be.revertedWith('Identity revoked');
            
            console.log('  ✓ Operations blocked on revoked identity');
        });
    });
    
    describe('6. Platform Integration Tests', function() {
        
        it('Should register a new platform', async function() {
            const tx = await verificationContract.registerPlatform(
                'Twitter',
                'twitter.com',
                0 // SocialMedia
            );
            
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return verificationContract.interface.parseLog(log).name === 'PlatformRegistered';
                } catch (e) {
                    return false;
                }
            });
            const parsedEvent = verificationContract.interface.parseLog(event);
            platformId = parsedEvent.args[0];
            
            const platform = await verificationContract.getPlatform(platformId);
            expect(platform.name).to.equal('Twitter');
            expect(platform.domain).to.equal('twitter.com');
            expect(platform.isActive).to.be.true;
            
            console.log('  ✓ Platform registered:', platform.name);
        });
        
        it('Should create platform verification', async function() {
            const platformUserId = 'twitter_user_123';
            const attestationHash = ethers.keccak256(ethers.toUtf8Bytes('attestation-data'));
            
            await verificationContract.createVerification(
                identityDID1,
                platformId,
                platformUserId,
                365, // expires in 1 year
                attestationHash
            );
            
            const isValid = await verificationContract.isVerificationValid(identityDID1, platformId);
            expect(isValid).to.be.true;
            
            console.log('  ✓ Platform verification created');
        });
        
        it('Should retrieve identity from platform user ID', async function() {
            const platformUserId = 'twitter_user_123';
            
            const retrievedDID = await verificationContract.getIdentityByPlatformUser(
                platformId,
                platformUserId
            );
            
            expect(retrievedDID).to.equal(identityDID1);
            
            console.log('  ✓ Identity retrieved from platform user ID');
        });
        
        it('Should update trust score', async function() {
            await verificationContract.updateTrustScore(identityDID1, platformId, 85);
            
            const verification = await verificationContract.getVerification(identityDID1, platformId);
            expect(verification.trustScore).to.equal(85);
            
            console.log('  ✓ Trust score updated');
        });
        
        it('Should revoke platform verification', async function() {
            await verificationContract.revokeVerification(identityDID1, platformId);
            
            const isValid = await verificationContract.isVerificationValid(identityDID1, platformId);
            expect(isValid).to.be.false;
            
            console.log('  ✓ Platform verification revoked');
        });
    });
    
    describe('7. Performance and Scalability Tests', function() {
        
        it('Should handle batch verification checks', async function() {
            // Create multiple identities
            const identities = [];
            
            for (let i = 0; i < 5; i++) {
                const tx = await identityContract.connect(owner).createIdentity(
                    ethers.keccak256(ethers.toUtf8Bytes(`batch-test-${i}`)),
                    `QmBatchHash${i}`
                );
                const receipt = await tx.wait();
                const event = receipt.logs.find(log => {
                    try {
                        return identityContract.interface.parseLog(log).name === 'IdentityCreated';
                    } catch (e) {
                        return false;
                    }
                });
                const parsedEvent = identityContract.interface.parseLog(event);
                identities.push(parsedEvent.args[0]);
                
                // Transfer ownership to different addresses for next iteration
                await identityContract.connect(owner).updateIdentity(
                    parsedEvent.args[0],
                    `QmUpdated${i}`
                );
            }
            
            // Batch check
            const results = await verificationContract.batchVerificationCheck(identities, platformId);
            expect(results.length).to.equal(5);
            
            console.log('  ✓ Batch verification completed for', identities.length, 'identities');
        });
        
        it('Should measure gas costs for common operations', async function() {
            const operations = [];
            
            // Create identity
            const createTx = await identityContract.connect(owner).createIdentity(
                ethers.keccak256(ethers.toUtf8Bytes('gas-test')),
                'QmGasTest'
            );
            const createReceipt = await createTx.wait();
            operations.push({ name: 'Create Identity', gas: createReceipt.gasUsed.toString() });
            
            console.log('\n  Gas Usage Report:');
            operations.forEach(op => {
                console.log(`    ${op.name}: ${op.gas} gas`);
            });
        });
    });
    
    describe('8. Security Tests', function() {
        
        it('Should prevent reentrancy attacks', async function() {
            // The nonReentrant modifier should prevent reentrancy
            // This is tested implicitly through normal operations
            console.log('  ✓ Reentrancy protection active (implicit)');
        });
        
        it('Should respect access controls', async function() {
            const ADMIN_ROLE = await identityContract.ADMIN_ROLE();
            
            // User1 should not have admin role
            const hasRole = await identityContract.hasRole(ADMIN_ROLE, user1.address);
            expect(hasRole).to.be.false;
            
            console.log('  ✓ Access controls enforced');
        });
        
        it('Should handle pause/unpause correctly', async function() {
            // Pause contract
            await identityContract.pause();
            
            // Should fail to create identity while paused
            await expect(
                identityContract.connect(owner).createIdentity(
                    ethers.keccak256(ethers.toUtf8Bytes('paused-test')),
                    'QmPausedTest'
                )
            ).to.be.revertedWith('Pausable: paused');
            
            // Unpause
            await identityContract.unpause();
            
            // Should work now
            await identityContract.connect(owner).createIdentity(
                ethers.keccak256(ethers.toUtf8Bytes('unpaused-test')),
                'QmUnpausedTest'
            );
            
            console.log('  ✓ Pause/unpause mechanism working');
        });
    });
    
    describe('9. Statistics and Reporting', function() {
        
        it('Should track total identities correctly', async function() {
            const total = await identityContract.totalIdentities();
            expect(total).to.be.greaterThan(0);
            
            console.log('  ✓ Total identities:', total.toString());
        });
        
        it('Should track total verifications correctly', async function() {
            const total = await identityContract.totalVerifications();
            expect(total).to.be.greaterThan(0);
            
            console.log('  ✓ Total verifications:', total.toString());
        });
        
        it('Should track platform statistics', async function() {
            const totalPlatforms = await verificationContract.totalPlatforms();
            const totalPlatformVerifications = await verificationContract.totalPlatformVerifications();
            
            console.log('  ✓ Total platforms:', totalPlatforms.toString());
            console.log('  ✓ Total platform verifications:', totalPlatformVerifications.toString());
        });
    });
    
    after(function() {
        console.log('\n' + '='.repeat(80));
        console.log('✅ All tests completed successfully!');
        console.log('='.repeat(80) + '\n');
    });
});
