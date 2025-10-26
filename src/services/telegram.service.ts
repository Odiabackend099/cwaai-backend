/**
 * Telegram Notification Service
 * Sends lead alerts to admin via Telegram Bot
 */

import dotenv from 'dotenv';
dotenv.config();

import TelegramBot from 'node-telegram-bot-api';
import { Lead } from './supabase.service';

export class TelegramService {
  private bot: TelegramBot | null = null;
  private chatId: string;
  private enabled: boolean = false;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';

    if (token && this.chatId) {
      try {
        this.bot = new TelegramBot(token, { polling: false });
        this.enabled = true;
        console.log('[Telegram] Service initialized');
      } catch (error) {
        console.error('[Telegram] Failed to initialize bot:', error);
      }
    } else {
      console.warn('[Telegram] Bot token or chat ID not configured - notifications disabled');
    }
  }

  /**
   * Send new lead notification
   */
  async notifyNewLead(lead: Lead, callTranscript?: string): Promise<boolean> {
    if (!this.enabled || !this.bot) {
      console.warn('[Telegram] Notifications disabled - skipping');
      return false;
    }

    try {
      const message = this.formatLeadMessage(lead, callTranscript);

      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });

      console.log('[Telegram] Lead notification sent successfully');
      return true;
    } catch (error) {
      console.error('[Telegram] Failed to send notification:', error);
      return false;
    }
  }

  /**
   * Send payment link notification
   */
  async notifyPaymentLink(lead: Lead, paymentLink: string): Promise<boolean> {
    if (!this.enabled || !this.bot) {
      console.warn('[Telegram] Notifications disabled - skipping');
      return false;
    }

    try {
      const message = `
💳 *Payment Link Generated*

📞 Lead: ${lead.name || 'Unknown'}
☎️ Phone: ${lead.phone || 'N/A'}
💰 Payment: ${paymentLink}

Status: Awaiting payment
      `.trim();

      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: false
      });

      console.log('[Telegram] Payment link notification sent');
      return true;
    } catch (error) {
      console.error('[Telegram] Failed to send payment link notification:', error);
      return false;
    }
  }

  /**
   * Send error alert
   */
  async notifyError(context: string, error: Error): Promise<void> {
    if (!this.enabled || !this.bot) {
      return;
    }

    try {
      const message = `
⚠️ *Error Alert*

Context: ${context}
Error: \`${error.message}\`
Time: ${new Date().toISOString()}
      `.trim();

      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown'
      });
    } catch (err) {
      console.error('[Telegram] Failed to send error alert:', err);
    }
  }

  /**
   * Format lead information as Telegram message
   */
  private formatLeadMessage(lead: Lead, transcript?: string): string {
    const qualificationEmoji = this.getQualificationEmoji(lead.confidence_score);
    const intentText = lead.intent || 'Not determined';

    let message = `
${qualificationEmoji} *New Lead Alert!*

👤 Name: ${lead.name || 'Unknown'}
📞 Phone: ${lead.phone || 'N/A'}
📧 Email: ${lead.email || 'N/A'}

💬 Intent: ${intentText}
${lead.confidence_score ? `📊 Confidence: ${(lead.confidence_score * 100).toFixed(0)}%` : ''}
${lead.is_qualified ? '✅ Qualified Lead' : '⏳ Pending Review'}
    `.trim();

    if (transcript) {
      // Truncate long transcripts
      const truncatedTranscript = transcript.length > 300
        ? transcript.substring(0, 300) + '...'
        : transcript;

      message += `\n\n📝 *Transcript:*\n_${truncatedTranscript}_`;
    }

    message += `\n\n🔗 [View Dashboard](https://callwaitingai.dev/dashboard/leads)`;

    return message;
  }

  /**
   * Get emoji based on qualification score
   */
  private getQualificationEmoji(score?: number): string {
    if (!score) return '📬';
    if (score >= 0.8) return '🔥';
    if (score >= 0.6) return '⭐';
    if (score >= 0.4) return '📬';
    return '❓';
  }

  /**
   * Test connection by sending a test message
   */
  async testConnection(): Promise<boolean> {
    if (!this.enabled || !this.bot) {
      console.error('[Telegram] Cannot test - service not enabled');
      return false;
    }

    try {
      await this.bot.sendMessage(this.chatId, '✅ Telegram notification service is working!');
      console.log('[Telegram] Test message sent successfully');
      return true;
    } catch (error) {
      console.error('[Telegram] Test message failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const telegramService = new TelegramService();
