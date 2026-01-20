// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./node_modules/@openzeppelin/contracts/access/AccessControl.sol";
import "./IValidatorsRegistry.sol";

contract ValidatorsRegistry is AccessControl, IValidatorsRegistry {
    bytes32 public constant VALIDATOR_ADMIN_ROLE = DEFAULT_ADMIN_ROLE;

    mapping(address => ValidatorInfo) private _validators;

    event ValidatorAdded(
        address indexed validator,
        string description,
        string codeURI,
        bytes32 codeHash
    );
    event ValidatorUpdated(
        address indexed validator,
        string description,
        string codeURI,
        bytes32 codeHash,
        bool active
    );
    event ValidatorRemoved(address indexed validator);

    constructor(address admin) {
        require(admin != address(0), "admin=0");
        _grantRole(VALIDATOR_ADMIN_ROLE, admin); // set to Timelock later for full governance
    }

    // ---- Admin (EOA or Timelock/Governor through role) ----

    function addValidator(
        address validator,
        string calldata description,
        string calldata codeURI,
        bytes32 codeHash
    ) external onlyRole(VALIDATOR_ADMIN_ROLE) {
        require(validator != address(0), "validator=0");
        require(!_validators[validator].active, "exists");
        _validators[validator] = ValidatorInfo({
            active: true,
            description: description,
            codeURI: codeURI,
            codeHash: codeHash
        });
        emit ValidatorAdded(validator, description, codeURI, codeHash);
    }

    function updateValidator(
        address validator,
        string calldata description,
        string calldata codeURI,
        bytes32 codeHash,
        bool active
    ) external onlyRole(VALIDATOR_ADMIN_ROLE) {
        require(validator != address(0), "validator=0");
        require(
            _validators[validator].active ||
            _validators[validator].codeHash != bytes32(0) ||
            bytes(_validators[validator].description).length > 0,
            "not found"
        );

        _validators[validator].description = description;
        _validators[validator].codeURI = codeURI;
        _validators[validator].codeHash = codeHash;
        _validators[validator].active = active;
        emit ValidatorUpdated(validator, description, codeURI, codeHash, active);
    }

    function removeValidator(address validator)
        external
        onlyRole(VALIDATOR_ADMIN_ROLE)
    {
        require(_validators[validator].active, "not active");
        delete _validators[validator];
        emit ValidatorRemoved(validator);
    }

    // ---- Read API (for ValidationRegistry & UIs) ----

    function isValidator(address who) external view override returns (bool) {
        return _validators[who].active;
    }

    function getValidatorInfo(address who)
        external
        view
        override
        returns (ValidatorInfo memory)
    {
        return _validators[who];
    }
}
