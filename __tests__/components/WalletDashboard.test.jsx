/**
 * Component tests for WalletDashboard
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WalletDashboard from '@/components/WalletDashboard';

// Mock the stellar utilities
jest.mock('@/utils/stellar/index', () => ({
  getContractTTLs: jest.fn(),
  getTransferHistory: jest.fn(),
  getMnemonic: jest.fn(),
  bumpInstanceTTL: jest.fn(),
  bumpCodeTTL: jest.fn(),
  bumpBalanceTTL: jest.fn(),
}));

// Mock config
jest.mock('@/utils/config', () => ({
  __esModule: true,
  default: {
    isTestnet: true,
    stellar: {
      network: 'testnet',
      explorerUrl: 'https://stellar.expert/explorer/testnet',
    },
  },
}));

const defaultProps = {
  publicKey: 'GABC...XYZ',
  walletAddress: 'CABC...XYZ',
  balance: '100',
  classicBalance: '50',
  onSendXLM: jest.fn(),
  onClassicSend: jest.fn(),
  onRefreshBalances: jest.fn(),
  onReset: jest.fn(),
  onFundAccount: jest.fn(),
  onCreateWallet: jest.fn(),
  onImportWallet: jest.fn(),
  loading: false,
  creatingWallet: false,
  lastUpdated: Date.now(),
};

describe('WalletDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('No wallet state', () => {
    it('shows generate wallet link when no wallet exists', () => {
      render(<WalletDashboard {...defaultProps} walletAddress={null} publicKey={null} />);

      expect(screen.getByText('generate wallet')).toBeInTheDocument();
      expect(screen.getByText('import')).toBeInTheDocument();
    });

    it('calls onCreateWallet when generate is clicked', () => {
      const onCreateWallet = jest.fn();
      render(
        <WalletDashboard
          {...defaultProps}
          walletAddress={null}
          publicKey={null}
          onCreateWallet={onCreateWallet}
        />
      );

      fireEvent.click(screen.getByText('generate wallet'));
      expect(onCreateWallet).toHaveBeenCalled();
    });

    it('shows import modal when import is clicked', () => {
      render(<WalletDashboard {...defaultProps} walletAddress={null} publicKey={null} />);

      fireEvent.click(screen.getByText('import'));
      expect(screen.getByText('import wallet')).toBeInTheDocument();
      expect(screen.getByLabelText('recovery phrase')).toBeInTheDocument();
    });
  });

  describe('Wallet exists state', () => {
    it('displays wallet address', () => {
      render(<WalletDashboard {...defaultProps} />);

      // Should show shortened address
      expect(screen.getByText(/CABC/)).toBeInTheDocument();
    });

    it('displays balance', () => {
      render(<WalletDashboard {...defaultProps} />);

      expect(screen.getByText('100 XLM')).toBeInTheDocument();
      expect(screen.getByText('50 XLM')).toBeInTheDocument();
    });

    it('shows action links', () => {
      render(<WalletDashboard {...defaultProps} />);

      expect(screen.getAllByText('receive')).toHaveLength(2);
      expect(screen.getAllByText('send')).toHaveLength(2);
      expect(screen.getAllByText('explore')).toHaveLength(2);
    });

    it('shows fund link on testnet with zero balance', () => {
      render(<WalletDashboard {...defaultProps} balance="0" classicBalance="0" />);

      expect(screen.getByText('fund')).toBeInTheDocument();
    });

    it('hides fund link when has balance', () => {
      render(<WalletDashboard {...defaultProps} />);

      expect(screen.queryByText('fund')).not.toBeInTheDocument();
    });
  });

  describe('Send modal', () => {
    it('opens send modal for contract account', () => {
      render(<WalletDashboard {...defaultProps} />);

      // Click the second "send" link (contract account)
      const sendLinks = screen.getAllByText('send');
      fireEvent.click(sendLinks[1]);

      expect(screen.getByText('send xlm (contract account)')).toBeInTheDocument();
    });

    it('opens send modal for classic account', () => {
      render(<WalletDashboard {...defaultProps} />);

      // Click the first "send" link (classic account)
      const sendLinks = screen.getAllByText('send');
      fireEvent.click(sendLinks[0]);

      expect(screen.getByText('send xlm (classic account)')).toBeInTheDocument();
    });

    it('shows available balance in send modal', () => {
      render(<WalletDashboard {...defaultProps} />);

      const sendLinks = screen.getAllByText('send');
      fireEvent.click(sendLinks[1]);

      expect(screen.getByText('available: 100 xlm')).toBeInTheDocument();
    });
  });

  describe('Refresh functionality', () => {
    it('calls onRefreshBalances when refresh is clicked', async () => {
      const onRefreshBalances = jest.fn().mockResolvedValue(true);
      render(<WalletDashboard {...defaultProps} onRefreshBalances={onRefreshBalances} />);

      fireEvent.click(screen.getByText('refresh'));

      await waitFor(() => {
        expect(onRefreshBalances).toHaveBeenCalled();
      });
    });

    it('shows refreshing state', async () => {
      const onRefreshBalances = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      render(<WalletDashboard {...defaultProps} onRefreshBalances={onRefreshBalances} />);

      fireEvent.click(screen.getByText('refresh'));

      expect(screen.getByText('refreshing')).toBeInTheDocument();
    });
  });

  describe('Delete confirmation', () => {
    it('shows delete confirmation modal', () => {
      render(<WalletDashboard {...defaultProps} />);

      fireEvent.click(screen.getByText('forget'));

      expect(screen.getByText('forget wallet')).toBeInTheDocument();
      expect(screen.getByText(/permanently delete/)).toBeInTheDocument();
    });

    it('calls onReset when confirmed', () => {
      const onReset = jest.fn();
      render(<WalletDashboard {...defaultProps} onReset={onReset} />);

      fireEvent.click(screen.getByText('forget'));

      // Find the forget button in the modal (not the original link)
      const modalButtons = screen.getAllByText('forget');
      fireEvent.click(modalButtons[1]);

      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('Theme toggle', () => {
    it('toggles theme', () => {
      render(<WalletDashboard {...defaultProps} />);

      // Default is dark, so should show "bright" option
      expect(screen.getByText('bright')).toBeInTheDocument();

      fireEvent.click(screen.getByText('bright'));

      expect(screen.getByText('dark')).toBeInTheDocument();
    });
  });

  describe('Copy functionality', () => {
    beforeEach(() => {
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
        },
      });
    });

    it('copies address to clipboard', async () => {
      render(<WalletDashboard {...defaultProps} />);

      const copyLinks = screen.getAllByText('copy');
      fireEvent.click(copyLinks[0]);

      await waitFor(() => {
        expect(screen.getByText('copied!')).toBeInTheDocument();
      });
    });
  });

  describe('Last updated display', () => {
    it('shows last updated timestamp', () => {
      const now = Date.now();
      render(<WalletDashboard {...defaultProps} lastUpdated={now} />);

      expect(screen.getByText(/updated:/)).toBeInTheDocument();
    });

    it('hides timestamp when not provided', () => {
      render(<WalletDashboard {...defaultProps} lastUpdated={null} />);

      expect(screen.queryByText(/updated:/)).not.toBeInTheDocument();
    });
  });
});
