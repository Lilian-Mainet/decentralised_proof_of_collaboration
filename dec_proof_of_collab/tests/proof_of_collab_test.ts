import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure that contract initialization sets deployer as admin",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify deployer is admin
        let adminCheck = chain.callReadOnlyFn('proof_of_collab', 'is-project-admin', [
            types.principal(deployer.address)
        ], deployer.address);
        assertEquals(adminCheck.result, types.bool(true));
    },
});

Clarinet.test({
    name: "Ensure that only contract owner can add project admins",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        let wallet2 = accounts.get('wallet_2')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Owner can add admin
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'add-project-admin', [
                types.principal(wallet1.address)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify wallet1 is now admin
        let adminCheck = chain.callReadOnlyFn('proof_of_collab', 'is-project-admin', [
            types.principal(wallet1.address)
        ], deployer.address);
        assertEquals(adminCheck.result, types.bool(true));
        
        // Non-owner cannot add admin
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'add-project-admin', [
                types.principal(wallet2.address)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(100)); // err-owner-only
    },
});

Clarinet.test({
    name: "Ensure that contribution submission works correctly for new contributor",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Submit contribution
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Fixed critical bug in authentication module")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.uint(1));
        
        // Verify contribution details
        let contributionCall = chain.callReadOnlyFn('proof_of_collab', 'get-contribution', [
            types.uint(1)
        ], wallet1.address);
        let contribution = contributionCall.result.expectSome().expectTuple();
        assertEquals(contribution['contributor'], wallet1.address);
        assertEquals(contribution['details'], types.utf8("Fixed critical bug in authentication module"));
        assertEquals(contribution['score'], types.uint(0));
        assertEquals(contribution['verified'], types.bool(false));
        
        // Verify contributor profile created
        let profileCall = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-profile', [
            types.principal(wallet1.address)
        ], wallet1.address);
        let profile = profileCall.result.expectSome().expectTuple();
        assertEquals(profile['total-score'], types.uint(0));
        assertEquals(profile['contribution-count'], types.uint(1));
        assertEquals(profile['tier'], types.uint(1)); // BRONZE
        assertEquals(profile['is-active'], types.bool(true));
    },
});

Clarinet.test({
    name: "Ensure that contribution submission works correctly for existing contributor",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Submit first contribution
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("First contribution")
            ], wallet1.address)
        ]);
        
        // Submit second contribution
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Second contribution")
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.uint(2));
        
        // Verify updated contributor profile
        let profileCall = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-profile', [
            types.principal(wallet1.address)
        ], wallet1.address);
        let profile = profileCall.result.expectSome().expectTuple();
        assertEquals(profile['contribution-count'], types.uint(2));
        assertEquals(profile['is-active'], types.bool(true));
    },
});

Clarinet.test({
    name: "Ensure that only project admins can verify contributions",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        let wallet2 = accounts.get('wallet_2')!;
        
        // Initialize contract and add admin
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address),
            Tx.contractCall('proof_of_collab', 'add-project-admin', [
                types.principal(wallet1.address)
            ], deployer.address)
        ]);
        
        // Submit contribution
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Test contribution")
            ], wallet2.address)
        ]);
        
        // Admin can verify contribution
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(1),
                types.uint(50)
            ], wallet1.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify contribution is updated
        let contributionCall = chain.callReadOnlyFn('proof_of_collab', 'get-contribution', [
            types.uint(1)
        ], wallet1.address);
        let contribution = contributionCall.result.expectSome().expectTuple();
        assertEquals(contribution['score'], types.uint(50));
        assertEquals(contribution['verified'], types.bool(true));
        
        // Verify contributor profile is updated
        let profileCall = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-profile', [
            types.principal(wallet2.address)
        ], wallet1.address);
        let profile = profileCall.result.expectSome().expectTuple();
        assertEquals(profile['total-score'], types.uint(50));
    },
});

Clarinet.test({
    name: "Ensure that non-admins cannot verify contributions",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        let wallet2 = accounts.get('wallet_2')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Submit contribution
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Test contribution")
            ], wallet1.address)
        ]);
        
        // Non-admin tries to verify contribution
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(1),
                types.uint(50)
            ], wallet2.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(100)); // err-owner-only
    },
});

Clarinet.test({
    name: "Ensure that already verified contributions cannot be verified again",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Submit and verify contribution
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Test contribution")
            ], wallet1.address),
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(1),
                types.uint(50)
            ], deployer.address)
        ]);
        
        // Try to verify again
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(1),
                types.uint(75)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(102)); // err-already-verified
    },
});

Clarinet.test({
    name: "Ensure that verification with non-existent contribution fails",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Try to verify non-existent contribution
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(999),
                types.uint(50)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(101)); // err-not-found
    },
});

Clarinet.test({
    name: "Ensure that contributor tier updates work correctly for SILVER tier",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Submit contribution and verify with score to reach SILVER (100+ points)
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Major feature implementation")
            ], wallet1.address),
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(1),
                types.uint(120)
            ], deployer.address)
        ]);
        
        // Update tier
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'update-contributor-tier', [
                types.principal(wallet1.address)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify tier is SILVER (2)
        let tierCall = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-tier', [
            types.principal(wallet1.address)
        ], deployer.address);
        assertEquals(tierCall.result.expectOk(), types.uint(2)); // SILVER
    },
});

Clarinet.test({
    name: "Ensure that contributor tier updates work correctly for GOLD tier",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Submit contribution and verify with score to reach GOLD (250+ points)
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Critical system overhaul")
            ], wallet1.address),
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(1),
                types.uint(300)
            ], deployer.address)
        ]);
        
        // Update tier
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'update-contributor-tier', [
                types.principal(wallet1.address)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify tier is GOLD (3)
        let tierCall = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-tier', [
            types.principal(wallet1.address)
        ], deployer.address);
        assertEquals(tierCall.result.expectOk(), types.uint(3)); // GOLD
    },
});

Clarinet.test({
    name: "Ensure that contributor tier updates work correctly for PLATINUM tier",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Submit contribution and verify with score to reach PLATINUM (500+ points)
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Revolutionary architecture redesign")
            ], wallet1.address),
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(1),
                types.uint(600)
            ], deployer.address)
        ]);
        
        // Update tier
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'update-contributor-tier', [
                types.principal(wallet1.address)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectOk(), types.bool(true));
        
        // Verify tier is PLATINUM (4)
        let tierCall = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-tier', [
            types.principal(wallet1.address)
        ], deployer.address);
        assertEquals(tierCall.result.expectOk(), types.uint(4)); // PLATINUM
    },
});

Clarinet.test({
    name: "Ensure that tier update fails for non-existent contributor",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Try to update tier for non-existent contributor
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'update-contributor-tier', [
                types.principal(wallet1.address)
            ], deployer.address)
        ]);
        
        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result.expectErr(), types.uint(101)); // err-not-found
    },
});

Clarinet.test({
    name: "Ensure that multiple contributions accumulate scores correctly",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Submit multiple contributions
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("First contribution")
            ], wallet1.address),
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Second contribution")
            ], wallet1.address),
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Third contribution")
            ], wallet1.address)
        ]);
        
        // Verify all contributions with different scores
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(1),
                types.uint(50)
            ], deployer.address),
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(2),
                types.uint(75)
            ], deployer.address),
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(3),
                types.uint(100)
            ], deployer.address)
        ]);
        
        // Verify total score accumulation (50 + 75 + 100 = 225)
        let profileCall = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-profile', [
            types.principal(wallet1.address)
        ], wallet1.address);
        let profile = profileCall.result.expectSome().expectTuple();
        assertEquals(profile['total-score'], types.uint(225));
        assertEquals(profile['contribution-count'], types.uint(3));
        
        // Update tier and verify it's GOLD (225 >= 250 is false, so still SILVER)
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'update-contributor-tier', [
                types.principal(wallet1.address)
            ], deployer.address)
        ]);
        
        let tierCall = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-tier', [
            types.principal(wallet1.address)
        ], deployer.address);
        assertEquals(tierCall.result.expectOk(), types.uint(2)); // SILVER (225 < 250)
    },
});

Clarinet.test({
    name: "Ensure that read-only functions work correctly for non-existent data",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let wallet1 = accounts.get('wallet_1')!;
        
        // Initialize contract
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address)
        ]);
        
        // Test non-existent contribution
        let contributionCall = chain.callReadOnlyFn('proof_of_collab', 'get-contribution', [
            types.uint(999)
        ], deployer.address);
        assertEquals(contributionCall.result, types.none());
        
        // Test non-existent contributor profile
        let profileCall = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-profile', [
            types.principal(wallet1.address)
        ], deployer.address);
        assertEquals(profileCall.result, types.none());
        
        // Test non-existent contributor tier
        let tierCall = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-tier', [
            types.principal(wallet1.address)
        ], deployer.address);
        assertEquals(tierCall.result.expectErr(), types.uint(101)); // err-not-found
        
        // Test non-admin user
        let adminCheck = chain.callReadOnlyFn('proof_of_collab', 'is-project-admin', [
            types.principal(wallet1.address)
        ], deployer.address);
        assertEquals(adminCheck.result, types.bool(false));
    },
});

Clarinet.test({
    name: "Ensure that complete collaboration workflow works end-to-end",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        let deployer = accounts.get('deployer')!;
        let admin1 = accounts.get('wallet_1')!;
        let contributor1 = accounts.get('wallet_2')!;
        let contributor2 = accounts.get('wallet_3')!;
        
        // Initialize contract and setup
        let block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'initialize', [], deployer.address),
            Tx.contractCall('proof_of_collab', 'add-project-admin', [
                types.principal(admin1.address)
            ], deployer.address)
        ]);
        
        // Contributors submit contributions
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Implemented OAuth integration")
            ], contributor1.address),
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Fixed memory leak in worker threads")
            ], contributor2.address),
            Tx.contractCall('proof_of_collab', 'submit-contribution', [
                types.utf8("Added comprehensive test coverage")
            ], contributor1.address)
        ]);
        
        // Admin verifies contributions
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(1),
                types.uint(150)
            ], admin1.address),
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(2),
                types.uint(200)
            ], admin1.address),
            Tx.contractCall('proof_of_collab', 'verify-contribution', [
                types.uint(3),
                types.uint(100)
            ], admin1.address)
        ]);
        
        // Update contributor tiers
        block = chain.mineBlock([
            Tx.contractCall('proof_of_collab', 'update-contributor-tier', [
                types.principal(contributor1.address)
            ], deployer.address),
            Tx.contractCall('proof_of_collab', 'update-contributor-tier', [
                types.principal(contributor2.address)
            ], deployer.address)
        ]);
        
        // Verify final states
        // Contributor1: 150 + 100 = 250 points (GOLD tier)
        let profile1 = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-profile', [
            types.principal(contributor1.address)
        ], deployer.address);
        let profile1Data = profile1.result.expectSome().expectTuple();
        assertEquals(profile1Data['total-score'], types.uint(250));
        assertEquals(profile1Data['contribution-count'], types.uint(2));
        
        let tier1 = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-tier', [
            types.principal(contributor1.address)
        ], deployer.address);
        assertEquals(tier1.result.expectOk(), types.uint(3)); // GOLD
        
        // Contributor2: 200 points (SILVER tier)
        let profile2 = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-profile', [
            types.principal(contributor2.address)
        ], deployer.address);
        let profile2Data = profile2.result.expectSome().expectTuple();
        assertEquals(profile2Data['total-score'], types.uint(200));
        assertEquals(profile2Data['contribution-count'], types.uint(1));
        
        let tier2 = chain.callReadOnlyFn('proof_of_collab', 'get-contributor-tier', [
            types.principal(contributor2.address)
        ], deployer.address);
        assertEquals(tier2.result.expectOk(), types.uint(2)); // SILVER
    },
});