import { expect } from "chai";
import { network } from "hardhat";

describe("VotingSystem", function () {
  async function deployVotingSystem() {
    const { ethers } = await network.connect();

    const [owner, voter1, voter2, voter3] = await ethers.getSigners();
    const VotingSystem = await ethers.getContractFactory("VotingSystem");
    const votingSystem = await VotingSystem.deploy();
    await votingSystem.waitForDeployment();

    return { votingSystem, owner, voter1, voter2, voter3 };
  }

  async function createElectionWithCandidates(votingSystem: any) {
    await votingSystem.createElectionWithCandidates(2, false);
  }

  async function createActiveElection(votingSystem: any) {
    await votingSystem.createElectionWithCandidates(2, true);
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

  it("should batch create election with candidates", async function () {
    const { votingSystem } = await deployVotingSystem();

    await votingSystem.createElectionWithCandidates(3, false);

    const election = await votingSystem.getElection(1);
    expect(election[2]).to.equal(3n);
    expect((await votingSystem.getCandidate(1, 3))[0]).to.equal(3n);
  });

  it("should batch add candidates to an existing election", async function () {
    const { votingSystem } = await deployVotingSystem();

    await votingSystem.createElection();
    await votingSystem.addCandidates(1, 3);

    const election = await votingSystem.getElection(1);
    expect(election[2]).to.equal(3n);
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
    ).to.be.revertedWithCustomError(votingSystem, "UserNotEligible");
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
    ).to.be.revertedWithCustomError(votingSystem, "AlreadyVoted");
  });

  it("should reject banned voter even when eligible", async function () {
    const { votingSystem, voter1 } = await deployVotingSystem();

    await createActiveElection(votingSystem);
    await votingSystem.setVoterStatus(voter1.address, true, true);

    await expect(
      votingSystem.connect(voter1).vote(1, 1, { value: await votingSystem.VOTE_FEE() })
    ).to.be.revertedWithCustomError(votingSystem, "UserBanned");
  });

  it("should reject voting when election is inactive", async function () {
    const { votingSystem, voter1 } = await deployVotingSystem();

    await createElectionWithCandidates(votingSystem);
    await votingSystem.setVoterEligible(voter1.address, true);

    await expect(
      votingSystem.connect(voter1).vote(1, 1, { value: await votingSystem.VOTE_FEE() })
    ).to.be.revertedWithCustomError(votingSystem, "ElectionAlreadyEnded");
  });

  it("should batch sync many voter statuses", async function () {
    const { votingSystem, voter1, voter2, voter3 } = await deployVotingSystem();

    await votingSystem.setManyVoterStatus(
      [voter1.address, voter2.address, voter3.address],
      [true, true, false],
      [false, true, false]
    );

    expect(await votingSystem.isEligible(voter1.address)).to.equal(true);
    expect(await votingSystem.isEligible(voter2.address)).to.equal(true);
    expect(await votingSystem.isEligible(voter3.address)).to.equal(false);
    expect(await votingSystem.isBanned(voter2.address)).to.equal(true);
  });

  it("should end election", async function () {
    const { votingSystem } = await deployVotingSystem();

    await createActiveElection(votingSystem);
    await votingSystem.endElection(1);

    const election = await votingSystem.getElection(1);
    expect(election[1]).to.equal(false);
  });
});
