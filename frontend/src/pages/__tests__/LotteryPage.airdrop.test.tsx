import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LotteryPage from '../LotteryPage';
import * as contracts from '../../utils/contracts';
import { ethers } from 'ethers';

// 模拟合约函数
const mockAirdrop = vi.fn();
const mockGetAddress = vi.fn();
const mockBalanceOf = vi.fn();

const mockLotteryTokenContract = {
  airdrop: mockAirdrop,
  getAddress: mockGetAddress,
  balanceOf: mockBalanceOf
};

describe('LotteryPage - Airdrop Functionality', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // 模拟 window.ethereum
    Object.defineProperty(window, 'ethereum', {
      value: {
        request: vi.fn().mockImplementation((req) => {
          if (req.method === 'eth_requestAccounts') return Promise.resolve(['0x123']);
          if (req.method === 'eth_chainId') return Promise.resolve('0x7a69');
          if (req.method === 'net_version') return Promise.resolve('31337');
          return Promise.resolve();
        })
      },
      writable: true
    });
    
    // 模拟合约
    vi.spyOn(contracts, 'lotteryTokenContract', 'get').mockReturnValue(mockLotteryTokenContract as any);
    vi.spyOn(contracts, 'lotteryTicketContract', 'get').mockReturnValue({} as any);
    vi.spyOn(contracts, 'lotteryContract', 'get').mockReturnValue({} as any);
    
    // 模拟 alert
    global.alert = vi.fn();
  });

  it('should render the airdrop button when wallet is connected', async () => {
    render(<LotteryPage />);
    
    // 点击连接钱包按钮
    const connectButton = screen.getByText('连接钱包');
    fireEvent.click(connectButton);
    
    // 等待钱包连接完成
    await waitFor(() => {
      expect(screen.getByText('领取代币空投')).toBeInTheDocument();
    });
  });

  it('should call airdrop function when airdrop button is clicked', async () => {
    mockAirdrop.mockResolvedValue({
      hash: '0x123',
      wait: vi.fn().mockResolvedValue({} as any)
    });
    
    mockGetAddress.mockResolvedValue('0xTokenAddress');
    
    render(<LotteryPage />);
    
    // 连接钱包
    fireEvent.click(screen.getByText('连接钱包'));
    await waitFor(() => {
      expect(screen.getByText('领取代币空投')).toBeInTheDocument();
    });
    
    // 点击空投按钮
    const airdropButton = screen.getByText('领取代币空投');
    fireEvent.click(airdropButton);
    
    // 验证调用了空投函数
    await waitFor(() => {
      expect(mockAirdrop).toHaveBeenCalled();
    });
  });

  it('should show alert when airdrop is successful', async () => {
    mockAirdrop.mockResolvedValue({
      hash: '0x123',
      wait: vi.fn().mockResolvedValue({} as any)
    });
    
    mockGetAddress.mockResolvedValue('0xTokenAddress');
    mockBalanceOf.mockResolvedValue(ethers.parseEther('1000'));
    
    render(<LotteryPage />);
    
    // 连接钱包
    fireEvent.click(screen.getByText('连接钱包'));
    await waitFor(() => {
      expect(screen.getByText('领取代币空投')).toBeInTheDocument();
    });
    
    // 点击空投按钮
    const airdropButton = screen.getByText('领取代币空投');
    fireEvent.click(airdropButton);
    
    // 验证显示成功提示
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('空投领取成功！');
    });
  });

  it('should show error when airdrop fails', async () => {
    mockAirdrop.mockRejectedValue(new Error('Transaction failed'));
    
    mockGetAddress.mockResolvedValue('0xTokenAddress');
    mockBalanceOf.mockResolvedValue(ethers.parseEther('1000'));
    
    render(<LotteryPage />);
    
    // 连接钱包
    fireEvent.click(screen.getByText('连接钱包'));
    await waitFor(() => {
      expect(screen.getByText('领取代币空投')).toBeInTheDocument();
    });
    
    // 点击空投按钮
    const airdropButton = screen.getByText('领取代币空投');
    fireEvent.click(airdropButton);
    
    // 验证显示错误提示
    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('领取空投失败: Transaction failed');
    });
  });
});