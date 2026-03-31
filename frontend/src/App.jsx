import { useEffect, useState } from "react";
import { connectWallet, getCurrentWallet } from "./services/wallet";
import { getContract, getReadOnlyContract } from "./services/contract";

function App() {
  const [account, setAccount] = useState("");
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadData(currentAccount = "") {
    try {
      const contract = await getReadOnlyContract();

      const electionData = await contract.getElection(1);
      const candidateCount = Number(electionData[3]);

      const candidateList = [];
      for (let i = 1; i <= candidateCount; i++) {
        const candidate = await contract.getCandidate(1, i);
        candidateList.push({
          id: Number(candidate[0]),
          name: candidate[1],
          voteCount: Number(candidate[2]),
        });
      }

      setElection({
        id: Number(electionData[0]),
        title: electionData[1],
        isActive: electionData[2],
        candidateCount: Number(electionData[3]),
        totalVotes: Number(electionData[4]),
      });

      setCandidates(candidateList);

      if (currentAccount) {
        const voted = await contract.hasUserVoted(1, currentAccount);
        setHasVoted(voted);
      } else {
        setHasVoted(false);
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function handleConnect() {
    try {
      const wallet = await connectWallet();
      setAccount(wallet.address);
      await loadData(wallet.address);
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleVote(candidateId) {
    try {
      setLoading(true);
      const contract = await getContract();
      const tx = await contract.vote(1, candidateId);
      await tx.wait();

      await loadData(account);
      alert("Bỏ phiếu thành công");
    } catch (error) {
      console.error(error);
      alert(error.reason || error.message || "Vote thất bại");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      const wallet = await getCurrentWallet();
      if (wallet) {
        setAccount(wallet.address);
        await loadData(wallet.address);
      } else {
        await loadData();
      }
    }

    init();
  }, []);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <h1>Voting DApp</h1>

      <button onClick={handleConnect} style={{ marginBottom: 20 }}>
        {account ? `Connected: ${account}` : "Connect MetaMask"}
      </button>

      {election && (
        <div style={{ marginBottom: 24 }}>
          <h2>{election.title}</h2>
          <p>Trạng thái: {election.isActive ? "Đang mở" : "Đã đóng"}</p>
          <p>Tổng số phiếu: {election.totalVotes}</p>
          <p>
            Bạn đã bỏ phiếu: {hasVoted ? "Rồi" : "Chưa"}
          </p>
        </div>
      )}

      <div>
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            style={{
              border: "1px solid #ccc",
              padding: 16,
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <h3>{candidate.name}</h3>
            <p>Số phiếu: {candidate.voteCount}</p>

            <button
              onClick={() => handleVote(candidate.id)}
              disabled={!account || hasVoted || !election?.isActive || loading}
            >
              {loading ? "Đang xử lý..." : `Vote cho ${candidate.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;