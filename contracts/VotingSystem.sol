// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VotingSystem {
    address public owner;
    uint256 public electionCount;
    uint256 public constant VOTE_FEE = 1 ether;

    error NotOwner();
    error InvalidOwner();
    error InvalidVoter();
    error InvalidElection();
    error InvalidBatchInput();
    error InvalidCandidateCount();
    error ElectionAlreadyStarted();
    error ElectionAlreadyActive();
    error ElectionAlreadyEnded();
    error NeedAtLeastTwoCandidates();
    error UserBanned();
    error UserNotEligible();
    error AlreadyVoted();
    error InvalidCandidate();
    error IncorrectVoteFee();
    error InvalidRecipient();
    error NoFeesAvailable();
    error WithdrawFailed();
    error ElectionStillActive();

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
    mapping(address => bool) public isBanned;
    mapping(address => bool) public isEligible;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event VoterBanUpdated(address indexed voter, bool banned);
    event VoterEligibilityUpdated(address indexed voter, bool eligible);
    event VoterStatusUpdated(address indexed voter, bool eligible, bool banned);
    event ElectionCreated(uint256 indexed electionId);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId);
    event ElectionStarted(uint256 indexed electionId);
    event ElectionEnded(uint256 indexed electionId);
    event Voted(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);
    event FeesWithdrawn(address indexed recipient, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier validElection(uint256 electionId) {
        if (!elections[electionId].exists) revert InvalidElection();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidOwner();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setVoterBanned(address voter, bool banned) external onlyOwner {
        if (voter == address(0)) revert InvalidVoter();
        isBanned[voter] = banned;
        emit VoterBanUpdated(voter, banned);
    }

    function setVoterEligible(address voter, bool eligible) external onlyOwner {
        if (voter == address(0)) revert InvalidVoter();
        isEligible[voter] = eligible;
        emit VoterEligibilityUpdated(voter, eligible);
    }

    function setVoterStatus(address voter, bool eligible, bool banned) public onlyOwner {
        if (voter == address(0)) revert InvalidVoter();
        isEligible[voter] = eligible;
        isBanned[voter] = banned;
        emit VoterStatusUpdated(voter, eligible, banned);
    }

    function setManyVoterStatus(
        address[] calldata voters,
        bool[] calldata eligibleList,
        bool[] calldata bannedList
    ) external onlyOwner {
        uint256 count = voters.length;
        if (count == 0 || count != eligibleList.length || count != bannedList.length) {
            revert InvalidBatchInput();
        }

        for (uint256 i = 0; i < count; ) {
            setVoterStatus(voters[i], eligibleList[i], bannedList[i]);
            unchecked {
                ++i;
            }
        }
    }

    function createElection() external onlyOwner {
        _createElection();
    }

    function createElectionWithCandidates(uint256 candidateCount, bool startImmediately) external onlyOwner {
        if (candidateCount < 2) revert InvalidCandidateCount();

        uint256 electionId = _createElection();
        _addCandidates(electionId, candidateCount);

        if (startImmediately) {
            elections[electionId].isActive = true;
            emit ElectionStarted(electionId);
        }
    }

    function addCandidate(uint256 electionId) external onlyOwner validElection(electionId) {
        _addCandidates(electionId, 1);
    }

    function addCandidates(uint256 electionId, uint256 count) external onlyOwner validElection(electionId) {
        _addCandidates(electionId, count);
    }

    function startElection(uint256 electionId) external onlyOwner validElection(electionId) {
        Election storage election = elections[electionId];
        if (election.isActive) revert ElectionAlreadyActive();
        if (election.candidateCount < 2) revert NeedAtLeastTwoCandidates();

        election.isActive = true;
        emit ElectionStarted(electionId);
    }

    function endElection(uint256 electionId) external onlyOwner validElection(electionId) {
        Election storage election = elections[electionId];
        if (!election.isActive) revert ElectionAlreadyEnded();

        election.isActive = false;
        emit ElectionEnded(electionId);
    }

    function vote(uint256 electionId, uint256 candidateId) external payable validElection(electionId) {
        Election storage election = elections[electionId];

        if (isBanned[msg.sender]) revert UserBanned();
        if (!isEligible[msg.sender]) revert UserNotEligible();
        if (!election.isActive) revert ElectionAlreadyEnded();
        if (hasVoted[electionId][msg.sender]) revert AlreadyVoted();
        if (candidateId == 0 || candidateId > election.candidateCount) revert InvalidCandidate();
        if (msg.value != VOTE_FEE) revert IncorrectVoteFee();

        hasVoted[electionId][msg.sender] = true;
        voterChoice[electionId][msg.sender] = candidateId;
        candidates[electionId][candidateId].voteCount++;
        election.totalVotes++;

        emit Voted(electionId, candidateId, msg.sender);
    }

    function withdrawFees(address payable recipient) external onlyOwner {
        if (recipient == address(0)) revert InvalidRecipient();
        uint256 amount = address(this).balance;
        if (amount == 0) revert NoFeesAvailable();

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert WithdrawFailed();

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
        if (candidateId == 0 || candidateId > elections[electionId].candidateCount) revert InvalidCandidate();
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

        for (uint256 i = 0; i < count; ) {
            Candidate memory candidate = candidates[electionId][i + 1];
            ids[i] = candidate.id;
            voteCounts[i] = candidate.voteCount;
            unchecked {
                ++i;
            }
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
        if (election.isActive) revert ElectionStillActive();

        uint256 maxVoteCount = 0;
        uint256 winnerCandidateId = 0;

        for (uint256 i = 1; i <= election.candidateCount; ) {
            uint256 voteCount = candidates[electionId][i].voteCount;
            if (voteCount > maxVoteCount) {
                maxVoteCount = voteCount;
                winnerCandidateId = i;
            }
            unchecked {
                ++i;
            }
        }

        if (winnerCandidateId == 0) {
            return (0, 0);
        }

        Candidate memory winner = candidates[electionId][winnerCandidateId];
        return (winner.id, winner.voteCount);
    }

    function _createElection() internal returns (uint256 electionId) {
        electionId = ++electionCount;
        elections[electionId] = Election({
            id: electionId,
            isActive: false,
            exists: true,
            candidateCount: 0,
            totalVotes: 0
        });

        emit ElectionCreated(electionId);
    }

    function _addCandidates(uint256 electionId, uint256 count) internal {
        if (count == 0) revert InvalidCandidateCount();

        Election storage election = elections[electionId];
        if (election.isActive) revert ElectionAlreadyStarted();

        uint256 nextCandidateId = election.candidateCount;
        for (uint256 i = 0; i < count; ) {
            uint256 candidateId = ++nextCandidateId;
            candidates[electionId][candidateId] = Candidate({
                id: candidateId,
                voteCount: 0
            });
            emit CandidateAdded(electionId, candidateId);
            unchecked {
                ++i;
            }
        }

        election.candidateCount = nextCandidateId;
    }
}
