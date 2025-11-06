import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Lottery System", function () {
  async function deployFixture() {
    // 获取账户
    const [owner, player1, player2] = await ethers.getSigners();

    // 部署 LotteryToken (ERC20)
    const LotteryToken = await ethers.getContractFactory("LotteryToken");
    const lotteryToken = await LotteryToken.deploy();
    await lotteryToken.deployed();

    // 部署 LotteryTicket (ERC721)
    const LotteryTicket = await ethers.getContractFactory("LotteryTicket");
    const lotteryTicket = await LotteryTicket.deploy();
    await lotteryTicket.deployed();

    // 部署主合约 Lottery
    const Lottery = await ethers.getContractFactory("Lottery");
    const lottery = await Lottery.deploy(lotteryToken.address, lotteryTicket.address);
    await lottery.deployed();

    return { lottery, lotteryToken, lotteryTicket, owner, player1, player2 };
  }

  describe("Deployment", function () {
    it("Should deploy all contracts", async function () {
      const { lottery, lotteryToken, lotteryTicket } = await loadFixture(deployFixture);
      
      expect(await lotteryToken.name()).to.equal("LotteryToken");
      expect(await lotteryToken.symbol()).to.equal("LTK");
      expect(await lotteryTicket.name()).to.equal("LotteryTicket");
      expect(await lotteryTicket.symbol()).to.equal("LTT");
    });
  });

  describe("Lottery Functionality", function () {
    it("Should allow owner to create lottery", async function () {
      const { lottery, lotteryToken, owner } = await loadFixture(deployFixture);
      
      // 公证人先获取一些代币
      await lotteryToken.airdrop();
      
      // 授权给彩票合约
      await lotteryToken.approve(lottery.address, ethers.utils.parseEther("1000"));
      
      // 创建彩票项目
      await expect(lottery.createLottery(
        "Test Lottery",
        ["Option 1", "Option 2", "Option 3"],
        ethers.utils.parseEther("100"),
        86400 // 1天
      )).to.emit(lottery, "LotteryCreated");
    });
  });
});