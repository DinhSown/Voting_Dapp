// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VotingSystem {
    address public owner;
    uint256 public electionCount;

    struct Election {
        uint256 id;
        string title;
        bool isActive;
        bool exists;
        uint256 candidateCount;
        uint256 totalVotes;
    }

    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    mapping(uint256 => Election) public elections;
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => bool)) public isWhitelisted;
    mapping(uint256 => mapping(address => uint256)) public voterChoice;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ElectionCreated(uint256 indexed electionId, string title);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event ElectionStarted(uint256 indexed electionId);
    event ElectionEnded(uint256 indexed electionId);
    event WalletWhitelisted(uint256 indexed electionId, address indexed wallet);
    event WalletRemovedFromWhitelist(uint256 indexed electionId, address indexed wallet);
    event Voted(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier validElection(uint256 electionId) {
        require(elections[electionId].exists, "Invalid election");
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function createElection(string memory title) external onlyOwner {
        require(bytes(title).length > 0, "Title is required");

        electionCount++;
        elections[electionCount] = Election({
            id: electionCount,
            title: title,
            isActive: false,
            exists: true,
            candidateCount: 0,
            totalVotes: 0
        });

        emit ElectionCreated(electionCount, title);
    }

    function addCandidate(uint256 electionId, string memory name) external onlyOwner validElection(electionId) {
        require(bytes(name).length > 0, "Candidate name is required");

        Election storage election = elections[electionId];
        require(!election.isActive, "Election already started");

        election.candidateCount++;
        candidates[electionId][election.candidateCount] = Candidate({
            id: election.candidateCount,
            name: name,
            voteCount: 0
        });

        emit CandidateAdded(electionId, election.candidateCount, name);
    }

    function startElection(uint256 electionId) external onlyOwner validElection(electionId) {
        Election storage election = elections[electionId];
        require(!election.isActive, "Election already active");
        require(election.candidateCount >= 2, "Need at least 2 candidates");

        election.isActive = true;
        emit ElectionStarted(electionId);
    }

    function endElection(uint256 electionId) external onlyOwner validElection(electionId) {
        Election storage election = elections[electionId];
        require(election.isActive, "Election already ended");

        election.isActive = false;
        emit ElectionEnded(electionId);
    }

    function whitelistEligibleWallet(uint256 electionId, address walletAddr) public onlyOwner validElection(electionId) {
        require(walletAddr != address(0), "Invalid wallet");
        isWhitelisted[electionId][walletAddr] = true;
        emit WalletWhitelisted(electionId, walletAddr);
    }

    function whitelistEligibleWallets(uint256 electionId, address[] calldata wallets) external onlyOwner validElection(electionId) {
        require(wallets.length > 0, "No wallets provided");
        for (uint256 i = 0; i < wallets.length; i++) {
            whitelistEligibleWallet(electionId, wallets[i]);
        }
    }

    function removeWhitelistedWallet(uint256 electionId, address walletAddr) external onlyOwner validElection(electionId) {
        require(walletAddr != address(0), "Invalid wallet");
        isWhitelisted[electionId][walletAddr] = false;
        emit WalletRemovedFromWhitelist(electionId, walletAddr);
    }

    function vote(uint256 electionId, uint256 candidateId) external validElection(electionId) {
        Election storage election = elections[electionId];

        require(election.isActive, "Election is not active");
        require(isWhitelisted[electionId][msg.sender], "Not authorized to vote in this election");
        require(!hasVoted[electionId][msg.sender], "You already voted");
        require(candidateId > 0 && candidateId <= election.candidateCount, "Invalid candidate");

        hasVoted[electionId][msg.sender] = true;
        voterChoice[electionId][msg.sender] = candidateId;
        candidates[electionId][candidateId].voteCount++;
        election.totalVotes++;

        emit Voted(electionId, candidateId, msg.sender);
    }

    function getElection(uint256 electionId)
        external
        view
        validElection(electionId)
        returns (uint256 id, string memory title, bool isActive, uint256 candidateCount, uint256 totalVotes)
    {
        Election memory election = elections[electionId];
        return (election.id, election.title, election.isActive, election.candidateCount, election.totalVotes);
    }

    function getCandidate(uint256 electionId, uint256 candidateId)
        external
        view
        validElection(electionId)
        returns (uint256 id, string memory name, uint256 voteCount)
    {
        require(candidateId > 0 && candidateId <= elections[electionId].candidateCount, "Invalid candidate");
        Candidate memory candidate = candidates[electionId][candidateId];
        return (candidate.id, candidate.name, candidate.voteCount);
    }

    function getCandidates(uint256 electionId)
        external
        view
        validElection(electionId)
        returns (uint256[] memory ids, string[] memory names, uint256[] memory voteCounts)
    {
        uint256 count = elections[electionId].candidateCount;
        ids = new uint256[](count);
        names = new string[](count);
        voteCounts = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            Candidate memory candidate = candidates[electionId][i + 1];
            ids[i] = candidate.id;
            names[i] = candidate.name;
            voteCounts[i] = candidate.voteCount;
        }
    }

    function getVoterStatus(uint256 electionId, address user)
        external
        view
        validElection(electionId)
        returns (bool whitelisted, bool votedAlready, uint256 selectedCandidateId)
    {
        return (isWhitelisted[electionId][user], hasVoted[electionId][user], voterChoice[electionId][user]);
    }

    function hasUserVoted(uint256 electionId, address user) external view validElection(electionId) returns (bool) {
        return hasVoted[electionId][user];
    }
}
