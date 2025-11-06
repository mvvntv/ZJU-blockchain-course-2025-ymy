pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LotteryToken is ERC20, Ownable {
    uint256 public constant AIRDROP_AMOUNT = 1000 * 10**18; // 每次空投1000代币
    mapping(address => bool) public hasClaimed; // 记录用户是否已领取空投

    constructor() ERC20("LotteryToken", "LTK") Ownable(msg.sender) {}

    function airdrop() external {
        require(!hasClaimed[msg.sender], "Airdrop already claimed");
        hasClaimed[msg.sender] = true;
        _mint(msg.sender, AIRDROP_AMOUNT);
    }
}