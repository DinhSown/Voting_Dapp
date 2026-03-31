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

  it("should create election", async function () {
    const { votingSystem } = await deployVotingSystem();

    await votingSystem.createElection("President Election");

    const election = await votingSystem.getElection(1);
    expect(election[0]).to.equal(1n);
    expect(election[1]).to.equal("President Election");
    expect(election[2]).to.equal(false);
  });

  it("should add candidates", async function () {
    const { votingSystem } = await deployVotingSystem();

    await votingSystem.createElection("President Election");
    await votingSystem.addCandidate(1, "Alice");
    await votingSystem.addCandidate(1, "Bob");

    const candidate1 = await votingSystem.getCandidate(1, 1);
    const candidate2 = await votingSystem.getCandidate(1, 2);

    expect(candidate1[1]).to.equal("Alice");
    expect(candidate2[1]).to.equal("Bob");
  });

  it("should start election", async function () {
    const { votingSystem } = await deployVotingSystem();

    await votingSystem.createElection("President Election");
    await votingSystem.addCandidate(1, "Alice");
    await votingSystem.addCandidate(1, "Bob");
    await votingSystem.startElection(1);

    const election = await votingSystem.getElection(1);
    expect(election[2]).to.equal(true);
  });

  it("should allow one wallet to vote only once", async function () {
    const { votingSystem, voter1 } = await deployVotingSystem();

    await votingSystem.createElection("President Election");
    await votingSystem.addCandidate(1, "Alice");
    await votingSystem.addCandidate(1, "Bob");
    await votingSystem.startElection(1);

    await votingSystem.connect(voter1).vote(1, 1);

    const candidate1 = await votingSystem.getCandidate(1, 1);
    expect(candidate1[2]).to.equal(1n);

    await expect(
      votingSystem.connect(voter1).vote(1, 2)
    ).to.be.revertedWith("You already voted");
  });

  it("should reject voting when election is inactive", async function () {
    const { votingSystem, voter1 } = await deployVotingSystem();

    await votingSystem.createElection("President Election");
    await votingSystem.addCandidate(1, "Alice");
    await votingSystem.addCandidate(1, "Bob");

    await expect(
      votingSystem.connect(voter1).vote(1, 1)
    ).to.be.revertedWith("Election is not active");
  });

  it("should end election", async function () {
    const { votingSystem } = await deployVotingSystem();

    await votingSystem.createElection("President Election");
    await votingSystem.addCandidate(1, "Alice");
    await votingSystem.addCandidate(1, "Bob");
    await votingSystem.startElection(1);
    await votingSystem.endElection(1);

    const election = await votingSystem.getElection(1);
    expect(election[2]).to.equal(false);
  });
});