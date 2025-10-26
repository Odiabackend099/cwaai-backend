/**
 * Demo Call Routes
 * Public endpoint for landing page "Call Me Now" feature
 * NO AUTHENTICATION REQUIRED - Rate limited instead
 */

import { Router, Request, Response } from 'express';
import { vapiService } from '../services/vapi.service';
import { SupabaseService } from '../services/supabase.service';
import { TelegramService } from '../services/telegram.service';
import { demoCallRateLimiter } from '../middleware/rate-limit.middleware';
import { VapiCallRequest } from '../types/vapi.types';

const router = Router();
const supabase = new SupabaseService();
const telegram = new TelegramService();

interface DemoCallRequest {
  phoneNumber: string;
  name?: string;
  source?: string;
  honeypot?: string; // Anti-spam field (should be empty)
}

/**
 * POST /api/voice/v1/demo-call
 * Initiate a demo call for landing page visitors
 * PUBLIC ENDPOINT - No authentication required
 */
router.post('/', demoCallRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, name, source, honeypot }: DemoCallRequest = req.body;

    // Anti-spam: Honeypot check
    if (honeypot) {
      console.log('[Demo Call] Honeypot triggered - likely spam bot');
      res.status(400).json({
        success: false,
        error: 'Invalid request',
      });
      return;
    }

    // Validate phone number
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
      return;
    }

    // Basic phone validation (remove spaces, dashes, parentheses)
    const cleanedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // Check phone number format (must start with + and have 7-15 digits)
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    if (!phoneRegex.test(cleanedPhone)) {
      res.status(400).json({
        success: false,
        error: 'Invalid phone number format. Please include country code (e.g., +44 for UK)',
      });
      return;
    }

    // Get client IP for logging
    const clientIp =
      req.headers['x-forwarded-for']?.toString().split(',')[0] ||
      req.headers['x-real-ip']?.toString() ||
      req.socket.remoteAddress ||
      'unknown';

    console.log(`[Demo Call] Request from IP ${clientIp} for phone ${cleanedPhone}`);

    // Initiate call via Vapi
    const callRequest: VapiCallRequest = {
      assistantId: process.env.VAPI_ASSISTANT_ID || '15c07867-d296-4ece-ba91-f8fa068f894e',
      customer: {
        number: cleanedPhone.startsWith('+') ? cleanedPhone : `+${cleanedPhone}`,
        name: name || 'Demo User',
      },
      phoneNumberId: process.env.VAPI_PHONE_ID,
      metadata: {
        source: source || 'landing_page_demo',
        isDemo: true,
        clientIp,
        requestedAt: new Date().toISOString(),
      },
    };

    const vapiResponse = await vapiService.initiateCall(callRequest);

    // Save demo call to database
    try {
      await supabase.client.from('call_logs').insert([
        {
          call_id: vapiResponse.id,
          caller_phone: cleanedPhone,
          caller_name: name || 'Demo User',
          status: 'initiated',
          source: source || 'landing_page_demo',
          is_demo: true,
          client_ip: clientIp,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (dbError) {
      console.error('[Demo Call] Database error (non-fatal):', dbError);
      // Don't fail the request if DB save fails
    }

    // Send Telegram notification
    try {
      const telegramMessage = `
🎯 **NEW DEMO CALL REQUEST**

📞 **Phone:** ${cleanedPhone}
👤 **Name:** ${name || 'Not provided'}
🌍 **IP:** ${clientIp}
📍 **Source:** ${source || 'landing_page_demo'}

**Call ID:** ${vapiResponse.id}
**Time:** ${new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' })}

---
🔥 Hot lead! They're trying the demo now!
      `.trim();

      await telegram.sendMessage(telegramMessage);
    } catch (telegramError) {
      console.error('[Demo Call] Telegram notification failed (non-fatal):', telegramError);
      // Don't fail the request if Telegram fails
    }

    // Success response
    res.status(200).json({
      success: true,
      message: 'Demo call initiated successfully! You should receive a call in 3-5 seconds.',
      callId: vapiResponse.id,
      phoneNumber: cleanedPhone,
      estimatedWaitTime: '3-5 seconds',
    });

    console.log(`[Demo Call] ✅ Successfully initiated call ${vapiResponse.id} to ${cleanedPhone}`);
  } catch (error: any) {
    console.error('[Demo Call] Failed to initiate call:', error);

    // Check if it's a Vapi error
    if (error.response?.status === 400) {
      const vapiMessage = error.response?.data?.message || '';

      // Check if it's an international calling restriction
      if (vapiMessage.includes('international calls')) {
        res.status(400).json({
          success: false,
          error: 'International calls not supported',
          message: 'Sorry, our demo currently only supports US/Canada phone numbers (+1). Please contact us directly at +1 (276) 582-5329 or email support@callwaitingai.com for international inquiries.',
        });
        return;
      }

      res.status(400).json({
        success: false,
        error: 'Invalid phone number',
        message: 'The phone number you provided is invalid. Please check and try again.',
      });
      return;
    }

    if (error.response?.status === 429) {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: 'Too many demo calls. Please try again in a few minutes.',
      });
      return;
    }

    // Generic error
    res.status(500).json({
      success: false,
      error: 'Demo call failed',
      message: 'We encountered an error initiating your demo call. Please try again or contact us directly at +1 (276) 582-5329.',
    });
  }
});

/**
 * GET /api/voice/v1/demo-call/stats
 * Get demo call statistics (requires auth)
 */
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabase.client
      .from('call_logs')
      .select('*')
      .eq('is_demo', true)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[Demo Call Stats] Database error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stats',
      });
      return;
    }

    const stats = {
      totalDemoCalls: data?.length || 0,
      today: data?.filter(call =>
        new Date(call.created_at).toDateString() === new Date().toDateString()
      ).length || 0,
      last7Days: data?.filter(call =>
        new Date(call.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length || 0,
      recentCalls: data?.slice(0, 10) || [],
    };

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[Demo Call Stats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
