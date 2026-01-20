IPFS asset kit for DDM NFTs & validator

Files
-----
- validator-manifest.json
    Used by ValidatorsRegistry as a human/machine-readable description of the validator.

- reward-template.json
    Generic ERC-721 metadata. Backend fills {placeholders} and uploads per mint.

- reward-<category>-level1.json
    Example ready-to-mint metadata for specific categories/levels.

- suite-receipt-template.json
    Metadata for SBT receipt of a suite request (if your SuiteRequestRegistry mints one).

- suite-example.json
    Canonical suite JSON; hash this (keccak256 of ABI-encoded fields) to produce suiteHash.

Tips
----
1) Prefer ipfs:// links for image/result URIs.
2) Keep suite JSON canonical (stable key order, same whitespace) before hashing.
3) If you don’t set VALIDATOR_CODE_HASH, deploy will derive it as keccak(description|uri).
4) RewardToken stores 'category' on-chain; keep the JSON 'attributes' aligned.
