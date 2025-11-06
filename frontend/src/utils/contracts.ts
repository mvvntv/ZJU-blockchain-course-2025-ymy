import { ethers } from 'ethers';
import LotteryTokenABI from './abis/LotteryToken.json';
import LotteryTicketABI from './abis/LotteryTicket.json';
import LotteryABI from './abis/Lottery.json';

// 合约地址（请确保这些地址与你的部署地址匹配）
const CONTRACT_ADDRESSES = {
  lotteryToken: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  lotteryTicket: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  lottery: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
};

let signer: ethers.Signer | null = null;
let lotteryTokenContract: ethers.Contract | null = null;
let lotteryTicketContract: ethers.Contract | null = null;
let lotteryContract: ethers.Contract | null = null;

// 更新签名者并重新初始化合约
export const updateSigner = async (newSigner: ethers.Signer) => {
  signer = newSigner;
  await initializeContracts();
};

// 初始化合约函数
const initializeContracts = async () => {
  try {
    if (signer) {
      lotteryTokenContract = new ethers.Contract(
        CONTRACT_ADDRESSES.lotteryToken,
        Array.isArray(LotteryTokenABI) ? LotteryTokenABI : LotteryTokenABI.abi,
        signer
      );

      lotteryTicketContract = new ethers.Contract(
        CONTRACT_ADDRESSES.lotteryTicket,
        Array.isArray(LotteryTicketABI) ? LotteryTicketABI : LotteryTicketABI.abi,
        signer
      );

      lotteryContract = new ethers.Contract(
        CONTRACT_ADDRESSES.lottery,
        Array.isArray(LotteryABI) ? LotteryABI : LotteryABI.abi,
        signer
      );
      
      console.log("合约初始化成功");
    }
  } catch (error) {
    console.error("合约初始化失败:", error);
  }
};

// 初始化Web3和Provider
export const initializeWeb3 = async () => {
  if (typeof window !== 'undefined' && window.ethereum) {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      await initializeContracts();
      return { signer, provider };
    } catch (error) {
      console.error("初始化Web3失败:", error);
      return null;
    }
  }
  return null;
};

// 如果页面加载后 provider 已经存在，延迟执行初始化
if (typeof window !== 'undefined' && window.ethereum) {
  // 确保在浏览器环境中执行
  if (typeof window !== 'undefined') {
    // 使用 setTimeout 确保在事件循环的下一个周期执行
    setTimeout(() => {
      initializeWeb3().catch(console.error);
    }, 0);
  }
}

export { 
  signer,
  lotteryTokenContract, 
  lotteryTicketContract, 
  lotteryContract
};