// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./node_modules/@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./node_modules/@openzeppelin/contracts/access/Ownable.sol";



contract DatasetRegistry is Ownable {
    using ECDSA for bytes32;

    struct Dataset {
        address uploader;
        string uri;
        bytes32 suiteHash;
        string fileFormat;
        bytes32 fingerprint;
        uint256 registeredAt;
        string reportUri;
    }

    mapping(bytes32 => Dataset) public datasets;
    mapping(address => uint256) public nonces;


    event DatasetRegistered(
        address indexed uploader,
        string uri,
        bytes32 indexed suiteHash,
        bytes32 indexed fingerprint,
        uint256 nonce,
        string fileFormat,
        string reportUri,
        uint256 registeredAt
    );

    event RewardClaimerUpdated(address indexed newRewardClaimer);

    constructor() {}


    function registerDataset(
        string memory uri,
        bytes32 suiteHash,
        string memory fileFormat,
        string memory reportUri,
        uint256 nonce,
        bytes memory signature
    ) external {
        _register(uri, suiteHash, fileFormat, reportUri, nonce, signature);
    }


    function _register(
        string memory uri,
        bytes32 suiteHash,
        string memory fileFormat,
        string memory reportUri,
        uint256 nonce,
        bytes memory signature
    ) internal returns (bytes32 fingerprint) {
        require(nonce == nonces[msg.sender], "Invalid nonce");

        bytes32 messageHash = keccak256(
            abi.encode(
                "Register dataset:",
                uri,
                suiteHash,
                fileFormat,
                reportUri,
                msg.sender,
                nonce
            )
        ).toEthSignedMessageHash();

        address signer = ECDSA.recover(messageHash, signature);
        require(signer == msg.sender, "Invalid signature");

        fingerprint = keccak256(abi.encode(uri, suiteHash, msg.sender, nonce));
        require(datasets[fingerprint].uploader == address(0), "Dataset already registered");

        datasets[fingerprint] = Dataset({
            uploader: msg.sender,
            uri: uri,
            suiteHash: suiteHash,
            fileFormat: fileFormat,
            fingerprint: fingerprint,
            registeredAt: block.timestamp,
            reportUri: reportUri
        });

        nonces[msg.sender] += 1;

        emit DatasetRegistered(
            msg.sender,
            uri,
            suiteHash,
            fingerprint,
            nonce,
            fileFormat,
            reportUri,
            block.timestamp
        );
    }

    function getDataset(bytes32 fingerprint) external view returns (Dataset memory) {
        return datasets[fingerprint];
    }

    function computeFingerprint(
        string memory uri,
        bytes32 suiteHash,
        address uploader,
        uint256 nonce
    ) external pure returns (bytes32) {
        return keccak256(abi.encode(uri, suiteHash, uploader, nonce));
    }
}
