import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LotteryPage from '../../pages/LotteryPage';
import { ethers } from 'ethers';

describe('Airdrop Integration Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should complete full airdrop flow', async () => {
    // 模拟完整的空投流程
    const mockEthereum = {
      request: vi.fn().mockImplementation((req) => {
        switch (req.method) {
          case 'eth_requestAccounts':
            return Promise.resolve(['0x1234567890123456789012345678901234567890']);
          case 'eth_chainId':
            return Promise.resolve('0x7a69'); // 31337 for hardhat
          case 'net_version':
            return Promise.resolve('31337');
          default:
            return Promise.resolve();
        }
      }),
      on: vi.fn(), // 添加这个模拟
      removeListener: vi.fn() // 添加这个模拟
    };

    // @ts-ignore
    global.window = { ethereum: mockEthereum };
    
    // 定义全局alert函数
    global.alert = vi.fn();

    // 模拟合约交互
    const mockContracts = {
      lotteryTokenContract: {
        airdrop: vi.fn().mockResolvedValue({
          hash: '0x123',
          wait: vi.fn().mockResolvedValue({} as any)
        }),
        getAddress: vi.fn().mockResolvedValue('0xTokenAddress'),
        balanceOf: vi.fn().mockResolvedValue(ethers.parseEther('1000'))
      }
    };

    // 使用 vi.spyOn 来模拟合约
    vi.spyOn(require('../../utils/contracts'), 'lotteryTokenContract', 'get')
      .mockReturnValue(mockContracts.lotteryTokenContract as any);

    // 模拟 alert
    const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});

    try {
      render(<LotteryPage />);
      
      // 1. 连接钱包
      const connectButton = screen.getByText('连接钱包');
      fireEvent.click(connectButton);

      // 2. 等待连接完成
      await waitFor(() => {
        expect(screen.getByText('领取代币空投')).toBeInTheDocument();
      });

      // 3. 调用空投
      const airdropButton = screen.getByText('领取代币空投');
      fireEvent.click(airdropButton);

      // 4. 验证结果
      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('空投领取成功！');
      });
    } catch (error) {
      console.error('Integration test failed:', error);
      throw error;
    } finally {
      mockAlert.mockRestore();
    }
  });
});