import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const VotingSystem = await ethers.getContractFactory("VotingSystem");
  const votingSystem = await VotingSystem.deploy();

  await votingSystem.waitForDeployment();

  const address = await votingSystem.getAddress();

  console.log("VotingSystem deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});