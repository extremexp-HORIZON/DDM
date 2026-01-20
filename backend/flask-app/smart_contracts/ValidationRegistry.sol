// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../smart_contracts/DatasetRegistry.sol";
import "./IValidatorsRegistry.sol";
import "./node_modules/@openzeppelin/contracts/access/Ownable.sol";

contract ValidationRegistry is Ownable {
    struct Validation {
        address validator;
        bytes32 validationHash;   // hash of validation result
        string resultURI;         // ipfs://.. JSON report/logs
        string reportURI;         // ipfs://.. HTML report (optional, can be "")
        bool successful;
        uint256 timestamp;
    }

    mapping(bytes32 => Validation[]) private validationHistory;
    mapping(bytes32 => uint256) private latestSuccessfulIndex;

    DatasetRegistry public datasetRegistry;
    IValidatorsRegistry public validatorsRegistry;

    event ValidatorsRegistryUpdated(address indexed newRegistry);

    event ValidationSubmitted(
        bytes32 indexed datasetFingerprint,
        address indexed validator,
        bool successful,
        uint256 index,
        bytes32 validationHash,
        string resultURI,
        string reportURI
    );

    constructor(address _datasetRegistry, address _validatorsRegistry) Ownable() {
        require(_datasetRegistry != address(0) && _validatorsRegistry != address(0), "zero addr");
        datasetRegistry = DatasetRegistry(_datasetRegistry);
        validatorsRegistry = IValidatorsRegistry(_validatorsRegistry);
    }

    function setValidatorsRegistry(address newRegistry) external onlyOwner {
        require(newRegistry != address(0), "zero addr");
        validatorsRegistry = IValidatorsRegistry(newRegistry);
        emit ValidatorsRegistryUpdated(newRegistry);
    }

    function submitValidation(
        bytes32 datasetFingerprint,
        bytes32 validationHash,
        string calldata resultURI,
        string calldata reportURI,
        bool successful
    ) external {
        require(validatorsRegistry.isValidator(msg.sender), "not validator");
        require(
            datasetRegistry.getDataset(datasetFingerprint).uploader != address(0),
            "unknown dataset"
        );

        Validation memory v = Validation({
            validator: msg.sender,
            validationHash: validationHash,
            resultURI: resultURI,
            reportURI: reportURI, // can be "" if you don’t have HTML
            successful: successful,
            timestamp: block.timestamp
        });

        validationHistory[datasetFingerprint].push(v);
        uint256 idx = validationHistory[datasetFingerprint].length - 1;

        if (successful) {
            latestSuccessfulIndex[datasetFingerprint] = idx;
        }

        emit ValidationSubmitted(
            datasetFingerprint,
            msg.sender,
            successful,
            idx,
            validationHash,
            resultURI,
            reportURI
        );
    }

    function getValidationHistory(bytes32 fp) external view returns (Validation[] memory) {
        return validationHistory[fp];
    }

    function getLatestValidation(bytes32 fp) external view returns (Validation memory) {
        Validation[] memory h = validationHistory[fp];
        require(h.length > 0, "no validations");
        return h[h.length - 1];
    }

    function isValid(bytes32 fp) public view returns (bool) {
        Validation[] memory h = validationHistory[fp];
        if (h.length == 0) return false;

        uint256 cached = latestSuccessfulIndex[fp];
        if (cached < h.length && h[cached].successful) return true;

        for (uint256 i = h.length; i > 0; i--) {
            if (h[i - 1].successful) return true;
        }
        return false;
    }
}
