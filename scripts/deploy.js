const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Global Identity Registry...");

  // Deploy GlobalIdentityRegistry
  const GlobalIdentityRegistry = await ethers.getContractFactory("GlobalIdentityRegistry");
  const identityRegistry = await GlobalIdentityRegistry.deploy();
  await identityRegistry.waitForDeployment();
  const identityAddress = await identityRegistry.getAddress();
  console.log("GlobalIdentityRegistry deployed to:", identityAddress);

  // Deploy PlatformVerificationRegistry
  const PlatformVerificationRegistry = await ethers.getContractFactory("PlatformVerificationRegistry");
  const verificationRegistry = await PlatformVerificationRegistry.deploy();
  await verificationRegistry.waitForDeployment();
  const verificationAddress = await verificationRegistry.getAddress();
  console.log("PlatformVerificationRegistry deployed to:", verificationAddress);

  // Save addresses to .env
  const fs = require("fs");
  const envPath = ".env";
  let envContent = fs.readFileSync(envPath, "utf8");
  envContent += `\nCONTRACT_ADDRESS=${identityAddress}\nVERIFICATION_CONTRACT_ADDRESS=${verificationAddress}\n`;
  fs.writeFileSync(envPath, envContent);

  console.log("Deployment complete!");
  console.log("Identity Registry:", identityAddress);
  console.log("Verification Registry:", verificationAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });