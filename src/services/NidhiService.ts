import AuthService from './AuthService';

export interface BalanceData {
  companyBalance: number;
  individualBalance: number;
  availableToLend: number;
  roi: number;
  availableToWithdraw: number;
  currency: string;
  lastUpdated: string;
}

export interface BalanceResponse {
  success: boolean;
  data?: {
    nidhiBalance: number;
    nidhiNPA: number;
    nidhiROI: number;
    nidhiLastUpdated: string;
  };
  error?: string;
}

export const getBalance = async () => {
  return {
    success: true,
    data: {
      balance: 1500000,
      npa: 25000,
      roi: 12.5,
      lastUpdated: new Date().toISOString()
    }
  };
};

class BalanceService {
  private apiBaseUrl: string;

  constructor() {
    this.apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'https://api.annadata.ai';
  }

  async getBalanceData(): Promise<BalanceResponse> {
    try {
      const token = await AuthService.getToken();
      if (!token) {
        return { success: false, error: 'Authentication required' };
      }

      const response = await fetch(`${this.apiBaseUrl}/api/balance`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data: data };
    } catch (error) {
      console.error('Error fetching balance data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch balance data'
      };
    }
  }

  async updateCurrencyPreference(currencyCode: string): Promise<BalanceResponse> {
    try {
      const token = await AuthService.getToken();
      if (!token) {
        return { success: false, error: 'Authentication required' };
      }

      const response = await fetch(`${this.apiBaseUrl}/api/balance/currency`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currencyCode })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, data: data };
    } catch (error) {
      console.error('Error updating currency preference:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update currency preference'
      };
    }
  }

  getMockBalanceData(currencyCode: string = '+91'): BalanceData {
    const mockData: { [key: string]: BalanceData } = {
      '+91': {
        companyBalance: 1500000,
        individualBalance: 25000,
        availableToLend: 15000,
        roi: 12.5,
        availableToWithdraw: 8000,
        currency: '₹',
        lastUpdated: new Date().toISOString()
      },
      '+1': {
        companyBalance: 20000,
        individualBalance: 300,
        availableToLend: 200,
        roi: 8.5,
        availableToWithdraw: 100,
        currency: '$',
        lastUpdated: new Date().toISOString()
      },
      '+44': {
        companyBalance: 15000,
        individualBalance: 250,
        availableToLend: 150,
        roi: 10.2,
        availableToWithdraw: 80,
        currency: '€',
        lastUpdated: new Date().toISOString()
      }
    };

    return mockData[currencyCode] || mockData['+91'];
  }
}

export default new BalanceService();
