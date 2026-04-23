import { network } from "hardhat";

const { ethers } = await network.connect();

console.log("Deploying VotingSystem contract...");

const [deployer] = await ethers.getSigners();
console.log("Deploying with account:", deployer.address);

const balance = await ethers.provider.getBalance(deployer.address);
console.log("Account balance:", ethers.formatEther(balance), "TEST");

const VotingSystem = await ethers.getContractFactory("VotingSystem");
const votingSystem = await VotingSystem.deploy();
await votingSystem.waitForDeployment();

const address = await votingSystem.getAddress();
const owner = await votingSystem.owner();

console.log("");
console.log("VotingSystem deployed to:", address);
console.log("Owner:", owner);
console.log("");
console.log("Update these files:");
console.log(`  backend/.env  -> CONTRACT_ADDRESS=${address}`);
console.log(`  frontend/.env -> VITE_CONTRACT_ADDRESS=${address}`);
