import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const voting = await ethers.getContractAt("VotingSystem", contractAddress);

  let tx;

  tx = await voting.createElection("Class Leader");
  await tx.wait();

  tx = await voting.addCandidate(1, "Alice");
  await tx.wait();

  tx = await voting.addCandidate(1, "Bob");
  await tx.wait();

  tx = await voting.startElection(1);
  await tx.wait();

  tx = await voting.vote(1, 1);
  await tx.wait();

  const candidate = await voting.getCandidate(1, 1);

  console.log("Votes for Alice:", candidate[2].toString());
}

main();