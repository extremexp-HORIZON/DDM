// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../smart_contracts/RewardToken.sol";
import "../smart_contracts/ValidationRegistry.sol";
import "../smart_contracts/DatasetRegistry.sol";

import "./node_modules/@openzeppelin/contracts/access/AccessControl.sol";
import "./node_modules/@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./node_modules/@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract RewardClaimer is AccessControl, EIP712, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant SIGNER_ROLE  = keccak256("SIGNER_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE"); // <-- NEW

    RewardToken public immutable rewardToken;
    ValidationRegistry public immutable validationRegistry;
    DatasetRegistry public immutable datasetRegistry;

    mapping(address => mapping(bytes32 => mapping(bytes32 => bool))) public claimed;

    event RewardClaimed(address indexed user, string category, bytes32 level, uint256 tokenId);

    // Now includes metadataURI so signer commits to it.
    // ClaimFor(address claimer,bytes32 datasetFingerprint,string category,bytes32 level,string metadataURI,uint256 deadline)
    bytes32 private constant CLAIM_TYPEHASH =
        keccak256(
            "ClaimFor(address claimer,bytes32 datasetFingerprint,string category,bytes32 level,string metadataURI,uint256 deadline)"
        );

    constructor(
        address _rewardToken,
        address _validationRegistry,
        address _datasetRegistry,
        address initialSigner,
        address admin
    )
        EIP712("RewardClaimer", "1")
    {
        require(
            _rewardToken != address(0) &&
            _validationRegistry != address(0) &&
            _datasetRegistry != address(0),
            "zero addr"
        );

        rewardToken = RewardToken(_rewardToken);
        validationRegistry = ValidationRegistry(_validationRegistry);
        datasetRegistry = DatasetRegistry(_datasetRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (initialSigner != address(0)) {
            _grantRole(SIGNER_ROLE, initialSigner);
        }
    }

    // Backwards-compatible: claimer must be msg.sender
    function claimReward(
        bytes32 datasetFingerprint,
        string calldata category,
        bytes32 level,
        string calldata metadataURI,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        _claimFor(
            msg.sender,
            datasetFingerprint,
            category,
            level,
            metadataURI,
            deadline,
            signature
        );
    }

    // NEW: can be relayed by DatasetRegistry (or any RELAYER_ROLE)
    function claimRewardFor(
        address claimer,
        bytes32 datasetFingerprint,
        string calldata category,
        bytes32 level,
        string calldata metadataURI,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant {
        require(
            msg.sender == claimer || hasRole(RELAYER_ROLE, msg.sender),
            "not authorized"
        );

        _claimFor(
            claimer,
            datasetFingerprint,
            category,
            level,
            metadataURI,
            deadline,
            signature
        );
    }

    function _claimFor(
        address claimer,
        bytes32 datasetFingerprint,
        string calldata category,
        bytes32 level,
        string calldata metadataURI,
        uint256 deadline,
        bytes calldata signature
    ) internal {
        require(bytes(metadataURI).length > 0, "metadataURI empty");
        require(block.timestamp <= deadline, "Signature expired");

        // Must be validated
        require(validationRegistry.isValid(datasetFingerprint), "Dataset not validated");

        // Only actual uploader gets minted
        require(datasetRegistry.getDataset(datasetFingerprint).uploader == claimer, "Only uploader");

        require(!claimed[claimer][datasetFingerprint][level], "Already claimed");

        // Verify signature by SIGNER_ROLE
        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                claimer,
                datasetFingerprint,
                keccak256(bytes(category)),
                level,
                keccak256(bytes(metadataURI)),
                deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(hasRole(SIGNER_ROLE, signer), "Invalid signer");

        uint256 tokenId = rewardToken.mint(claimer, metadataURI, category);
        claimed[claimer][datasetFingerprint][level] = true;

        emit RewardClaimed(claimer, category, level, tokenId);
    }
}
