import { expect } from "chai";
import { network } from "hardhat";

describe("VotingSystem", function () {
  async function deployVotingSystem() {
    const { ethers } = await network.connect();

    const [owner, voter1, voter2] = await ethers.getSigners();
    const VotingSystem = await ethers.getContractFactory("VotingSystem");
    const votingSystem = await VotingSystem.deploy();
    await votingSystem.waitForDeployment();

    return { votingSystem, owner, voter1, voter2 };
  }

  async function createElectionWithCandidates(votingSystem: any) {
    await votingSystem.createElection();
    await votingSystem.addCandidate(1);
    await votingSystem.addCandidate(1);
  }

  async function createActiveElection(votingSystem: any) {
    await createElectionWithCandidates(votingSystem);
    await votingSystem.startElection(1);
  }

  it("should create election", async function () {
    const { votingSystem } = await deployVotingSystem();

    await votingSystem.createElection();

    const election = await votingSystem.getElection(1);
    expect(election[0]).to.equal(1n);
    expect(election[1]).to.equal(false);
    expect(election[2]).to.equal(0n);
    expect(election[3]).to.equal(0n);
  });

  it("should add candidates", async function () {
    const { votingSystem } = await deployVotingSystem();

    await createElectionWithCandidates(votingSystem);

    const candidate1 = await votingSystem.getCandidate(1, 1);
    const candidate2 = await votingSystem.getCandidate(1, 2);

    expect(candidate1[0]).to.equal(1n);
    expect(candidate1[1]).to.equal(0n);
    expect(candidate2[0]).to.equal(2n);
    expect(candidate2[1]).to.equal(0n);
  });

  it("should start election", async function () {
    const { votingSystem } = await deployVotingSystem();

    await createActiveElection(votingSystem);

    const election = await votingSystem.getElection(1);
    expect(election[1]).to.equal(true);
  });

  it("should reject non-eligible voter", async function () {
    const { votingSystem, voter1 } = await deployVotingSystem();

    await createActiveElection(votingSystem);

    await expect(
      votingSystem.connect(voter1).vote(1, 1, { value: await votingSystem.VOTE_FEE() })
    ).to.be.revertedWith("User not eligible");
  });

  it("should allow one wallet to vote only once after eligibility is granted", async function () {
    const { votingSystem, voter1 } = await deployVotingSystem();

    await createActiveElection(votingSystem);
    await votingSystem.setVoterEligible(voter1.address, true);

    await votingSystem.connect(voter1).vote(1, 1, { value: await votingSystem.VOTE_FEE() });

    const candidate1 = await votingSystem.getCandidate(1, 1);
    expect(candidate1[1]).to.equal(1n);

    const voterStatus = await votingSystem.getVoterStatus(1, voter1.address);
    expect(voterStatus[0]).to.equal(true);
    expect(voterStatus[1]).to.equal(1n);

    await expect(
      votingSystem.connect(voter1).vote(1, 2, { value: await votingSystem.VOTE_FEE() })
    ).to.be.revertedWith("You already voted");
  });

  it("should reject banned voter even when eligible", async function () {
    const { votingSystem, voter1 } = await deployVotingSystem();

    await createActiveElection(votingSystem);
    await votingSystem.setVoterEligible(voter1.address, true);
    await votingSystem.setVoterBanned(voter1.address, true);

    await expect(
      votingSystem.connect(voter1).vote(1, 1, { value: await votingSystem.VOTE_FEE() })
    ).to.be.revertedWith("User banned");
  });

  it("should reject voting when election is inactive", async function () {
    const { votingSystem, voter1 } = await deployVotingSystem();

    await createElectionWithCandidates(votingSystem);
    await votingSystem.setVoterEligible(voter1.address, true);

    await expect(
      votingSystem.connect(voter1).vote(1, 1, { value: await votingSystem.VOTE_FEE() })
    ).to.be.revertedWith("Election is not active");
  });

  it("should end election", async function () {
    const { votingSystem } = await deployVotingSystem();

    await createActiveElection(votingSystem);
    await votingSystem.endElection(1);

    const election = await votingSystem.getElection(1);
    expect(election[1]).to.equal(false);
  });
});
