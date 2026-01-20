// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./node_modules/@openzeppelin/contracts/access/Ownable.sol";

contract FileFormatRegistry is Ownable {
    address public appSigner;

    mapping(bytes32 => bool) public allowedFormatHash;
    string[] private allowedFormats;

    event AppSignerUpdated(address indexed newSigner);
    event FormatAdded(string format_);
    event FormatRemoved(string format_);

    modifier onlyAppSigner() {
        require(msg.sender == appSigner, "Not appSigner");
        _;
    }

    constructor(address _appSigner, string[] memory initialFormats) Ownable() {
        require(_appSigner != address(0), "Zero addr");
        appSigner = _appSigner;
        for (uint256 i = 0; i < initialFormats.length; i++) {
            _addFormat(initialFormats[i]);
        }
    }

    function setAppSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Zero addr");
        appSigner = newSigner;
        emit AppSignerUpdated(newSigner);
    }

    function addFormat(string calldata format_) external onlyAppSigner {
        _addFormat(format_);
    }

    function removeFormat(string calldata format_) external onlyOwner {
        bytes32 h = keccak256(bytes(format_));
        require(allowedFormatHash[h], "Format not found");
        allowedFormatHash[h] = false;
        emit FormatRemoved(format_);
    }

    function isAllowed(string calldata format_) external view returns (bool) {
        return allowedFormatHash[keccak256(bytes(format_))];
    }

    function getAllowedFormats() external view returns (string[] memory) {
        return allowedFormats;
    }

    function _addFormat(string memory format_) internal {
        bytes32 h = keccak256(bytes(format_));
        require(!allowedFormatHash[h], "Format exists");
        allowedFormatHash[h] = true;
        allowedFormats.push(format_);
        emit FormatAdded(format_);
    }
}
