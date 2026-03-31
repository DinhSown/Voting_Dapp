import { BrowserProvider } from "ethers";

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask chưa được cài");
  }

  await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
}

export async function getCurrentWallet() {
  if (!window.ethereum) {
    return null;
  }

  const accounts = await window.ethereum.request({
    method: "eth_accounts",
  });

  if (!accounts || accounts.length === 0) {
    return null;
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
}