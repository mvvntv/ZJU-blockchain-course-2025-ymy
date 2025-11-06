pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LotteryTicket is ERC721, ERC721Enumerable, Ownable {
    uint256 private _nextTokenId;
    
    // 彩票信息结构
    struct TicketInfo {
        uint256 lotteryId;      // 对应的彩票项目ID
        uint256 choiceIndex;    // 选择的选项索引
        uint256 amount;         // 购买金额
    }
    
    mapping(uint256 => TicketInfo) public ticketInfos;
    
    constructor() ERC721("LotteryTicket", "LTT") Ownable(msg.sender) {}

    function mint(address to, uint256 lotteryId, uint256 choiceIndex, uint256 amount) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _mint(to, tokenId);
        ticketInfos[tokenId] = TicketInfo({
            lotteryId: lotteryId,
            choiceIndex: choiceIndex,
            amount: amount
        });
        return tokenId;
    }

    function getTicketInfo(uint256 tokenId) external view returns (TicketInfo memory) {
        return ticketInfos[tokenId];
    }

    // ERC721Enumerable required overrides
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}