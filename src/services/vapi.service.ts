/**
 * Vapi Service - Proxy layer for Vapi API
 * Implements provider abstraction for future migration to ODIADEV-TTS
 */

import dotenv from 'dotenv';
dotenv.config();

import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  VoiceProvider,
  VapiCallRequest,
  VapiCallResponse,
  VapiAssistant,
  VapiPhoneNumber,
  VapiError
} from '../types/vapi.types';

export class VapiService implements VoiceProvider {
  private client: AxiosInstance;
  private privateKey: string;

  constructor() {
    this.privateKey = process.env.VAPI_PRIVATE_KEY || '';

    if (!this.privateKey) {
      throw new Error('VAPI_PRIVATE_KEY environment variable is required');
    }

    this.client = axios.create({
      baseURL: 'https://api.vapi.ai',
      headers: {
        'Authorization': `Bearer ${this.privateKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        console.log(`[Vapi] ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[Vapi] Request error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[Vapi] Response ${response.status} from ${response.config.url}`);
        return response;
      },
      (error: AxiosError<VapiError>) => {
        const errorMessage = error.response?.data?.error?.message || error.message;
        console.error(`[Vapi] Error: ${errorMessage}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Initiate an outbound call
   */
  async initiateCall(params: VapiCallRequest): Promise<VapiCallResponse> {
    try {
      const response = await this.client.post<VapiCallResponse>('/call', params);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError<VapiError>, 'Failed to initiate call');
      throw error;
    }
  }

  /**
   * Get call details by ID
   */
  async getCall(callId: string): Promise<VapiCallResponse> {
    try {
      const response = await this.client.get<VapiCallResponse>(`/call/${callId}`);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError<VapiError>, `Failed to get call ${callId}`);
      throw error;
    }
  }

  /**
   * List all calls with optional pagination
   */
  async listCalls(params?: { limit?: number; offset?: number }): Promise<VapiCallResponse[]> {
    try {
      const response = await this.client.get<VapiCallResponse[]>('/call', {
        params: {
          limit: params?.limit || 50,
          offset: params?.offset || 0
        }
      });
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError<VapiError>, 'Failed to list calls');
      throw error;
    }
  }

  /**
   * Create a new assistant
   */
  async createAssistant(config: Partial<VapiAssistant>): Promise<VapiAssistant> {
    try {
      const response = await this.client.post<VapiAssistant>('/assistant', config);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError<VapiError>, 'Failed to create assistant');
      throw error;
    }
  }

  /**
   * Update an existing assistant
   */
  async updateAssistant(assistantId: string, config: Partial<VapiAssistant>): Promise<VapiAssistant> {
    try {
      const response = await this.client.patch<VapiAssistant>(`/assistant/${assistantId}`, config);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError<VapiError>, `Failed to update assistant ${assistantId}`);
      throw error;
    }
  }

  /**
   * Get assistant by ID
   */
  async getAssistant(assistantId: string): Promise<VapiAssistant> {
    try {
      const response = await this.client.get<VapiAssistant>(`/assistant/${assistantId}`);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError<VapiError>, `Failed to get assistant ${assistantId}`);
      throw error;
    }
  }

  /**
   * Delete an assistant
   */
  async deleteAssistant(assistantId: string): Promise<void> {
    try {
      await this.client.delete(`/assistant/${assistantId}`);
    } catch (error) {
      this.handleError(error as AxiosError<VapiError>, `Failed to delete assistant ${assistantId}`);
      throw error;
    }
  }

  /**
   * Get phone number details
   */
  async getPhoneNumber(phoneNumberId: string): Promise<VapiPhoneNumber> {
    try {
      const response = await this.client.get<VapiPhoneNumber>(`/phone-number/${phoneNumberId}`);
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError<VapiError>, `Failed to get phone number ${phoneNumberId}`);
      throw error;
    }
  }

  /**
   * Handle Vapi API errors
   */
  private handleError(error: AxiosError<VapiError>, context: string): void {
    if (error.response) {
      const vapiError = error.response.data?.error;
      console.error(`[Vapi] ${context}:`, {
        status: error.response.status,
        message: vapiError?.message || error.message,
        type: vapiError?.type,
        code: vapiError?.code
      });
    } else if (error.request) {
      console.error(`[Vapi] ${context}: No response received`, error.message);
    } else {
      console.error(`[Vapi] ${context}:`, error.message);
    }
  }
}

// Singleton instance
export const vapiService = new VapiService();
