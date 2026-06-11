// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentPay Escrow
 * @notice Trust-minimized task escrow + on-chain reputation for AI agents on Pharos.
 *
 * Lifecycle:
 *   1. Requester agent posts a task with a PHRS bounty locked in escrow.
 *   2. A worker agent claims the task.
 *   3. The worker submits a result reference (e.g. IPFS CID / URL / hash).
 *   4. The requester approves -> bounty released to worker, reputation +1 for both.
 *      The requester can also reject  -> task reopens for other workers.
 *   5. If the requester goes silent, the worker can force-settle after the
 *      review window. If nobody claims before the deadline, the requester
 *      can cancel and get refunded.
 */
contract AgentPayEscrow {
    enum Status {
        Open,       // posted, waiting for a worker
        Claimed,    // a worker is on it
        Submitted,  // result submitted, waiting for review
        Completed,  // paid out
        Cancelled   // refunded
    }

    struct Task {
        uint64 id;
        address requester;
        address worker;
        uint256 bounty;
        uint64 claimDeadline;   // until when the task can be claimed
        uint64 reviewWindow;    // seconds the requester has to review a submission
        uint64 submittedAt;
        Status status;
        string spec;            // task description / spec reference
        string result;          // worker's result reference
    }

    struct Reputation {
        uint32 tasksPosted;
        uint32 tasksCompleted;  // as worker
        uint32 tasksPaid;       // as requester
        uint32 disputes;        // rejections received as worker
    }

    uint64 public nextTaskId = 1;
    mapping(uint64 => Task) public tasks;
    mapping(address => Reputation) public reputation;

    event TaskPosted(uint64 indexed id, address indexed requester, uint256 bounty, string spec);
    event TaskClaimed(uint64 indexed id, address indexed worker);
    event ResultSubmitted(uint64 indexed id, address indexed worker, string result);
    event TaskCompleted(uint64 indexed id, address indexed worker, uint256 bounty);
    event SubmissionRejected(uint64 indexed id, address indexed worker, string reason);
    event TaskCancelled(uint64 indexed id, uint256 refund);

    error WrongStatus();
    error NotRequester();
    error NotWorker();
    error ZeroBounty();
    error DeadlinePassed();
    error DeadlineNotReached();
    error ReviewWindowOpen();
    error SelfClaim();

    /// @notice Post a task and lock the bounty (sent as msg.value).
    /// @param spec        Human/agent-readable task spec or a reference to it.
    /// @param claimTtl    Seconds the task stays claimable.
    /// @param reviewWindow Seconds the requester gets to review a submission
    ///                     before the worker may force-settle.
    function postTask(string calldata spec, uint64 claimTtl, uint64 reviewWindow)
        external
        payable
        returns (uint64 id)
    {
        if (msg.value == 0) revert ZeroBounty();
        id = nextTaskId++;
        Task storage t = tasks[id];
        t.id = id;
        t.requester = msg.sender;
        t.bounty = msg.value;
        t.claimDeadline = uint64(block.timestamp) + claimTtl;
        t.reviewWindow = reviewWindow == 0 ? 1 days : reviewWindow;
        t.status = Status.Open;
        t.spec = spec;

        reputation[msg.sender].tasksPosted++;
        emit TaskPosted(id, msg.sender, msg.value, spec);
    }

    /// @notice Claim an open task as a worker agent.
    function claimTask(uint64 id) external {
        Task storage t = tasks[id];
        if (t.status != Status.Open) revert WrongStatus();
        if (block.timestamp > t.claimDeadline) revert DeadlinePassed();
        if (msg.sender == t.requester) revert SelfClaim();
        t.worker = msg.sender;
        t.status = Status.Claimed;
        emit TaskClaimed(id, msg.sender);
    }

    /// @notice Submit the task result (reference string: hash, CID, URL...).
    function submitResult(uint64 id, string calldata result) external {
        Task storage t = tasks[id];
        if (t.status != Status.Claimed) revert WrongStatus();
        if (msg.sender != t.worker) revert NotWorker();
        t.result = result;
        t.submittedAt = uint64(block.timestamp);
        t.status = Status.Submitted;
        emit ResultSubmitted(id, msg.sender, result);
    }

    /// @notice Requester approves the submission and releases the bounty.
    function approveAndPay(uint64 id) external {
        Task storage t = tasks[id];
        if (t.status != Status.Submitted) revert WrongStatus();
        if (msg.sender != t.requester) revert NotRequester();
        _settle(t);
    }

    /// @notice Requester rejects a submission; task reopens for other workers.
    function rejectSubmission(uint64 id, string calldata reason) external {
        Task storage t = tasks[id];
        if (t.status != Status.Submitted) revert WrongStatus();
        if (msg.sender != t.requester) revert NotRequester();

        reputation[t.worker].disputes++;
        emit SubmissionRejected(id, t.worker, reason);

        t.worker = address(0);
        t.result = "";
        t.submittedAt = 0;
        t.status = Status.Open;
    }

    /// @notice Worker force-settles if the requester missed the review window.
    function forceSettle(uint64 id) external {
        Task storage t = tasks[id];
        if (t.status != Status.Submitted) revert WrongStatus();
        if (msg.sender != t.worker) revert NotWorker();
        if (block.timestamp < uint256(t.submittedAt) + t.reviewWindow) revert ReviewWindowOpen();
        _settle(t);
    }

    /// @notice Requester cancels an unclaimed task after the claim deadline.
    function cancelTask(uint64 id) external {
        Task storage t = tasks[id];
        if (t.status != Status.Open) revert WrongStatus();
        if (msg.sender != t.requester) revert NotRequester();
        if (block.timestamp <= t.claimDeadline) revert DeadlineNotReached();
        t.status = Status.Cancelled;
        uint256 refund = t.bounty;
        t.bounty = 0;
        emit TaskCancelled(id, refund);
        (bool ok, ) = t.requester.call{value: refund}("");
        require(ok, "refund failed");
    }

    function _settle(Task storage t) internal {
        t.status = Status.Completed;
        uint256 amount = t.bounty;
        t.bounty = 0;

        reputation[t.worker].tasksCompleted++;
        reputation[t.requester].tasksPaid++;

        emit TaskCompleted(t.id, t.worker, amount);
        (bool ok, ) = t.worker.call{value: amount}("");
        require(ok, "payout failed");
    }

    // ---- Views ----

    function getTask(uint64 id) external view returns (Task memory) {
        return tasks[id];
    }

    function getReputation(address agent) external view returns (Reputation memory) {
        return reputation[agent];
    }

    /// @notice Simple 0-100 trust score derived from on-chain history.
    function trustScore(address agent) external view returns (uint256) {
        Reputation memory r = reputation[agent];
        uint256 done = uint256(r.tasksCompleted) + uint256(r.tasksPaid);
        if (done == 0) return 0;
        uint256 total = done + uint256(r.disputes);
        return (done * 100) / total;
    }
}
