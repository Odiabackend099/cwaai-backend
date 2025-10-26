/**
 * Flutterwave Payment Service
 * Generates payment links for qualified leads
 */

import dotenv from 'dotenv';
dotenv.config();

import axios, { AxiosInstance } from 'axios';

export interface PaymentLinkParams {
  amount: number;
  currency?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  description?: string;
  reference?: string;
  redirectUrl?: string;
}

export interface PaymentLinkResponse {
  status: string;
  message: string;
  data: {
    link: string;
    reference: string;
  };
}

export class FlutterwaveService {
  private client: AxiosInstance;
  private secretKey: string;
  private publicKey: string;
  private enabled: boolean = false;

  constructor() {
    this.secretKey = process.env.FLUTTERWAVE_SECRET_KEY || '';
    this.publicKey = process.env.FLUTTERWAVE_PUBLIC_KEY || '';

    if (this.secretKey && this.publicKey) {
      this.client = axios.create({
        baseURL: 'https://api.flutterwave.com/v3',
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      this.enabled = true;
      console.log('[Flutterwave] Service initialized');
    } else {
      console.warn('[Flutterwave] API keys not configured - payment links disabled');
      // Create dummy client to prevent errors
      this.client = axios.create();
    }
  }

  /**
   * Generate payment link for a lead
   */
  async generatePaymentLink(params: PaymentLinkParams): Promise<string | null> {
    if (!this.enabled) {
      console.warn('[Flutterwave] Service disabled - skipping payment link generation');
      return null;
    }

    try {
      const reference = params.reference || `CW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const payload = {
        tx_ref: reference,
        amount: params.amount,
        currency: params.currency || 'USD',
        redirect_url: params.redirectUrl || 'https://callwaitingai.dev/payment/success',
        customer: {
          email: params.customerEmail,
          name: params.customerName,
          phonenumber: params.customerPhone || ''
        },
        customizations: {
          title: 'CallWaitingAI Subscription',
          description: params.description || 'Voice AI Receptionist Service',
          logo: 'https://callwaitingai.dev/logo.png'
        },
        meta: {
          source: 'voice-call-lead',
          generated_at: new Date().toISOString()
        }
      };

      const response = await this.client.post<PaymentLinkResponse>('/payment-links', payload);

      if (response.data.status === 'success' && response.data.data.link) {
        console.log('[Flutterwave] Payment link generated:', response.data.data.link);
        return response.data.data.link;
      }

      console.error('[Flutterwave] Unexpected response:', response.data);
      return null;
    } catch (error: any) {
      console.error('[Flutterwave] Failed to generate payment link:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Verify payment status
   */
  async verifyPayment(transactionId: string): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await this.client.get(`/transactions/${transactionId}/verify`);

      if (response.data.status === 'success' && response.data.data.status === 'successful') {
        console.log('[Flutterwave] Payment verified:', transactionId);
        return true;
      }

      console.log('[Flutterwave] Payment not successful:', response.data.data.status);
      return false;
    } catch (error: any) {
      console.error('[Flutterwave] Payment verification failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Get default subscription plans
   */
  getSubscriptionPlans() {
    return {
      trial: {
        amount: 0,
        currency: 'USD',
        description: '7-day free trial - 50 calls'
      },
      starter: {
        amount: 29,
        currency: 'USD',
        description: 'Starter Plan - 100 calls/month'
      },
      professional: {
        amount: 79,
        currency: 'USD',
        description: 'Professional Plan - 500 calls/month'
      },
      enterprise: {
        amount: 199,
        currency: 'USD',
        description: 'Enterprise Plan - Unlimited calls'
      }
    };
  }

  /**
   * Generate payment link for qualified lead (auto-pricing)
   */
  async generateLeadPaymentLink(
    leadName: string,
    leadEmail: string,
    leadPhone?: string,
    plan: 'starter' | 'professional' | 'enterprise' = 'starter'
  ): Promise<string | null> {
    const plans = this.getSubscriptionPlans();
    const selectedPlan = plans[plan];

    return this.generatePaymentLink({
      amount: selectedPlan.amount,
      currency: selectedPlan.currency,
      customerName: leadName,
      customerEmail: leadEmail,
      customerPhone: leadPhone,
      description: selectedPlan.description
    });
  }
}

// Singleton instance
export const flutterwaveService = new FlutterwaveService();
