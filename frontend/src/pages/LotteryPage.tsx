import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  lotteryTokenContract,
  lotteryTicketContract,
  lotteryContract,
  updateSigner,
  initializeWeb3
} from '../utils/contracts';


const LotteryPage: React.FC = () => {
  const [account, setAccount] = useState<string>('');
  const [balance, setBalance] = useState<string>('0');
  const [currentPrizePool, setCurrentPrizePool] = useState<string>('0');
  const [lotteries, setLotteries] = useState<any[]>([]);
  const [userTickets, setUserTickets] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [newLottery, setNewLottery] = useState({
    name: '',
    choices: [''] as string[],
    prize: '',
    duration: ''
  });
  const [buyTicketData, setBuyTicketData] = useState({
    lotteryId: '',
    choiceIndex: 0,
    amount: ''
  });
  const [tradeData, setTradeData] = useState({
    tokenId: '',
    price: ''
  });

  useEffect(() => {
    const checkNetwork = async () => {
      if (window.ethereum) {
        try {
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          console.log("当前网络 Chain ID:", chainId);
          
          if (chainId !== '0x7a69') {
            alert("请切换到 Hardhat 本地网络 (Chain ID: 31337)");
          }
        } catch (error) {
          console.error("检查网络失败:", error);
        }
      }
    };

    checkNetwork();
    
    // 监听网络变化
    if (window.ethereum && typeof window.ethereum.on === 'function') {
      const handleChainChanged = (_chainId: string) => {
        console.log("网络已切换到:", _chainId);
        window.location.reload();
      };
      
      window.ethereum.on('chainChanged', handleChainChanged);
      
      // 组件卸载时移除监听器
      return () => {
        if (typeof window.ethereum.removeListener === 'function') {
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  // 检查并重新初始化合约
  const checkAndReinitialize = async () => {
  try {
    if (typeof window !== 'undefined' && window.ethereum) {
      const newProvider = new ethers.BrowserProvider(window.ethereum);
      const newSigner = await newProvider.getSigner();
      
      // 更新签名者并重新初始化合约
      await updateSigner(newSigner);
      
      console.log("合约重新初始化完成");
    }
  } catch (error) {
    console.error("重新初始化合约失败:", error);
  }
};

  // 连接钱包
  const connectWallet = async () => {
  if (window.ethereum) {
    try {
      // 请求切换到 Hardhat 网络
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x7a69' }], // 31337 的十六进制表示
        });
      } catch (switchError: any) {
        // 如果网络不存在，添加它
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x7a69',
                  chainName: 'Hardhat Local',
                  rpcUrls: ['http://127.0.0.1:8545'],
                  nativeCurrency: {
                    name: 'ETH',
                    symbol: 'ETH',
                    decimals: 18
                  },
                  blockExplorerUrls: null
                }
              ]
            });
          } catch (addError) {
            console.error('添加网络失败:', addError);
          }
        } else {
          console.error('切换网络失败:', switchError);
        }
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);
      
      // 重新初始化合约
      await checkAndReinitialize();
      loadAccountData(accounts[0]);
      loadUserTickets(); 
    } catch (error: any) {
      console.error("连接钱包失败:", error);
      if (error.code === 4001) {
        alert("用户拒绝了连接请求");
      } else {
        alert("连接钱包失败: " + (error.message || error));
      }
    }
  } else {
    alert("请安装MetaMask钱包！");
  }
};

// 加载账户数据
const loadAccountData = async (address: string) => {
  if (!lotteryTokenContract) {
    console.error("lotteryTokenContract未初始化");
    return;
  }
  
  try {
    // 先检查合约是否可访问
    const contractAddress = await lotteryTokenContract.getAddress();
    console.log("LotteryToken 合约地址:", contractAddress);
    
    // 检查网络连接
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const code = await provider.getCode(contractAddress);
      if (code === '0x') {
        console.error("合约地址上没有部署合约代码");
        setBalance('0');
        return;
      }
    }
    
    const balance = await lotteryTokenContract.balanceOf(address);
    if (balance !== null && balance !== undefined) {
      setBalance(ethers.formatEther(balance));
    } else {
      setBalance('0');
    }
  } catch (error: any) {
    console.error("加载账户数据失败:", error);
    console.error("错误类型:", error.code);
    console.error("错误消息:", error.message);
    
    // 根据不同错误类型提供具体信息
    if (error.code === 'CALL_EXCEPTION') {
      console.error("可能是合约未正确部署或地址错误");
    } else if (error.message && error.message.includes('missing revert data')) {
      console.error("合约调用失败，可能的原因：");
      console.error("1. 合约未正确部署");
      console.error("2. 网络连接问题");
      console.error("3. 合约地址不正确");
    }
    
    setBalance('0');
  }
};

// 获取用户持有的彩票
const loadUserTickets = async () => {
  if (!lotteryTicketContract || !lotteryContract || !account) {
    console.log("合约未初始化或未连接钱包");
    return;
  }

  try {
    console.log("开始获取用户持有的彩票...");
    
    // 获取用户拥有的彩票数量
    const balance = await lotteryTicketContract.balanceOf(account);
    console.log("用户持有的彩票数量:", balance.toString());
    
    const tickets = [];
    
    // 遍历用户持有的每个彩票
    for (let i = 0; i < Number(balance); i++) {
      try {
        // 获取用户持有的第 i 个彩票的 token ID
        const tokenId = await lotteryTicketContract.tokenOfOwnerByIndex(account, i);
        console.log(`获取第 ${i} 个彩票，Token ID:`, tokenId.toString());
        
        // 获取彩票详细信息
        const ticketInfo = await lotteryTicketContract.ticketInfos(tokenId);
        console.log(`Token ID ${tokenId.toString()} 的信息:`, ticketInfo);
        
        // 获取对应的彩票项目信息
        const lotteryInfo = await lotteryContract.getLotteryInfo(ticketInfo.lotteryId);
        console.log(`彩票项目 ${ticketInfo.lotteryId.toString()} 的信息:`, lotteryInfo);
        
        // 获取选项文本
        let choiceText = "未知选项";
        if (Array.isArray(lotteryInfo[1]) && ticketInfo.choiceIndex < lotteryInfo[1].length) {
          choiceText = lotteryInfo[1][Number(ticketInfo.choiceIndex)];
        }
        
        tickets.push({
          tokenId: tokenId.toString(),
          lotteryId: ticketInfo.lotteryId.toString(),
          choiceIndex: ticketInfo.choiceIndex.toString(),
          choiceText: choiceText,
          amount: ethers.formatEther(ticketInfo.amount),
          lotteryName: lotteryInfo[0]
        });
      } catch (innerError) {
        console.error(`获取第 ${i} 个彩票时出错:`, innerError);
      }
    }
    
    console.log("用户持有的彩票列表:", tickets);
    setUserTickets(tickets);
  } catch (error) {
    console.error("获取用户彩票失败:", error);
  }
};
  // 领取代币空投
  const claimAirdrop = async () => {
  console.log("尝试调用空投函数...");
  console.log("lotteryTokenContract:", lotteryTokenContract);
  
  if (!lotteryTokenContract) {
    console.error("合约未初始化");
    alert("合约未初始化！请确保已连接钱包并切换到正确的网络。");
    return;
  }
  
  if (!account) {
    console.error("未连接钱包");
    alert("请先连接钱包！");
    return;
  }

  // 添加网络状态检查 - 改进错误处理
  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log("当前Chain ID:", chainId);
    
    const networkVersion = await window.ethereum.request({ method: 'net_version' });
    console.log("当前网络版本:", networkVersion);
    
    // 获取区块号来确认网络连接状态 - 添加更好的错误处理
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const blockNumber = await provider.getBlockNumber();
      console.log("当前区块号:", blockNumber);
    } catch (blockError) {
      console.warn("无法获取区块号，但继续执行:", blockError);
      // 不中断流程，继续执行
    }
  } catch (networkError) {
    console.error("网络检查失败:", networkError);
    // 不中断空投领取流程
  }

  try {
    console.log("正在调用空投函数...");
    // 添加更多调试信息
    console.log("合约地址:", await lotteryTokenContract.getAddress());
    console.log("当前账户:", account);
    
    const tx = await lotteryTokenContract.airdrop();
    console.log("交易已发送，等待确认...", tx.hash);
    const receipt = await tx.wait();
    console.log("交易确认:", receipt);
    alert("空投领取成功！");
    loadAccountData(account);
  } catch (error: any) {
    console.error("领取空投失败:", error);
    console.error("错误详情:", {
      code: error.code,
      message: error.message,
      data: error.data
    });
    
    // 根据错误类型提供更具体的错误信息
    if (error.code === 4001) {
      alert("用户拒绝了交易签名");
    } else if (error.code === -32603) {
      alert("内部错误，请检查网络连接或尝试重新连接钱包");
    } else {
      alert(`领取空投失败: ${error.message || error}`);
    }
  }
};

  // 修改创建彩票函数
const createLottery = async () => {
  console.log("尝试创建彩票项目...");
  console.log("lotteryTokenContract:", lotteryTokenContract);
  console.log("lotteryContract:", lotteryContract);
  console.log("newLottery:", newLottery);
  
  if (!lotteryTokenContract || !lotteryContract) {
    console.error("合约未初始化");
    alert("合约未初始化！请确保已连接钱包并切换到正确的网络。");
    return;
  }
  
  if (!account) {
    console.error("未连接钱包");
    alert("请先连接钱包！");
    return;
  }

  try {
    // 检查输入数据
    if (!newLottery.name || !newLottery.prize || !newLottery.duration) {
      alert("请填写所有必填字段！");
      return;
    }
    
    const validChoices = newLottery.choices.filter(choice => choice !== '');
    if (validChoices.length < 2) {
      alert("至少需要填写两个选项！");
      return;
    }

    console.log("正在授权代币...");
    const approveAmount = ethers.parseEther(newLottery.prize);
    console.log("授权金额:", approveAmount.toString());
    
    const tx = await lotteryTokenContract.approve(
      await lotteryContract.getAddress(),
      approveAmount
    );
    console.log("授权交易已发送，等待确认...", tx.hash);
    const receipt1 = await tx.wait();
    console.log("授权交易确认:", receipt1);

    console.log("正在创建彩票...");
    const totalPrize = ethers.parseEther(newLottery.prize);
    const duration = parseInt(newLottery.duration) * 3600; // 转换为秒
    
    console.log("参数:", {
      name: newLottery.name,
      choices: validChoices,
      totalPrize: totalPrize.toString(),
      duration: duration
    });

    const tx2 = await lotteryContract.createLottery(
      newLottery.name,
      validChoices,
      totalPrize,
      duration
    );
    console.log("创建彩票交易已发送，等待确认...", tx2.hash);
    const receipt2 = await tx2.wait();
    console.log("创建彩票交易确认:", receipt2);
    
    alert("彩票项目创建成功！");
    loadLotteries();
  } catch (error: any) {
    console.error("创建彩票项目失败:", error);
    console.error("错误详情:", {
      code: error.code,
      message: error.message,
      data: error.data,
      stack: error.stack
    });
    
    // 根据错误类型提供更具体的错误信息
    if (error.code === 4001) {
      alert("用户拒绝了交易签名");
    } else if (error.code === -32603) {
      alert("内部错误，请检查网络连接或尝试重新连接钱包");
    } else {
      alert(`创建彩票项目失败: ${error.message || error}`);
    }
  }
};


  // 修改加载彩票列表函数
const loadLotteries = async () => {
  console.log("=== 开始加载彩票项目 ===");
  
  if (!lotteryContract) {
    console.error("lotteryContract未初始化");
    return;
  }
  
  try {
    console.log("正在获取彩票项目数量...");
    const lotteryCount = await lotteryContract.nextLotteryId();
    console.log("彩票项目总数:", lotteryCount.toString());
    
    const lotteriesList = [];
    const count = Number(lotteryCount);
    console.log("需要加载的项目ID范围: 1 到", count - 1);
    
    // 从ID 1开始遍历（ID 0通常不使用）
    for (let i = 1; i < count; i++) {
      console.log(`\n--- 尝试加载彩票项目 ${i} ---`);
      
      try {
        // 首先检查彩票项目是否存在
        console.log("正在检查彩票项目是否存在...");
        const lotteryExists = await lotteryContract.lotteries(i);
        console.log("彩票项目基础信息:", lotteryExists);
        
        // 检查name字段是否存在且非空
        if (lotteryExists && lotteryExists.name) {
          console.log("项目名称:", lotteryExists.name);
          if (lotteryExists.name === "") {
            console.log(`彩票项目 ${i} 名称为空，跳过`);
            continue;
          }
        } else {
          console.log(`彩票项目 ${i} 不存在或名称为空，跳过`);
          continue;
        }
        
        // 使用 getLotteryInfo 获取详细信息
        console.log("正在调用 getLotteryInfo 函数...");
        const lotteryInfo = await lotteryContract.getLotteryInfo(i);
        console.log("getLotteryInfo 返回的原始数据:", lotteryInfo);
        
        // 详细检查返回的每个字段
        console.log("返回数据字段检查:");
        console.log("- name:", lotteryInfo[0]);
        console.log("- choices:", lotteryInfo[1]);
        console.log("- totalPrize:", lotteryInfo[2]?.toString());
        console.log("- endTime:", lotteryInfo[3]?.toString());
        console.log("- winningChoice:", lotteryInfo[4]?.toString());
        console.log("- isFinished:", lotteryInfo[5]);
        console.log("- isResultDeclared:", lotteryInfo[6]);
        console.log("- creator:", lotteryInfo[7]);
        
        // 验证关键字段
        if (!lotteryInfo[0] || lotteryInfo[0] === "") {
          console.warn(`彩票项目 ${i} 名称为空，跳过`);
          continue;
        }
        
        // 处理时间数据
        let endTimeFormatted = "未知";
        try {
          const endTimeMs = Number(lotteryInfo[3]) * 1000;
          if (!isNaN(endTimeMs) && endTimeMs > 0) {
            endTimeFormatted = new Date(endTimeMs).toLocaleString();
          }
        } catch (timeError) {
          console.warn("时间格式化失败:", timeError);
        }
        
        // 处理选择项
        let choicesArray = [];
        try {
          choicesArray = Array.isArray(lotteryInfo[1]) ? lotteryInfo[1] : [];
        } catch (choiceError) {
          console.warn("选择项处理失败:", choiceError);
        }
        
        const lotteryItem = {
          id: i,
          name: lotteryInfo[0] || '未知项目',
          choices: choicesArray,
          totalPrize: ethers.formatEther(lotteryInfo[2] || 0),
          endTime: endTimeFormatted,
          winningChoice: lotteryInfo[4]?.toString() || '0',
          isFinished: Boolean(lotteryInfo[5]),
          isResultDeclared: Boolean(lotteryInfo[6]),
          creator: lotteryInfo[7] || ''
        };
        
        console.log("处理后的彩票项目数据:", lotteryItem);
        lotteriesList.push(lotteryItem);
        
      } catch (innerError: any) {
        console.error(`加载彩票项目 ${i} 时发生错误:`, innerError);
        console.error("错误详情:", {
          message: innerError.message,
          code: innerError.code,
          data: innerError.data,
          stack: innerError.stack
        });
        
        // 如果是ABI解码错误，输出更详细的信息
        if (innerError.message && innerError.message.includes("ABI decoding")) {
          console.error("ABI解码错误，可能的原因:");
          console.error("1. 合约ABI与实际部署的合约不匹配");
          console.error("2. 合约函数返回值结构发生变化");
          console.error("3. 前端使用的ABI文件不是最新的");
        }
      }
    }
    
    console.log("最终加载的彩票项目列表:", lotteriesList);
    setLotteries(lotteriesList);
    console.log("=== 彩票项目加载完成 ===");
    
  } catch (error: any) {
    console.error("=== 加载彩票项目列表失败 ===");
    console.error("错误信息:", error);
    console.error("错误详情:", {
      message: error.message,
      code: error.code,
      data: error.data,
      stack: error.stack
    });
  }
};

const debugContractState = async () => {
  console.log("=== 开始调试合约状态 ===");
  
  if (!lotteryContract) {
    console.error("lotteryContract未初始化");
    return;
  }
  
  try {
    // 检查合约地址
    const contractAddress = await lotteryContract.getAddress();
    console.log("彩票合约地址:", contractAddress);
    
    // 检查nextLotteryId
    const nextLotteryId = await lotteryContract.nextLotteryId();
    console.log("下一个彩票项目ID:", nextLotteryId.toString());
    
    // 检查合约所有者
    const owner = await lotteryContract.owner();
    console.log("合约所有者:", owner);
    
    // 检查LotteryToken合约地址
    if (lotteryContract.lotteryToken) {
      try {
        const tokenAddress = await lotteryContract.lotteryToken();
        console.log("彩票代币合约地址:", tokenAddress);
      } catch (e) {
        console.log("无法获取彩票代币合约地址:", e);
      }
    }
    
    // 检查LotteryTicket合约地址
    if (lotteryContract.lotteryTicket) {
      try {
        const ticketAddress = await lotteryContract.lotteryTicket();
        console.log("彩票NFT合约地址:", ticketAddress);
      } catch (e) {
        console.log("无法获取彩票NFT合约地址:", e);
      }
    }
    
    console.log("=== 合约状态调试完成 ===");
  } catch (error) {
    console.error("=== 合约状态调试失败 ===");
    console.error(error);
  }
};

// 添加结束彩票函数
const finishLottery = async (lotteryId: number) => {
  if (!lotteryContract) {
    console.error("合约未初始化");
    alert("合约未初始化！");
    return;
  }
  
  try {
    const tx = await lotteryContract.finishLottery(lotteryId);
    await tx.wait();
    alert("彩票项目已结束！");
    loadLotteries(); // 重新加载列表
  } catch (error: any) {
    console.error("结束彩票失败:", error);
    if (error.code === 4001) {
      alert("用户拒绝了交易签名");
    } else {
      alert(`结束彩票失败: ${error.message || error}`);
    }
  }
};

// 添加开奖函数
const declareResult = async (lotteryId: number, winningChoice: number) => {
  if (!lotteryContract) {
    console.error("合约未初始化");
    alert("合约未初始化！");
    return;
  }
  
  try {
    const tx = await lotteryContract.declareResult(lotteryId, winningChoice);
    await tx.wait();
    alert("开奖结果已公布！");
    loadLotteries(); // 重新加载列表
  } catch (error: any) {
    console.error("开奖失败:", error);
    if (error.code === 4001) {
      alert("用户拒绝了交易签名");
    } else {
      alert(`开奖失败: ${error.message || error}`);
    }
  }
};

//检查彩票状态
const checkLotteryStatus = async (lotteryId: number) => {
  if (!lotteryContract) return null;
  
  try {
    const lotteryInfo = await lotteryContract.getLotteryInfo(lotteryId);
    // 处理 BigInt 转换
    const endTimeMs = Number(lotteryInfo.endTime) * 1000;
    const currentTimeMs = Date.now();
    
    return {
      isFinished: lotteryInfo.isFinished,
      isExpired: endTimeMs < currentTimeMs,
      endTime: new Date(endTimeMs).toLocaleString()
    };
  } catch (error) {
    console.error("检查彩票状态失败:", error);
    return null;
  }
};

const loadCurrentPrizePool = async () => {
  if (!lotteryContract) return;
  
  try {
    const prizePool = await lotteryContract.getCurrentPrizePool();
    setCurrentPrizePool(ethers.formatEther(prizePool));
  } catch (error) {
    console.error("加载奖池金额失败:", error);
  }
};

// 在组件挂载时加载奖池金额
useEffect(() => {
  loadLotteries();
  loadCurrentPrizePool();
}, []);

  // 购买彩票函数
const buyTicket = async () => {
  if (!lotteryTokenContract || !lotteryContract) {
    console.error("合约未初始化");
    alert("合约未初始化！请确保已连接钱包并切换到正确的网络。");
    return;
  }
  
  if (!buyTicketData.lotteryId || buyTicketData.choiceIndex === undefined || !buyTicketData.amount) {
    alert("请填写完整的购买信息！");
    return;
  }

  try {
    const lotteryId = parseInt(buyTicketData.lotteryId);
    const choiceIndex = buyTicketData.choiceIndex;
    const amountInWei = ethers.parseEther(buyTicketData.amount);
    
    console.log("正在检查彩票状态...");
    // 检查彩票状态
    const lotteryInfo = await lotteryContract.getLotteryInfo(lotteryId);
    
    // 添加数据验证
    if (!lotteryInfo) {
      alert("无法获取彩票信息");
      return;
    }
    
    console.log("彩票信息:", {
      id: lotteryId,
      name: lotteryInfo.name || '未知',
      isFinished: Boolean(lotteryInfo.isFinished),
      endTime: new Date(Number(lotteryInfo.endTime || 0) * 1000).toLocaleString(),
      choices: Array.isArray(lotteryInfo.choices) ? lotteryInfo.choices : [],
      currentTime: new Date().toLocaleString()
    });
    
    if (lotteryInfo.isFinished) {
      alert("彩票已经结束，无法购买");
      return;
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime >= Number(lotteryInfo.endTime || 0)) {
      alert("彩票已过期，无法购买");
      return;
    }
    
    if (!Array.isArray(lotteryInfo.choices) || choiceIndex >= lotteryInfo.choices.length) {
      alert(`无效的选择索引。请选择 0 到 ${(lotteryInfo.choices?.length || 1) - 1} 之间的值`);
      return;
    }
    
    if (amountInWei <= 0) {
      alert("购买金额必须大于0");
      return;
    }

    console.log("正在检查用户余额...");
    // 检查用户余额
    const userBalance = await lotteryTokenContract.balanceOf(account);
    console.log("用户余额:", ethers.formatEther(userBalance));
    console.log("购买金额:", buyTicketData.amount);
    
    if (userBalance < amountInWei) {
      alert(`余额不足！你需要 ${buyTicketData.amount} LTK，但你只有 ${ethers.formatEther(userBalance)} LTK`);
      return;
    }

    console.log("正在授权代币...");
    const lotteryAddress = await lotteryContract.getAddress();
    console.log("彩票合约地址:", lotteryAddress);
    
    // 检查当前授权额度
    const currentAllowance = await lotteryTokenContract.allowance(account, lotteryAddress);
    console.log("当前授权额度:", ethers.formatEther(currentAllowance));
    
    if (currentAllowance < amountInWei) {
      console.log("需要重新授权...");
      const approveTx = await lotteryTokenContract.approve(
        lotteryAddress,
        amountInWei
      );
      console.log("授权交易已发送，等待确认...", approveTx.hash);
      await approveTx.wait();
      console.log("授权完成");
    }

    // 等待一小段时间确保链上状态更新
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("正在购买彩票...");
    console.log("购买参数:", {
      lotteryId,
      choiceIndex,
      amount: amountInWei.toString()
    });
    
    const tx = await lotteryContract.buyTicket(
      lotteryId,
      choiceIndex,
      amountInWei
    );
    console.log("购买彩票交易已发送，等待确认...", tx.hash);
    const receipt = await tx.wait();
    console.log("购买彩票交易确认:", receipt);
    alert("彩票购买成功！");
    loadUserTickets();
    
    // 清空表单
    setBuyTicketData({
      lotteryId: '',
      choiceIndex: 0,
      amount: ''
    });
    
    // 重新加载账户数据
    if (account) {
      loadAccountData(account);
    }
    loadCurrentPrizePool();
  } catch (error: any) {
    console.error("购买彩票失败:", error);
    console.error("错误详情:", {
      code: error.code,
      message: error.message,
      data: error.data,
      stack: error.stack
    });
    
    // 根据错误类型提供更具体的错误信息
    if (error.code === 4001) {
      alert("用户拒绝了交易签名");
    } else if (error.code === -32603) {
      alert("内部错误，请检查以下几点：\n1. 确保你有足够的代币余额\n2. 确保彩票仍在进行中\n3. 检查网络连接\n4. 尝试重新连接钱包");
    } else if (error.message && error.message.includes("Lottery is finished")) {
      alert("彩票已经结束，无法购买");
    } else if (error.message && error.message.includes("Lottery is expired")) {
      alert("彩票已过期，无法购买");
    } else if (error.message && error.message.includes("Invalid choice")) {
      alert("无效的选择索引");
    } else if (error.message && error.message.includes("Transfer failed")) {
      alert("代币转账失败，请检查余额是否充足");
    } else if (error.message && error.message.includes("Amount must be greater than 0")) {
      alert("购买金额必须大于0");
    } else if (error.message && error.message.includes("Insufficient token balance")) {
      alert("代币余额不足");
    } else {
      alert(`购买彩票失败: ${error.message || error}`);
    }
  }
};
  // 挂单出售彩票
  const placeOrder = async () => {
    if (!lotteryTicketContract || !lotteryContract) {
      console.error("合约未初始化");
      alert("合约未初始化！请确保已连接钱包并切换到正确的网络。");
      return;
    }
    
    try {
      const tx = await lotteryTicketContract.approve(
        await lotteryContract.getAddress(),
        tradeData.tokenId
      );
      await tx.wait();

      const tx2 = await lotteryContract.placeOrder(
        tradeData.tokenId,
        ethers.parseEther(tradeData.price)
      );
      await tx2.wait();
      alert("挂单成功！");
      loadUserTickets();
    } catch (error: any) {
      console.error("挂单失败:", error);
      if (error.code === 4001) {
        alert("用户拒绝了交易签名");
      } else {
        alert("挂单失败: " + (error.message || error));
      }
    }
  };

  // 加载订单簿
  const loadOrderBook = async (lotteryId: number) => {
    if (!lotteryContract) {
      console.error("lotteryContract未初始化");
      return;
    }
    
    try {
      const orderBook = await lotteryContract.getOrderBook(lotteryId);
      setOrders(orderBook);
    } catch (error) {
      console.error("加载订单簿失败:", error);
    }
  };

  // 购买订单中的彩票
const buyOrder = async (order: any, orderId: number) => {
  if (!lotteryContract || !lotteryTokenContract || !account) {
    alert("请先连接钱包！");
    return;
  }

  // 添加对 lotteryTicketContract 的空值检查
  if (!lotteryTicketContract) {
    alert("合约未初始化！");
    return;
  }

  try {
    // 获取彩票信息以获取 lotteryId
    const ticketInfo = await lotteryTicketContract.ticketInfos(order.tokenId);
    const lotteryId = Number(ticketInfo.lotteryId);
    
    // 授权代币转账
    const lotteryAddress = await lotteryContract.getAddress();
    const priceInWei = BigInt(order.price);
    
    const currentAllowance = await lotteryTokenContract.allowance(account, lotteryAddress);
    if (currentAllowance < priceInWei) {
      const approveTx = await lotteryTokenContract.approve(lotteryAddress, priceInWei);
      await approveTx.wait();
    }

    // 调用合约的buyOrder方法
    const tx = await lotteryContract.buyOrder(
      BigInt(lotteryId),
      BigInt(orderId)
    );
    await tx.wait();
    alert("购买成功！");
    loadUserTickets(); // 刷新用户持有的彩票
    loadOrderBook(lotteryId); // 刷新订单簿
  } catch (error: any) {
    console.error("购买失败:", error);
    if (error.code === 4001) {
      alert("用户拒绝了交易签名");
    } else {
      alert(`购买失败: ${error.message || error}`);
    }
  }
};

  // 添加选项
  const addChoice = () => {
    setNewLottery({
      ...newLottery,
      choices: [...newLottery.choices, '']
    });
  };

  // 更新选项
  const updateChoice = (index: number, value: string) => {
    const newChoices = [...newLottery.choices];
    newChoices[index] = value;
    setNewLottery({
      ...newLottery,
      choices: newChoices
    });
  };

  // 组件挂载时加载数据
  useEffect(() => {
    loadLotteries();
  }, []);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>去中心化彩票系统</h1>
      
      {/* 钱包连接区域 */}
      <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
        <h2>钱包连接</h2>
        {account ? (
          <div>
            <p>已连接账户: {account}</p>
            <p>代币余额: {balance} LTK</p>
            <button onClick={claimAirdrop}>领取代币空投</button>
          </div>
        ) : (
          <button onClick={connectWallet}>连接钱包</button>
        )}
      </div>

      {/* 创建彩票项目（仅管理员） */}
      <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
        <h2>创建彩票项目（管理员）</h2>
        <div>
          <p>项目名称: <input 
            type="text" 
            value={newLottery.name}
            onChange={(e) => setNewLottery({...newLottery, name: e.target.value})}
          /></p>
          
          <p>总奖金 (LTK): <input 
            type="text" 
            value={newLottery.prize}
            onChange={(e) => setNewLottery({...newLottery, prize: e.target.value})}
          /></p>
          
          <p>持续时间 (小时): <input 
            type="text" 
            value={newLottery.duration}
            onChange={(e) => setNewLottery({...newLottery, duration: e.target.value})}
          /></p>
          
          <h3>选项:</h3>
          {newLottery.choices.map((choice, index) => (
            <p key={index}>
              选项 {index + 1}: <input 
                type="text" 
                value={choice}
                onChange={(e) => updateChoice(index, e.target.value)}
              />
            </p>
          ))}
          <button onClick={addChoice}>添加选项</button>
          
          <br/><br/>
          <button onClick={createLottery}>创建彩票项目</button>
        </div>
      </div>

      {/* 彩票项目列表 */}
      <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
        <h2>彩票项目列表</h2>
        <button onClick={loadLotteries}>刷新列表</button>
        {lotteries.map((lottery) => (
          <div key={lottery.id} style={{ border: '1px solid #eee', padding: '10px', margin: '10px 0' }}>
            <h3>{lottery.name} (ID: {lottery.id})</h3>
            <p>初始奖金: {lottery.totalPrize} LTK</p>
            <p>当前奖池余额: {currentPrizePool} LTK</p>
            <p>结束时间: {lottery.endTime}</p>
            <p>状态: {lottery.isFinished ? '已结束' : '进行中'} {lottery.isResultDeclared ? '(已开奖)' : ''}</p>
            
            <h4>选项:</h4>
            <ul>
              {lottery.choices.map((choice: string, index: number) => (
                <li key={index}>
                  {index}: {choice} 
                  {lottery.isResultDeclared && lottery.winningChoice === index.toString() ? '(获胜)' : ''}
                </li>
              ))}
            </ul>
            
            {/* 添加操作按钮 */}
            {!lottery.isFinished && (
              <div>
                <div>
                  <label>选择获胜选项: </label>
                  <select id={`winningChoice-${lottery.id}`}>
                    {lottery.choices.map((choice: string, index: number) => (
                      <option key={index} value={index}>{index}: {choice}</option>
                    ))}
                  </select>
                  <button onClick={() => {
                    const selectElement = document.getElementById(`winningChoice-${lottery.id}`) as HTMLSelectElement;
                    const winningChoice = parseInt(selectElement.value);
                    declareResult(lottery.id, winningChoice);
                  }}>开奖</button>
                </div>
              </div>
            )}
            
            <button onClick={() => loadOrderBook(lottery.id)}>查看订单簿</button>
          </div>
        ))}
      </div>

      {/* 购买彩票 */}
      <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
        <h2>购买彩票</h2>
        <p>彩票项目ID: <input 
          type="text" 
          value={buyTicketData.lotteryId}
          onChange={(e) => setBuyTicketData({...buyTicketData, lotteryId: e.target.value})}
        /></p>
        
        <p>选择选项: <input 
          type="number" 
          value={buyTicketData.choiceIndex}
          onChange={(e) => setBuyTicketData({...buyTicketData, choiceIndex: parseInt(e.target.value) || 0})}
        /></p>
        
        <p>购买金额 (LTK): <input 
          type="text" 
          value={buyTicketData.amount}
          onChange={(e) => setBuyTicketData({...buyTicketData, amount: e.target.value})}
        /></p>
        
        <button onClick={buyTicket}>购买彩票</button>
      </div>

      {/* 用户持有的彩票 */}
      <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
        <h2>我持有的彩票</h2>
        <button onClick={loadUserTickets}>刷新彩票列表</button>
        {userTickets.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>彩票ID</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>彩票项目</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>选择选项</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>购买金额 (LTK)</th>
              </tr>
            </thead>
            <tbody>
              {userTickets.map((ticket, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{ticket.tokenId}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{ticket.lotteryName} (#{ticket.lotteryId})</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{ticket.choiceText} (#{ticket.choiceIndex})</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{ticket.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ marginTop: '10px' }}>暂无持有的彩票</p>
        )}
      </div>

      {/* 交易彩票 */}
      <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
        <h2>交易彩票</h2>
        <p>彩票ID: <input 
          type="text" 
          value={tradeData.tokenId}
          onChange={(e) => setTradeData({...tradeData, tokenId: e.target.value})}
        /></p>
        
        <p>出售价格 (LTK): <input 
          type="text" 
          value={tradeData.price}
          onChange={(e) => setTradeData({...tradeData, price: e.target.value})}
        /></p>
        
        <button onClick={placeOrder}>挂单出售</button>
      </div>

      {/* 订单簿 */}
      <div style={{ border: '1px solid #ccc', padding: '20px' }}>
        <h2>订单簿</h2>
        {orders.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>订单ID</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>彩票ID</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>卖家</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>价格 (LTK)</th>
                <th style={{ border: '1px solid #ccc', padding: '8px' }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order: any, index: number) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{index}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{order.tokenId.toString()}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{order.seller}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                    {ethers.formatEther(order.price)}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                    {order.active ? '有效' : '已取消'}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>
                    {order.active && order.seller !== account && (
                      <button onClick={() => buyOrder(order, index)}>
                        购买
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>暂无订单</p>
        )}
      </div>
    </div>
  );
};

export default LotteryPage;