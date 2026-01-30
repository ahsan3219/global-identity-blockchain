import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

// Contract ABIs (simplified for demo)
const IDENTITY_ABI = [
  "function createIdentity(bytes32 _identityHash, string memory _ipfsHash) external returns (bytes32)",
  "function getIdentity(bytes32 _did) external view returns (address, uint256, uint256, bool, bool, string, uint256)",
  "function verifyOwnership(bytes32 _did, address _owner) external view returns (bool)",
  "function totalIdentities() external view returns (uint256)",
  "event IdentityCreated(bytes32 indexed did, address indexed owner, uint256 timestamp)"
];

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [nationality, setNationality] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  
  // Display states
  const [identityDID, setIdentityDID] = useState('');
  const [totalIdentities, setTotalIdentities] = useState(0);
  const [identityDetails, setIdentityDetails] = useState(null);
  
  // Configuration
  const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';

  useEffect(() => {
    initializeProvider();
  }, []);

  const initializeProvider = async () => {
    if (window.ethereum) {
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(web3Provider);
      
      const web3Signer = await web3Provider.getSigner();
      setSigner(web3Signer);
      
      const address = await web3Signer.getAddress();
      setAccount(address);
      
      const identityContract = new ethers.Contract(CONTRACT_ADDRESS, IDENTITY_ABI, web3Signer);
      setContract(identityContract);
      
      // Get statistics
      const total = await identityContract.totalIdentities();
      setTotalIdentities(Number(total));
    } else {
      alert('Please install MetaMask to use this application');
    }
  };

  const connectWallet = async () => {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      await initializeProvider();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    }
  };

  const createIdentity = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create identity data object
      const identityData = {
        fullName,
        dateOfBirth,
        nationality,
        documentNumber,
        timestamp: Date.now()
      };

      // Hash the identity data
      const identityHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(identityData)));
      
      // In production, upload to IPFS
      const ipfsHash = `Qm${ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(identityData))).slice(2, 48)}`;

      // Create identity on blockchain
      const tx = await contract.createIdentity(identityHash, ipfsHash);
      console.log('Transaction sent:', tx.hash);
      
      const receipt = await tx.wait();
      console.log('Transaction confirmed:', receipt);

      // Parse event to get DID
      const event = receipt.logs.find(log => {
        try {
          return contract.interface.parseLog(log).name === 'IdentityCreated';
        } catch (e) {
          return false;
        }
      });

      if (event) {
        const parsedEvent = contract.interface.parseLog(event);
        const did = parsedEvent.args[0];
        setIdentityDID(did);
        
        // Update statistics
        const total = await contract.totalIdentities();
        setTotalIdentities(Number(total));
        
        alert(`Identity created successfully!\nDID: ${did}`);
      }

      // Clear form
      setFullName('');
      setDateOfBirth('');
      setNationality('');
      setDocumentNumber('');

    } catch (error) {
      console.error('Error creating identity:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const lookupIdentity = async () => {
    if (!identityDID) {
      alert('Please enter a DID');
      return;
    }

    setLoading(true);

    try {
      const identity = await contract.getIdentity(identityDID);
      
      setIdentityDetails({
        owner: identity[0],
        createdAt: new Date(Number(identity[1]) * 1000).toLocaleString(),
        lastUpdated: new Date(Number(identity[2]) * 1000).toLocaleString(),
        isActive: identity[3],
        isRevoked: identity[4],
        ipfsHash: identity[5],
        verificationLevel: Number(identity[6])
      });

    } catch (error) {
      console.error('Error looking up identity:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const verificationLevelText = (level) => {
    const levels = ['Unverified', 'Email', 'Phone', 'Government ID', 'Biometric'];
    return levels[level] || 'Unknown';
  };

  return (
    <div className="App">
      <header className="header">
        <h1>🌐 Global Digital Identity Blockchain</h1>
        <p className="tagline">Decentralized Identity Verification for Everyone</p>
      </header>

      <div className="container">
        {!account ? (
          <div className="connect-section">
            <button onClick={connectWallet} className="btn-primary">
              Connect Wallet
            </button>
            <p className="info-text">Connect your wallet to get started</p>
          </div>
        ) : (
          <>
            <div className="account-info">
              <p><strong>Connected Account:</strong> {account.slice(0, 6)}...{account.slice(-4)}</p>
              <p><strong>Total Identities:</strong> {totalIdentities}</p>
            </div>

            <div className="sections">
              {/* Create Identity Section */}
              <section className="section">
                <h2>📝 Create New Identity</h2>
                <form onSubmit={createIdentity} className="form">
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Nationality</label>
                    <input
                      type="text"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      required
                      placeholder="Enter your nationality"
                    />
                  </div>

                  <div className="form-group">
                    <label>Document Number</label>
                    <input
                      type="text"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      required
                      placeholder="Passport or ID number"
                    />
                  </div>

                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Identity'}
                  </button>
                </form>
              </section>

              {/* Lookup Identity Section */}
              <section className="section">
                <h2>🔍 Lookup Identity</h2>
                <div className="lookup-section">
                  <div className="form-group">
                    <label>Identity DID</label>
                    <input
                      type="text"
                      value={identityDID}
                      onChange={(e) => setIdentityDID(e.target.value)}
                      placeholder="0x..."
                    />
                  </div>
                  
                  <button onClick={lookupIdentity} className="btn-secondary" disabled={loading}>
                    {loading ? 'Looking up...' : 'Lookup'}
                  </button>

                  {identityDetails && (
                    <div className="identity-details">
                      <h3>Identity Details</h3>
                      <div className="detail-item">
                        <span className="label">Owner:</span>
                        <span className="value">{identityDetails.owner}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Created:</span>
                        <span className="value">{identityDetails.createdAt}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Last Updated:</span>
                        <span className="value">{identityDetails.lastUpdated}</span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Status:</span>
                        <span className={`badge ${identityDetails.isActive ? 'active' : 'inactive'}`}>
                          {identityDetails.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Revoked:</span>
                        <span className={`badge ${identityDetails.isRevoked ? 'revoked' : 'valid'}`}>
                          {identityDetails.isRevoked ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="label">Verification Level:</span>
                        <span className="badge level">
                          {verificationLevelText(identityDetails.verificationLevel)}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="label">IPFS Hash:</span>
                        <span className="value small">{identityDetails.ipfsHash}</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Statistics Section */}
            <section className="section stats">
              <h2>📊 Network Statistics</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">{totalIdentities}</div>
                  <div className="stat-label">Total Identities</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{account ? '1' : '0'}</div>
                  <div className="stat-label">Your Identities</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">0</div>
                  <div className="stat-label">Verifications</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">0</div>
                  <div className="stat-label">Platforms</div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>

      <footer className="footer">
        <p>Global Digital Identity Blockchain v1.0.0</p>
        <p>Open Source • Decentralized • Privacy-First</p>
        <div className="footer-links">
          <a href="https://docs.gdib.org" target="_blank" rel="noopener noreferrer">Documentation</a>
          <a href="https://github.com/gdib" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://discord.gg/gdib" target="_blank" rel="noopener noreferrer">Discord</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
