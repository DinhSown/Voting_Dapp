// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract VotingSystem {
    address public owner;
    uint256 public electionCount;

    constructor() {
        owner = msg.sender;
    }

    struct Election {
        uint256 id;
        string title;
        bool isActive;
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

    event ElectionCreated(uint256 indexed electionId, string title);
    event CandidateAdded(uint256 indexed electionId, uint256 indexed candidateId, string name);
    event ElectionStarted(uint256 indexed electionId);
    event ElectionEnded(uint256 indexed electionId);
    event Voted(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function createElection(string memory _title) external onlyOwner {
        electionCount++;

        elections[electionCount] = Election({
            id: electionCount,
            title: _title,
            isActive: false,
            candidateCount: 0,
            totalVotes: 0
        });

        emit ElectionCreated(electionCount, _title);
    }

    function addCandidate(uint256 _electionId, string memory _name) external onlyOwner {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");

        Election storage election = elections[_electionId];
        require(!election.isActive, "Election already started");

        election.candidateCount++;

        candidates[_electionId][election.candidateCount] = Candidate({
            id: election.candidateCount,
            name: _name,
            voteCount: 0
        });

        emit CandidateAdded(_electionId, election.candidateCount, _name);
    }

    function startElection(uint256 _electionId) external onlyOwner {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");
        require(elections[_electionId].candidateCount >= 2, "Need at least 2 candidates");

        elections[_electionId].isActive = true;
        emit ElectionStarted(_electionId);
    }

    function endElection(uint256 _electionId) external onlyOwner {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");

        elections[_electionId].isActive = false;
        emit ElectionEnded(_electionId);
    }

    function vote(uint256 _electionId, uint256 _candidateId) external {
        require(_electionId > 0 && _electionId <= electionCount, "Invalid election");

        Election storage election = elections[_electionId];

        require(election.isActive, "Election is not active");
        require(!hasVoted[_electionId][msg.sender], "You already voted");
        require(_candidateId > 0 && _candidateId <= election.candidateCount, "Invalid candidate");

        hasVoted[_electionId][msg.sender] = true;
        candidates[_electionId][_candidateId].voteCount++;
        election.totalVotes++;

        emit Voted(_electionId, _candidateId, msg.sender);
    }

    function getElection(uint256 _electionId)
        external
        view
        returns (
            uint256 id,
            string memory title,
            bool isActive,
            uint256 candidateCount,
            uint256 totalVotes
        )
    {
        Election memory e = elections[_electionId];
        return (e.id, e.title, e.isActive, e.candidateCount, e.totalVotes);
    }

    function getCandidate(uint256 _electionId, uint256 _candidateId)
        external
        view
        returns (
            uint256 id,
            string memory name,
            uint256 voteCount
        )
    {
        Candidate memory c = candidates[_electionId][_candidateId];
        return (c.id, c.name, c.voteCount);
    }

    function hasUserVoted(uint256 _electionId, address _user) external view returns (bool) {
        return hasVoted[_electionId][_user];
    }
}