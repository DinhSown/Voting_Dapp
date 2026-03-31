import { BrowserProvider, Contract } from "ethers";
import votingArtifact from "../abi/VotingSystem.json";

const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export async function getContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask chưa được cài");
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  return new Contract(CONTRACT_ADDRESS, votingArtifact.abi, signer);
}

export async function getReadOnlyContract() {
  if (!window.ethereum) {
    throw new Error("MetaMask chưa được cài");
  }

  const provider = new BrowserProvider(window.ethereum);

  return new Contract(CONTRACT_ADDRESS, votingArtifact.abi, provider);
}