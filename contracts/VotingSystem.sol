// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VotingSystem {
    address public owner;
    uint256 public electionCount;
    uint256 public constant VOTE_FEE = 1 ether;

    struct Election {
        uint256 id;
        bool isActive;
        bool exists;
        uint256 candidateCount;
        uint256 totalVotes;
    }

    struct Candidate {
        uint256 id;
        uint256 voteCount;
    }

    mapping(uint256 => Election) public elections;
    mapping(uint256 => mapping(uint256 => Candidate)) public candidates;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) public voterChoice;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ElectionCreated(uint256 indexed electionId);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId);
    event ElectionStarted(uint256 indexed electionId);
    event ElectionEnded(uint256 indexed electionId);
    event Voted(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);
    event FeesWithdrawn(address indexed recipient, uint256 amount);

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

    function createElection() external onlyOwner {
        electionCount++;
        elections[electionCount] = Election({
            id: electionCount,
            isActive: false,
            exists: true,
            candidateCount: 0,
            totalVotes: 0
        });

        emit ElectionCreated(electionCount);
    }

    function addCandidate(uint256 electionId) external onlyOwner validElection(electionId) {
        Election storage election = elections[electionId];
        require(!election.isActive, "Election already started");

        election.candidateCount++;
        candidates[electionId][election.candidateCount] = Candidate({
            id: election.candidateCount,
            voteCount: 0
        });

        emit CandidateAdded(electionId, election.candidateCount);
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

    function vote(uint256 electionId, uint256 candidateId) external payable validElection(electionId) {
        Election storage election = elections[electionId];

        require(election.isActive, "Election is not active");
        require(!hasVoted[electionId][msg.sender], "You already voted");
        require(candidateId > 0 && candidateId <= election.candidateCount, "Invalid candidate");
        require(msg.value == VOTE_FEE, "Incorrect vote fee");

        hasVoted[electionId][msg.sender] = true;
        voterChoice[electionId][msg.sender] = candidateId;
        candidates[electionId][candidateId].voteCount++;
        election.totalVotes++;

        emit Voted(electionId, candidateId, msg.sender);
    }

    function withdrawFees(address payable recipient) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        uint256 amount = address(this).balance;
        require(amount > 0, "No fees available");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Withdraw failed");

        emit FeesWithdrawn(recipient, amount);
    }

    function getElection(uint256 electionId)
        external
        view
        validElection(electionId)
        returns (uint256 id, bool isActive, uint256 candidateCount, uint256 totalVotes)
    {
        Election memory election = elections[electionId];
        return (election.id, election.isActive, election.candidateCount, election.totalVotes);
    }

    function getCandidate(uint256 electionId, uint256 candidateId)
        external
        view
        validElection(electionId)
        returns (uint256 id, uint256 voteCount)
    {
        require(candidateId > 0 && candidateId <= elections[electionId].candidateCount, "Invalid candidate");
        Candidate memory candidate = candidates[electionId][candidateId];
        return (candidate.id, candidate.voteCount);
    }

    function getCandidates(uint256 electionId)
        external
        view
        validElection(electionId)
        returns (uint256[] memory ids, uint256[] memory voteCounts)
    {
        uint256 count = elections[electionId].candidateCount;
        ids = new uint256[](count);
        voteCounts = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            Candidate memory candidate = candidates[electionId][i + 1];
            ids[i] = candidate.id;
            voteCounts[i] = candidate.voteCount;
        }
    }

    function getVoterStatus(uint256 electionId, address user)
        external
        view
        validElection(electionId)
        returns (bool votedAlready, uint256 selectedCandidateId)
    {
        return (hasVoted[electionId][user], voterChoice[electionId][user]);
    }

    function hasUserVoted(uint256 electionId, address user) external view validElection(electionId) returns (bool) {
        return hasVoted[electionId][user];
    }

    function getWinner(uint256 electionId) external view validElection(electionId) returns (uint256 winnerId, uint256 maxVotes) {
        Election memory election = elections[electionId];
        require(!election.isActive, "Election is still active");

        uint256 maxVoteCount = 0;
        uint256 winnerCandidateId = 0;

        for (uint256 i = 1; i <= election.candidateCount; i++) {
            uint256 voteCount = candidates[electionId][i].voteCount;
            if (voteCount > maxVoteCount) {
                maxVoteCount = voteCount;
                winnerCandidateId = i;
            }
        }

        if (winnerCandidateId == 0) {
            return (0, 0);
        }

        Candidate memory winner = candidates[electionId][winnerCandidateId];
        return (winner.id, winner.voteCount);
    }
}
