import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { LotteryToken } from "../typechain-types";

describe("LotteryToken - Airdrop Functionality", function () {
  async function deployTokenFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    
    const LotteryToken = await ethers.getContractFactory("LotteryToken");
    const token = await LotteryToken.deploy();
    
    return { token, owner, addr1, addr2 };
  }

  describe("Airdrop Tests", function () {
    it("Should allow a user to claim airdrop", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      // 检查初始余额
      expect(await token.balanceOf(addr1.address)).to.equal(0);
      
      // 执行空投
      await expect(token.connect(addr1).airdrop())
        .to.emit(token, "Transfer")
        .withArgs(ethers.constants.AddressZero, addr1.address, ethers.utils.parseEther("1000"));
      
      // 检查空投后余额
      expect(await token.balanceOf(addr1.address)).to.equal(ethers.utils.parseEther("1000"));
    });

    it("Should fail when a user tries to claim airdrop twice", async function () {
      const { token, addr1 } = await loadFixture(deployTokenFixture);
      
      // 第一次空投应该成功
      await token.connect(addr1).airdrop();
      
      // 第二次空投应该失败
      await expect(token.connect(addr1).airdrop()).to.be.revertedWith("Airdrop already claimed");
    });

    it("Should have correct airdrop amount", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      
      expect(await token.AIRDROP_AMOUNT()).to.equal(ethers.utils.parseEther("1000"));
    });
  });
});