
import { ethers } from "hardhat";

async function main() {
  // 部署 LotteryToken (ERC20)
  const LotteryToken = await ethers.getContractFactory("LotteryToken");
  const lotteryToken = await LotteryToken.deploy();
  await lotteryToken.deployed();
  console.log(`LotteryToken deployed to ${lotteryToken.address}`);

  // 部署 LotteryTicket (ERC721)
  const LotteryTicket = await ethers.getContractFactory("LotteryTicket");
  const lotteryTicket = await LotteryTicket.deploy();
  await lotteryTicket.deployed();
  console.log(`LotteryTicket deployed to ${lotteryTicket.address}`);

  // 部署主合约 Lottery
  const Lottery = await ethers.getContractFactory("Lottery");
  const lottery = await Lottery.deploy(lotteryToken.address, lotteryTicket.address);
  await lottery.deployed();
  console.log(`Lottery deployed to ${lottery.address}`);

  // 将 LotteryTicket 的所有权转移给 Lottery 合约
  const transferTx = await lotteryTicket.transferOwnership(lottery.address);
  await transferTx.wait();
  console.log(`LotteryTicket ownership transferred to Lottery at ${lottery.address}`);

  console.log("Deployment completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});