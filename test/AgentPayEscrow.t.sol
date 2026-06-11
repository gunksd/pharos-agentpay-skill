// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../contracts/AgentPayEscrow.sol";

contract AgentPayEscrowTest is Test {
    AgentPayEscrow esc;
    address requester = address(0xA11CE);
    address worker = address(0xB0B);
    address stranger = address(0xBAD);

    function setUp() public {
        esc = new AgentPayEscrow();
        vm.deal(requester, 10 ether);
        vm.deal(worker, 1 ether);
        vm.deal(stranger, 1 ether);
    }

    function _post() internal returns (uint64 id) {
        vm.prank(requester);
        id = esc.postTask{value: 1 ether}("translate doc to EN", 1 days, 1 hours);
    }

    function test_happyPath() public {
        uint64 id = _post();
        assertEq(address(esc).balance, 1 ether);

        vm.prank(worker);
        esc.claimTask(id);

        vm.prank(worker);
        esc.submitResult(id, "ipfs://QmResult");

        uint256 before = worker.balance;
        vm.prank(requester);
        esc.approveAndPay(id);

        assertEq(worker.balance - before, 1 ether);
        assertEq(esc.trustScore(worker), 100);
        assertEq(esc.trustScore(requester), 100);
        AgentPayEscrow.Reputation memory r = esc.getReputation(worker);
        assertEq(r.tasksCompleted, 1);
    }

    function test_rejectReopens() public {
        uint64 id = _post();
        vm.prank(worker);
        esc.claimTask(id);
        vm.prank(worker);
        esc.submitResult(id, "bad work");

        vm.prank(requester);
        esc.rejectSubmission(id, "wrong language");

        AgentPayEscrow.Task memory t = esc.getTask(id);
        assertEq(uint8(t.status), uint8(AgentPayEscrow.Status.Open));
        assertEq(t.worker, address(0));
        AgentPayEscrow.Reputation memory r = esc.getReputation(worker);
        assertEq(r.disputes, 1);

        // another worker can pick it up
        vm.prank(stranger);
        esc.claimTask(id);
    }

    function test_forceSettleAfterReviewWindow() public {
        uint64 id = _post();
        vm.prank(worker);
        esc.claimTask(id);
        vm.prank(worker);
        esc.submitResult(id, "done");

        vm.prank(worker);
        vm.expectRevert(AgentPayEscrow.ReviewWindowOpen.selector);
        esc.forceSettle(id);

        vm.warp(block.timestamp + 1 hours + 1);
        uint256 before = worker.balance;
        vm.prank(worker);
        esc.forceSettle(id);
        assertEq(worker.balance - before, 1 ether);
    }

    function test_cancelRefunds() public {
        uint64 id = _post();

        vm.prank(requester);
        vm.expectRevert(AgentPayEscrow.DeadlineNotReached.selector);
        esc.cancelTask(id);

        vm.warp(block.timestamp + 1 days + 1);
        uint256 before = requester.balance;
        vm.prank(requester);
        esc.cancelTask(id);
        assertEq(requester.balance - before, 1 ether);
    }

    function test_accessControl() public {
        uint64 id = _post();

        vm.prank(requester);
        vm.expectRevert(AgentPayEscrow.SelfClaim.selector);
        esc.claimTask(id);

        vm.prank(worker);
        esc.claimTask(id);

        vm.prank(stranger);
        vm.expectRevert(AgentPayEscrow.NotWorker.selector);
        esc.submitResult(id, "hijack");

        vm.prank(worker);
        esc.submitResult(id, "ok");

        vm.prank(stranger);
        vm.expectRevert(AgentPayEscrow.NotRequester.selector);
        esc.approveAndPay(id);
    }

    function test_zeroBountyReverts() public {
        vm.prank(requester);
        vm.expectRevert(AgentPayEscrow.ZeroBounty.selector);
        esc.postTask("free work", 1 days, 1 hours);
    }
}
