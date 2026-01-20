// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../smart_contracts/RewardToken.sol";
import "../smart_contracts/DatasetRegistry.sol";
import "../smart_contracts/ValidationRegistry.sol";
import "./CategoryRegistry.sol";
import "./FileFormatRegistry.sol";

import "./node_modules/@openzeppelin/contracts/access/AccessControl.sol";
import "./node_modules/@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./node_modules/@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./node_modules/@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "../smart_contracts/RewardClaimer.sol";



/**
 * DatasetRequestRegistry
 * - CategoryRegistry & FileFormatRegistry enforced
 * - Stores suiteURI/docsURI/certificateURI
 * - Adds EIP-712 signed creation path (backend-curated)
 * - Adds refund-after-deadline + last-claimer remainder payout
 */
contract DatasetRequestRegistry is AccessControl, EIP712, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    // EIP-712 typehash (renamed)
    bytes32 private constant DATASET_REQUEST_TYPEHASH = keccak256(
        "DatasetRequestCreate(address requester,bytes32 suiteHash,string suiteURI,string docsURI,string certificateURI,string category,string fileFormat,uint256 deadline,uint256 totalExpected,uint256 nonce,uint256 expiresAt)"
    );

    RewardToken public rewardToken;
    DatasetRegistry public datasetRegistry;
    ValidationRegistry public validationRegistry;
    CategoryRegistry public categoryRegistry;
    FileFormatRegistry public fileFormatRegistry;
    RewardClaimer public rewardClaimer;
    event RewardClaimerUpdated(address indexed newRewardClaimer);



    uint256 public nextId = 1;

    struct DatasetRequest {
        address requester;
        bytes32 suiteHash;
        string suiteURI;
        string docsURI;
        string certificateURI;      // SBT metadata
        string category;
        string fileFormat;
        uint256 deadline;
        uint256 bounty;
        uint256 totalExpected;
        uint256 totalClaims;
        bool closed;
        uint256 certificateTokenId; // SBT id
    }

    mapping(uint256 => DatasetRequest) public requests;
    mapping(uint256 => mapping(bytes32 => bool)) public hasClaimed;

    // EIP-712 replay protection: requester => used nonce
    mapping(address => mapping(uint256 => bool)) public usedNonce;

    // Renamed events
    event DatasetRequestCreated(
        uint256 indexed id,
        address indexed requester,
        bytes32 indexed suiteHash,
        uint256 bounty,
        uint256 deadline,
        uint256 expected,
        string category,
        string suiteURI,
        string docsURI,
        string fileFormat,
        string certificateURI
    );

    event DatasetRewardClaimed(
        uint256 indexed id,
        bytes32 indexed datasetFingerprint,
        address indexed uploader,
        uint256 amount
    );

    event DatasetRequestClosed(
        uint256 indexed id, 
        address indexed by, 
        uint256 refund
    );

    constructor(
        address _rewardToken,
        address _datasetRegistry,
        address _validationRegistry,
        address _categoryRegistry,
        address _fileFormatRegistry,
        address admin,
        address initialSigner
    ) EIP712("DatasetRequestRegistry","1") {
        require(
            _rewardToken != address(0) &&
            _datasetRegistry != address(0) &&
            _validationRegistry != address(0) &&
            _categoryRegistry != address(0) &&
            _fileFormatRegistry != address(0),
            "Zero addr"
        );
        rewardToken = RewardToken(_rewardToken);
        datasetRegistry = DatasetRegistry(_datasetRegistry);
        validationRegistry = ValidationRegistry(_validationRegistry);
        categoryRegistry = CategoryRegistry(_categoryRegistry);
        fileFormatRegistry = FileFormatRegistry(_fileFormatRegistry);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (initialSigner != address(0)) {
            _grantRole(SIGNER_ROLE, initialSigner);
        }
    }

    // -----------------------
    //  A) Permissionless path
    // -----------------------
    function createDatasetRequest(
        bytes32 suiteHash,
        string calldata suiteURI,
        string calldata docsURI,
        string calldata certificateURI,
        string calldata category,
        string calldata fileFormat,
        uint256 deadline,
        uint256 totalExpected
    ) external payable returns (uint256 id) {
        _precheckCommon(suiteHash, suiteURI, category, fileFormat, deadline, totalExpected);
        id = _create(
            msg.sender,
            suiteHash,
            suiteURI,
            docsURI,
            certificateURI,
            category,
            fileFormat,
            deadline,
            totalExpected
        );
        return id;
    }

    // -----------------------------------------
    //  B) Curated path guarded by app signature
    // -----------------------------------------
    function createDatasetRequestWithSig(
        bytes32 suiteHash,
        string calldata suiteURI,
        string calldata docsURI,
        string calldata certificateURI,
        string calldata category,
        string calldata fileFormat,
        uint256 deadline,
        uint256 totalExpected,
        uint256 nonce,
        uint256 expiresAt,
        bytes calldata signature
    ) external payable returns (uint256 id) {
        _precheckCommon(suiteHash, suiteURI, category, fileFormat, deadline, totalExpected);
        require(block.timestamp <= expiresAt, "sig expired");
        require(!usedNonce[msg.sender][nonce], "nonce used");

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    DATASET_REQUEST_TYPEHASH,
                    msg.sender,                 // requester
                    suiteHash,
                    keccak256(bytes(suiteURI)),
                    keccak256(bytes(docsURI)),
                    keccak256(bytes(certificateURI)),
                    keccak256(bytes(category)),
                    keccak256(bytes(fileFormat)),
                    deadline,
                    totalExpected,
                    nonce,
                    expiresAt
                )
            )
        );
        address signer = ECDSA.recover(digest, signature);
        require(hasRole(SIGNER_ROLE, signer), "invalid app signer");

        usedNonce[msg.sender][nonce] = true;
        id = _create(
            msg.sender,
            suiteHash,
            suiteURI,
            docsURI,
            certificateURI,
            category,
            fileFormat,
            deadline,
            totalExpected
        );
        return id;
    }

    function setRewardClaimer(address rc) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rewardClaimer = RewardClaimer(rc);
        emit RewardClaimerUpdated(rc);
    }

    function _precheckCommon(
        bytes32 suiteHash,
        string calldata suiteURI,
        string calldata category,
        string calldata fileFormat,
        uint256 deadline,
        uint256 totalExpected
    ) internal view {
        require(msg.value > 0, "Bounty must be > 0");
        require(deadline > block.timestamp, "Deadline in past");
        require(totalExpected > 0, "Expected > 0");
        require(suiteHash != bytes32(0), "suiteHash required");
        require(bytes(suiteURI).length > 0, "suiteURI required");
        require(categoryRegistry.isAllowed(category), "Category not allowed");
        require(fileFormatRegistry.isAllowed(fileFormat), "Format not allowed");
    }

    function _create(
        address requester,
        bytes32 suiteHash,
        string calldata suiteURI,
        string calldata docsURI,
        string calldata certificateURI,
        string calldata category,
        string calldata fileFormat,
        uint256 deadline,
        uint256 totalExpected
    ) internal returns (uint256 id) {
        id = nextId++;
        uint256 tokenId = rewardToken.mint(requester, certificateURI, category);

        requests[id] = DatasetRequest({
            requester: requester,
            suiteHash: suiteHash,
            suiteURI: suiteURI,
            docsURI: docsURI,
            certificateURI: certificateURI,
            category: category,
            fileFormat: fileFormat,
            deadline: deadline,
            bounty: msg.value,
            totalExpected: totalExpected,
            totalClaims: 0,
            closed: false,
            certificateTokenId: tokenId
        });

        emit DatasetRequestCreated(
            id,
            requester,
            suiteHash,
            msg.value,
            deadline,
            totalExpected,
            category,
            suiteURI,
            docsURI,
            fileFormat,
            certificateURI
        );
    }

    // -----------------------
    // Reward claiming
    // -----------------------
    function claimRewardForDataset(uint256 id, bytes32 datasetFingerprint) external nonReentrant {
        DatasetRequest storage r = requests[id];
        require(!r.closed, "Request closed");
        require(block.timestamp <= r.deadline, "Deadline passed");
        require(!hasClaimed[id][datasetFingerprint], "Already claimed");
        require(r.totalClaims < r.totalExpected, "All rewards claimed");

        DatasetRegistry.Dataset memory d = datasetRegistry.getDataset(datasetFingerprint);
        require(d.uploader == msg.sender, "Not dataset uploader");
        require(d.suiteHash == r.suiteHash, "Suite mismatch");
        require(validationRegistry.isValid(datasetFingerprint), "Dataset not validated");
        require(
            keccak256(bytes(d.fileFormat)) == keccak256(bytes(r.fileFormat)),
            "Format mismatch"
        );



        // split + remainder: last claimer gets the remainder to avoid dust
        uint256 base = r.bounty / r.totalExpected;
        uint256 payout = (r.totalClaims + 1 == r.totalExpected)
            ? (r.bounty - base * (r.totalExpected - 1))
            : base;
        require(payout > 0, "Zero payout");

        hasClaimed[id][datasetFingerprint] = true;
        r.totalClaims += 1;

        if (r.totalClaims == r.totalExpected) {
            r.closed = true;
        }

        (bool sent, ) = payable(msg.sender).call{value: payout}("");
        require(sent, "Transfer failed");

        emit DatasetRewardClaimed(id, datasetFingerprint, msg.sender, payout);
    }

    function claimRewardForDatasetAndMint(
        uint256 id,
        bytes32 datasetFingerprint,
        // NFT mint payload (prepared by backend, signed by RewardClaimer SIGNER_ROLE)
        string calldata nftCategory,
        bytes32 level,
        string calldata metadataURI,
        uint256 deadline,
        bytes calldata claimSignature
    ) external nonReentrant {
        DatasetRequest storage r = requests[id];
        require(!r.closed, "Request closed");
        require(block.timestamp <= r.deadline, "Deadline passed");
        require(!hasClaimed[id][datasetFingerprint], "Already claimed");
        require(r.totalClaims < r.totalExpected, "All rewards claimed");

        DatasetRegistry.Dataset memory d = datasetRegistry.getDataset(datasetFingerprint);
        require(d.uploader == msg.sender, "Not dataset uploader");
        require(d.suiteHash == r.suiteHash, "Suite mismatch");
        require(validationRegistry.isValid(datasetFingerprint), "Dataset not validated");
        require(
            keccak256(bytes(d.fileFormat)) == keccak256(bytes(r.fileFormat)),
            "Format mismatch"
        );

        // payout calc
        uint256 base = r.bounty / r.totalExpected;
        uint256 payout = (r.totalClaims + 1 == r.totalExpected)
            ? (r.bounty - base * (r.totalExpected - 1))
            : base;
        require(payout > 0, "Zero payout");

        // mark claimed BEFORE external calls (prevents double-claim if downstream calls re-enter)
        hasClaimed[id][datasetFingerprint] = true;
        r.totalClaims += 1;
        if (r.totalClaims == r.totalExpected) {
            r.closed = true;
        }

        // 1) mint NFT via RewardClaimer (backend-authorized)
        require(address(rewardClaimer) != address(0), "RewardClaimer not set");
        rewardClaimer.claimRewardFor(
            msg.sender,
            datasetFingerprint,
            nftCategory,
            level,
            metadataURI,
            deadline,
            claimSignature
        );

        // 2) pay ETH last
        (bool sent, ) = payable(msg.sender).call{value: payout}("");
        require(sent, "Transfer failed");

        emit DatasetRewardClaimed(id, datasetFingerprint, msg.sender, payout);
    }


    

    /// Allow requester to reclaim unawarded funds after deadline; owner can emergency-close anytime.
    function cancelAndRefund(uint256 id) external nonReentrant {
        DatasetRequest storage r = requests[id];
        require(!r.closed, "Already closed");
        require(
            msg.sender == r.requester || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "not authorized"
        );

        if (msg.sender == r.requester) {
            require(block.timestamp > r.deadline, "not past deadline");
        }

        r.closed = true;
        uint256 paidOut = (r.bounty / r.totalExpected) * r.totalClaims;
        uint256 remainder = r.bounty - paidOut;

        if (remainder > 0) {
            (bool ok, ) = payable(r.requester).call{value: remainder}("");
            require(ok, "refund failed");
        }
        emit DatasetRequestClosed(id, msg.sender, remainder);
    }

}
