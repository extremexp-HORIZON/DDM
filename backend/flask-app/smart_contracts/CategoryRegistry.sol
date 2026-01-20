// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./node_modules/@openzeppelin/contracts/access/Ownable.sol";

contract CategoryRegistry is Ownable {
    address public appSigner;

    mapping(bytes32 => bool) public allowedCategoryHash;
    string[] private allowedCategories;

    event AppSignerUpdated(address indexed newSigner);
    event CategoryAdded(string category);
    event CategoryRemoved(string category);

    modifier onlyAppSigner() {
        require(msg.sender == appSigner, "Not appSigner");
        _;
    }

    constructor(address _appSigner, string[] memory initialCategories) Ownable() {
        require(_appSigner != address(0), "Zero addr");
        appSigner = _appSigner;
        for (uint256 i = 0; i < initialCategories.length; i++) {
            _addCategory(initialCategories[i]);
        }
    }

    function setAppSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "Zero addr");
        appSigner = newSigner;
        emit AppSignerUpdated(newSigner);
    }

    function addCategory(string calldata category) external onlyAppSigner {
        _addCategory(category);
    }

    function removeCategory(string calldata category) external onlyOwner {
        bytes32 h = keccak256(bytes(category));
        require(allowedCategoryHash[h], "Category not found");
        allowedCategoryHash[h] = false;
        emit CategoryRemoved(category);
    }

    function isAllowed(string calldata category) external view returns (bool) {
        return allowedCategoryHash[keccak256(bytes(category))];
    }

    function getAllowedCategories() external view returns (string[] memory) {
        return allowedCategories;
    }

    function _addCategory(string memory category) internal {
        bytes32 h = keccak256(bytes(category));
        require(!allowedCategoryHash[h], "Category exists");
        allowedCategoryHash[h] = true;
        allowedCategories.push(category);
        emit CategoryAdded(category);
    }
}
