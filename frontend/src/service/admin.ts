import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export type Election = {
  id: number;
  title: string;
  isActive: boolean;
  candidateCount: number;
  totalVotes: number;
  candidates?: Candidate[];
};

export type Candidate = {
  id: number;
  name: string;
  voteCount: number;
};

// Create a new election
export const createElection = async (title: string) => {
  const response = await axios.post(`${BACKEND_URL}/api/admin/election/create`, {
    title,
  });
  return response.data;
};

// Add a candidate to an election
export const addCandidate = async (electionId: number, name: string) => {
  const response = await axios.post(
    `${BACKEND_URL}/api/admin/election/${electionId}/candidate`,
    { name }
  );
  return response.data;
};

// Start an election
export const startElection = async (electionId: number) => {
  const response = await axios.post(
    `${BACKEND_URL}/api/admin/election/${electionId}/start`
  );
  return response.data;
};

// End an election
export const endElection = async (electionId: number) => {
  const response = await axios.post(
    `${BACKEND_URL}/api/admin/election/${electionId}/end`
  );
  return response.data;
};

// Whitelist wallets for an election
export const whitelistWallets = async (
  electionId: number,
  wallets: string[]
) => {
  const response = await axios.post(
    `${BACKEND_URL}/api/admin/election/${electionId}/whitelist`,
    { wallets }
  );
  return response.data;
};

// Remove whitelist for a wallet
export const removeWhitelistedWallet = async (
  electionId: number,
  wallet: string
) => {
  const response = await axios.post(
    `${BACKEND_URL}/api/admin/election/${electionId}/whitelist/remove`,
    { wallet }
  );
  return response.data;
};

// Get election details
export const getElectionDetails = async (electionId: number) => {
  const response = await axios.get(
    `${BACKEND_URL}/api/admin/election/${electionId}`
  );
  return response.data as Election;
};

// Get all elections
export const getAllElections = async () => {
  const response = await axios.get(`${BACKEND_URL}/api/admin/elections`);
  return response.data;
};
