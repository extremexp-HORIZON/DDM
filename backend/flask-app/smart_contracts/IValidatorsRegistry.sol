// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IValidatorsRegistry {
    struct ValidatorInfo {
        bool active;           // is allowed to submit validations
        string description;    // human-readable: what this validator does
        string codeURI;        // ipfs://.. to code/manifest/agreement
        bytes32 codeHash;      // keccak256 of pinned artifact or manifest
    }

    function isValidator(address who) external view returns (bool);
    function getValidatorInfo(address who) external view returns (ValidatorInfo memory);
}
