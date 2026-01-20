// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./node_modules/@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "./node_modules/@openzeppelin/contracts/utils/introspection/ERC165.sol";

/**
 * @title RewardToken
 * @dev ERC721 NFT used as a non-transferable ("soulbound") reward token.
 * Each token stores a metadata URI and a category string.
 */
contract RewardToken is ERC721URIStorage {
    /// @notice Incremental token ID counter.
    uint256 public nextRewardTokenId = 1;

    /// @notice Mapping from tokenId to category string (e.g. "gold", "silver").
    mapping(uint256 => string) public tokenCategories;

    /// @notice Emitted when a new reward token is minted.
    event RewardMinted(address indexed to, uint256 indexed tokenId, string category, string tokenURI);

    /**
     * @dev Initializes the ERC721 token with name and symbol.
     */
    constructor() ERC721("RewardNFT", "RWDNFT") {}

    /**
     * @notice Mints a new soulbound reward token to `to`.
     * @param to Recipient address of the NFT.
     * @param tokenURI Metadata URI (off-chain or IPFS link).
     * @param category Category string for the token (e.g., "bronze", "gold").
     * @return tokenId The newly minted token's ID.
     */
    function mint(address to, string memory tokenURI, string memory category) external returns (uint256) {
        uint256 tokenId = nextRewardTokenId++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        tokenCategories[tokenId] = category;

        emit RewardMinted(to, tokenId, category, tokenURI);

        return tokenId;
    }

    /**
     * @dev Prevent transfers or burns — only allows minting (soulbound behavior).
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        require(from == address(0), "Reward tokens are soulbound");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    /**
     * @dev Supports interface compatibility.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
