pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./LotteryTicket.sol";

contract Lottery is Ownable {
    IERC20 public lotteryToken;
    LotteryTicket public lotteryTicket;
    
    // 竞猜项目结构
    struct LotteryInfo {
        string name;                // 项目名称
        string[] choices;           // 可选项
        uint256 totalPrize;         // 总奖金
        uint256 endTime;            // 结束时间
        uint256 winningChoice;      // 获胜选项索引
        bool isFinished;            // 是否已结束
        bool isResultDeclared;      // 是否已公布结果
        address creator;            // 彩票项目创建者
    }
    
    // 用于返回的彩票信息结构（不含映射）
    struct LotteryInfoView {
        string name;
        string[] choices;
        uint256 totalPrize;
        uint256 endTime;
        uint256 winningChoice;
        bool isFinished;
        bool isResultDeclared;
        address creator;
    }
    
    // 订单簿结构（用于彩票交易）
    struct Order {
        uint256 tokenId;            // 彩票ID
        address seller;             // 卖家
        uint256 price;              // 价格
        bool active;                // 是否有效
    }
    
    mapping(uint256 => LotteryInfo) public lotteries; // 项目ID -> 项目信息
    mapping(uint256 => Order[]) public orderBooks;    // 项目ID -> 订单列表
    mapping(uint256 => mapping(uint256 => uint256[])) public lotteryChoiceTickets; // 项目ID -> 选项ID -> 彩票列表
    uint256 public nextLotteryId = 1;
    
    event LotteryCreated(uint256 indexed lotteryId, string name, uint256 endTime);
    event TicketPurchased(address indexed buyer, uint256 indexed lotteryId, uint256 indexed tokenId, uint256 choiceIndex, uint256 amount);
    event OrderPlaced(uint256 indexed orderId, uint256 indexed tokenId, address indexed seller, uint256 price);
    event OrderCancelled(uint256 indexed orderId);
    event TicketTraded(uint256 indexed tokenId, address indexed from, address indexed to, uint256 price);
    event ResultDeclared(uint256 indexed lotteryId, uint256 winningChoice);
    event PrizeClaimed(address indexed winner, uint256 amount);
    
    constructor(address _lotteryToken, address _lotteryTicket) Ownable(msg.sender) {
        lotteryToken = IERC20(_lotteryToken);
        lotteryTicket = LotteryTicket(_lotteryTicket);
    }
    
    // 公证人创建竞猜项目
    function createLottery(
        string memory _name,
        string[] memory _choices,
        uint256 _totalPrize,
        uint256 _duration
    ) external onlyOwner {
        require(_choices.length >= 2, "At least 2 choices required");
        require(_totalPrize > 0, "Prize must be greater than 0");
        
        uint256 lotteryId = nextLotteryId++;
        LotteryInfo storage lottery = lotteries[lotteryId];
        lottery.name = _name;
        lottery.choices = _choices;
        lottery.totalPrize = _totalPrize;
        lottery.endTime = block.timestamp + _duration;
        lottery.winningChoice = 0;
        lottery.isFinished = false;
        lottery.isResultDeclared = false;
        lottery.creator = msg.sender;
        
        // 公证人需要先充值奖金
        require(lotteryToken.transferFrom(msg.sender, address(this), _totalPrize), "Transfer failed");
        
        emit LotteryCreated(lotteryId, _name, lottery.endTime);
    }
    
    // 玩家购买彩票
    function buyTicket(uint256 _lotteryId, uint256 _choiceIndex, uint256 _amount) external {
        LotteryInfo storage lottery = lotteries[_lotteryId];
        require(!lottery.isFinished, "Lottery is finished");
        require(block.timestamp < lottery.endTime, "Lottery is expired");
        require(_choiceIndex < lottery.choices.length, "Invalid choice");
        require(_amount > 0, "Amount must be greater than 0");
        
        // 检查用户代币余额
        require(lotteryToken.balanceOf(msg.sender) >= _amount, "Insufficient token balance");
        
        // 转移代币 - 一部分给创建者，一部分给合约(用于奖金)
        uint256 creatorFee = _amount / 10; // 10% 给创建者
        uint256 prizePoolContribution = _amount - creatorFee; // 90% 用于奖池
        
        // 转移给创建者
        require(lotteryToken.transferFrom(msg.sender, lottery.creator, creatorFee), "Transfer to creator failed");
        
        // 转移给奖金池
        require(lotteryToken.transferFrom(msg.sender, address(this), prizePoolContribution), "Transfer to contract failed");
        
        // 增加奖池金额
        lottery.totalPrize += prizePoolContribution;
        
        // 彩票NFT
        uint256 tokenId = lotteryTicket.mint(msg.sender, _lotteryId, _choiceIndex, _amount);
        
        // 记录该选项的彩票
        lotteryChoiceTickets[_lotteryId][_choiceIndex].push(tokenId);
        
        emit TicketPurchased(msg.sender, _lotteryId, tokenId, _choiceIndex, _amount);
    }
    
    // 获取彩票信息（用于前端显示）
    function getLotteryInfo(uint256 _lotteryId) external view returns (
        string memory name,
        string[] memory choices,
        uint256 totalPrize,
        uint256 endTime,
        uint256 winningChoice,
        bool isFinished,
        bool isResultDeclared,
        address creator
    ) {
        LotteryInfo storage lottery = lotteries[_lotteryId];
        return (
            lottery.name,
            lottery.choices,
            lottery.totalPrize,
            lottery.endTime,
            lottery.winningChoice,
            lottery.isFinished,
            lottery.isResultDeclared,
            lottery.creator
        );
    }

    // 获取当前合约中的奖池余额（用于前端显示）
    function getCurrentPrizePool() external view returns (uint256) {
        return lotteryToken.balanceOf(address(this));
    }

    // 挂单出售彩票
    function placeOrder(uint256 _tokenId, uint256 _price) external {
        // 检查发送者是否拥有该NFT
        require(lotteryTicket.ownerOf(_tokenId) == msg.sender, "Not owner of ticket");
        
        // 获取彩票信息
        LotteryTicket.TicketInfo memory ticketInfo = lotteryTicket.getTicketInfo(_tokenId);
        uint256 lotteryId = ticketInfo.lotteryId;
        LotteryInfo storage lottery = lotteries[lotteryId];
        
        require(!lottery.isFinished, "Lottery is finished");
        require(block.timestamp < lottery.endTime, "Lottery is expired");
        require(_price > 0, "Price must be greater than 0");
        
        // 授权合约可以转移NFT
        lotteryTicket.transferFrom(msg.sender, address(this), _tokenId);
        
        // 创建订单
        uint256 orderId = orderBooks[lotteryId].length;
        orderBooks[lotteryId].push(Order({
            tokenId: _tokenId,
            seller: msg.sender,
            price: _price,
            active: true
        }));
        
        emit OrderPlaced(orderId, _tokenId, msg.sender, _price);
    }
    
    // 取消订单
    function cancelOrder(uint256 _lotteryId, uint256 _orderId) external {
        require(_orderId < orderBooks[_lotteryId].length, "Invalid order ID");
        
        Order storage order = orderBooks[_lotteryId][_orderId];
        require(order.active, "Order is not active");
        require(order.seller == msg.sender, "Not seller of order");
        
        // 将NFT归还给卖家
        lotteryTicket.transferFrom(address(this), msg.sender, order.tokenId);
        
        order.active = false;
        
        emit OrderCancelled(_orderId);
    }
    
    // 购买订单中的彩票
    function buyOrder(uint256 _lotteryId, uint256 _orderId) external {
        require(_orderId < orderBooks[_lotteryId].length, "Invalid order ID");
        
        Order storage order = orderBooks[_lotteryId][_orderId];
        require(order.active, "Order is not active");
        
        // 获取彩票信息
        LotteryTicket.TicketInfo memory ticketInfo = lotteryTicket.getTicketInfo(order.tokenId);
        LotteryInfo storage lottery = lotteries[_lotteryId];
        
        require(!lottery.isFinished, "Lottery is finished");
        require(block.timestamp < lottery.endTime, "Lottery is expired");
        
        // 转移代币给卖家
        require(lotteryToken.transferFrom(msg.sender, order.seller, order.price), "Transfer failed");
        
        // 转移NFT给买家
        lotteryTicket.transferFrom(address(this), msg.sender, order.tokenId);
        
        order.active = false;
        
        emit TicketTraded(order.tokenId, order.seller, msg.sender, order.price);
    }
    
    // 公证人公布结果
    function declareResult(uint256 _lotteryId, uint256 _winningChoice) external {
        LotteryInfo storage lottery = lotteries[_lotteryId];
        
        // 检查彩票是否存在
        require(bytes(lottery.name).length > 0, "Lottery does not exist");
        
        // 检查调用者是否是彩票创建者或所有者
        require(msg.sender == lottery.creator || msg.sender == owner(), "Only creator or owner can declare result");
        
        // 检查彩票是否已结束（现在允许提前开奖）
        // require(block.timestamp >= lottery.endTime, "Lottery not ended yet");
        
        // 检查是否已经开奖
        require(!lottery.isResultDeclared, "Result already declared");
        
        // 检查选择是否有效
        require(_winningChoice < lottery.choices.length, "Invalid winning choice");
        
        lottery.winningChoice = _winningChoice;
        lottery.isResultDeclared = true;
        lottery.isFinished = true;
        
        // 分配奖金
        _distributePrizes(_lotteryId);
        
        emit ResultDeclared(_lotteryId, _winningChoice);
    }
    
    // 分发奖金的内部函数
    function _distributePrizes(uint256 _lotteryId) internal {
        LotteryInfo storage lottery = lotteries[_lotteryId];
        
        // 获取获胜选项的所有彩票
        uint256[] storage winningTickets = lotteryChoiceTickets[_lotteryId][lottery.winningChoice];
        
        // 如果没有获胜彩票，奖金保留在合约中
        if (winningTickets.length == 0) {
            return;
        }
        
        // 计算所有获胜彩票的总购买金额
        uint256 totalWinningAmount = 0;
        for (uint256 i = 0; i < winningTickets.length; i++) {
            uint256 tokenId = winningTickets[i];
            // 检查彩票是否仍然有效（未被交易）
            if (lotteryTicket.ownerOf(tokenId) != address(0)) {
                LotteryTicket.TicketInfo memory ticketInfo = lotteryTicket.getTicketInfo(tokenId);
                if (ticketInfo.lotteryId == _lotteryId) {
                    totalWinningAmount += ticketInfo.amount;
                }
            }
        }
        
        // 如果总金额为0，不分配奖金
        if (totalWinningAmount == 0) {
            return;
        }
        
        // 按比例分配奖金给每个获胜者
        for (uint256 i = 0; i < winningTickets.length; i++) {
            uint256 tokenId = winningTickets[i];
            address winner = lotteryTicket.ownerOf(tokenId);
            
            // 检查彩票是否仍然有效
            if (winner != address(0)) {
                LotteryTicket.TicketInfo memory ticketInfo = lotteryTicket.getTicketInfo(tokenId);
                if (ticketInfo.lotteryId == _lotteryId) {
                    // 按比例计算奖金
                    uint256 prize = (lottery.totalPrize * ticketInfo.amount) / totalWinningAmount;
                    
                    // 确保有奖金可分配
                    if (prize > 0) {
                        // 转移奖金
                        require(lotteryToken.transfer(winner, prize), "Transfer failed");
                        
                        emit PrizeClaimed(winner, prize);
                    }
                }
            }
        }
    }
    
    // 结束项目（紧急情况）
    function finishLottery(uint256 _lotteryId) external onlyOwner {
        LotteryInfo storage lottery = lotteries[_lotteryId];
        require(!lottery.isFinished, "Lottery already finished");
        
        lottery.isFinished = true;
    }
    
    // 获取订单簿
    function getOrderBook(uint256 _lotteryId) external view returns (Order[] memory) {
        return orderBooks[_lotteryId];
    }
}