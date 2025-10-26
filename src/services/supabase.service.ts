/**
 * Supabase Service - Database operations
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface CallLog {
  id?: string;
  user_id?: string;
  endpoint: string;
  method: string;
  status_code?: number;
  request_body?: any;
  response_body?: any;
  error_message?: string;
  ip_address?: string;
  created_at?: string;
}

export interface Lead {
  id?: string;
  user_id: string;
  call_id?: string;
  name?: string;
  email?: string;
  phone?: string;
  intent?: string;
  is_qualified?: boolean;
  confidence_score?: number;
  qualification_score?: number;
  flutterwave_payment_link?: string;
  payment_status?: 'pending' | 'completed' | 'failed';
  telegram_notified_at?: string;
  created_at?: string;
}

export interface WebhookEvent {
  id?: string;
  event_type: string;
  payload: any;
  processed?: boolean;
  error_message?: string;
  created_at?: string;
}

export interface Call {
  id?: string;
  user_id: string;
  caller_phone?: string;
  transcript?: string;
  ai_response?: string;
  status?: 'answered' | 'missed' | 'forwarded' | 'in_progress';
  duration?: number;
  audio_url?: string;
  recording_sid?: string;
  created_at?: string;
}

export class SupabaseService {
  private client: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required');
    }

    this.client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('[Supabase] Service initialized');
  }

  /**
   * Log API request/response
   */
  async logRequest(log: CallLog): Promise<void> {
    try {
      const { error } = await this.client
        .from('call_logs')
        .insert(log);

      if (error) {
        console.error('[Supabase] Failed to log request:', error);
      }
    } catch (error) {
      console.error('[Supabase] Exception while logging request:', error);
    }
  }

  /**
   * Save lead to database
   */
  async saveLead(lead: Lead): Promise<Lead | null> {
    try {
      const { data, error } = await this.client
        .from('leads')
        .insert(lead)
        .select()
        .single();

      if (error) {
        console.error('[Supabase] Failed to save lead:', error);
        return null;
      }

      console.log('[Supabase] Lead saved:', data.id);
      return data;
    } catch (error) {
      console.error('[Supabase] Exception while saving lead:', error);
      return null;
    }
  }

  /**
   * Update lead with payment information
   */
  async updateLeadPayment(leadId: string, paymentLink: string, status: 'pending' | 'completed' | 'failed'): Promise<void> {
    try {
      const { error } = await this.client
        .from('leads')
        .update({
          flutterwave_payment_link: paymentLink,
          payment_status: status
        })
        .eq('id', leadId);

      if (error) {
        console.error('[Supabase] Failed to update lead payment:', error);
      }
    } catch (error) {
      console.error('[Supabase] Exception while updating lead payment:', error);
    }
  }

  /**
   * Mark lead as notified via Telegram
   */
  async markLeadNotified(leadId: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('leads')
        .update({ telegram_notified_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) {
        console.error('[Supabase] Failed to mark lead as notified:', error);
      }
    } catch (error) {
      console.error('[Supabase] Exception while marking lead as notified:', error);
    }
  }

  /**
   * Save webhook event
   */
  async saveWebhookEvent(event: WebhookEvent): Promise<WebhookEvent | null> {
    try {
      const { data, error } = await this.client
        .from('webhook_events')
        .insert(event)
        .select()
        .single();

      if (error) {
        console.error('[Supabase] Failed to save webhook event:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Supabase] Exception while saving webhook event:', error);
      return null;
    }
  }

  /**
   * Mark webhook event as processed
   */
  async markWebhookProcessed(eventId: string, errorMessage?: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('webhook_events')
        .update({
          processed: true,
          error_message: errorMessage || null
        })
        .eq('id', eventId);

      if (error) {
        console.error('[Supabase] Failed to mark webhook as processed:', error);
      }
    } catch (error) {
      console.error('[Supabase] Exception while marking webhook as processed:', error);
    }
  }

  /**
   * Save call record
   */
  async saveCall(call: Call): Promise<Call | null> {
    try {
      const { data, error } = await this.client
        .from('calls')
        .insert(call)
        .select()
        .single();

      if (error) {
        console.error('[Supabase] Failed to save call:', error);
        return null;
      }

      console.log('[Supabase] Call saved:', data.id);
      return data;
    } catch (error) {
      console.error('[Supabase] Exception while saving call:', error);
      return null;
    }
  }

  /**
   * Update call record
   */
  async updateCall(callId: string, updates: Partial<Call>): Promise<void> {
    try {
      const { error } = await this.client
        .from('calls')
        .update(updates)
        .eq('id', callId);

      if (error) {
        console.error('[Supabase] Failed to update call:', error);
      }
    } catch (error) {
      console.error('[Supabase] Exception while updating call:', error);
    }
  }

  /**
   * Get user's remaining calls
   */
  async getUserCallsRemaining(userId: string): Promise<number | null> {
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('calls_remaining')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[Supabase] Failed to get user calls remaining:', error);
        return null;
      }

      return data.calls_remaining;
    } catch (error) {
      console.error('[Supabase] Exception while getting user calls remaining:', error);
      return null;
    }
  }

  /**
   * Decrement user's remaining calls
   */
  async decrementUserCalls(userId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .rpc('decrement_calls_remaining', { user_id_param: userId });

      if (error) {
        console.error('[Supabase] Failed to decrement user calls:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Supabase] Exception while decrementing user calls:', error);
      return false;
    }
  }

  /**
   * Verify user JWT token
   */
  async verifyUserToken(token: string): Promise<{ id: string; email?: string } | null> {
    try {
      const { data: { user }, error } = await this.client.auth.getUser(token);

      if (error || !user) {
        console.error('[Supabase] Token verification failed:', error);
        return null;
      }

      return { id: user.id, email: user.email };
    } catch (error) {
      console.error('[Supabase] Exception during token verification:', error);
      return null;
    }
  }
}

// Singleton instance
export const supabaseService = new SupabaseService();
