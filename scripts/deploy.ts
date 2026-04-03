import { network } from "hardhat";

// Hardhat v3 uses `await network.connect()` for ethers access
const { ethers } = await network.connect();

console.log("Deploying VotingSystem contract...");

const [deployer] = await ethers.getSigners();
console.log("Deploying with account:", deployer.address);

const balance = await ethers.provider.getBalance(deployer.address);
console.log("Account balance:", ethers.formatEther(balance), "ETH");

const VotingSystem = await ethers.getContractFactory("VotingSystem");
const votingSystem = await VotingSystem.deploy();
await votingSystem.waitForDeployment();

const address = await votingSystem.getAddress();
console.log("\n✅ VotingSystem deployed to:", address);

// ── Seed demo data ──────────────────────────────────────────────────────────
console.log("\nSeeding demo election...");

const tx1 = await votingSystem.createElection("WeChoice 2024");
await tx1.wait();
console.log("Created election: WeChoice 2024");

const candidates = [
  "Nhân vật truyền cảm hứng",
  "Dự án vì cộng đồng",
  "GenZ tiêu biểu",
  "Nghệ sĩ đột phá",
  "Sản phẩm âm nhạc",
  "Đơn vị đổi mới",
];

for (const name of candidates) {
  const tx = await votingSystem.addCandidate(1, name);
  await tx.wait();
  console.log("  Added candidate:", name);
}

const txStart = await votingSystem.startElection(1);
await txStart.wait();
console.log("Election started!");

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("📋 CONTRACT ADDRESS:", address);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("\nUpdate these files with the address above:");
console.log("  frontend/.env  → VITE_CONTRACT_ADDRESS=" + address);
console.log("  backend/.env   → CONTRACT_ADDRESS=" + address);
