/**
 * Webhook Routes
 * Handle Vapi webhook events (call.ended, transcript, etc.)
 */

import { Router, Request, Response } from 'express';
import { supabaseService } from '../services/supabase.service';
import { telegramService } from '../services/telegram.service';
import { flutterwaveService } from '../services/flutterwave.service';
import { VapiWebhookEvent } from '../types/vapi.types';

const router = Router();

/**
 * POST /api/voice/v1/webhook/vapi
 * Receive webhook events from Vapi
 */
router.post('/webhook/vapi', async (req: Request, res: Response) => {
  try {
    const event: VapiWebhookEvent = req.body;

    console.log(`[Webhook] Received event: ${event.type}`);

    // Save webhook event to database
    const savedEvent = await supabaseService.saveWebhookEvent({
      event_type: event.type,
      payload: event,
      processed: false
    });

    // Process event based on type
    try {
      switch (event.type) {
        case 'call.ended':
          await handleCallEnded(event);
          break;

        case 'call.started':
          await handleCallStarted(event);
          break;

        case 'call.failed':
          await handleCallFailed(event);
          break;

        case 'transcript':
          await handleTranscript(event);
          break;

        default:
          console.log(`[Webhook] Unhandled event type: ${event.type}`);
      }

      // Mark event as processed
      if (savedEvent) {
        await supabaseService.markWebhookProcessed(savedEvent.id!);
      }

      res.status(200).json({ success: true, received: true });
    } catch (processingError: any) {
      console.error('[Webhook] Error processing event:', processingError);

      // Mark event as processed with error
      if (savedEvent) {
        await supabaseService.markWebhookProcessed(savedEvent.id!, processingError.message);
      }

      // Still return 200 to Vapi to avoid retries
      res.status(200).json({ success: true, received: true, error: processingError.message });
    }
  } catch (error: any) {
    console.error('[Webhook] Failed to handle webhook:', error);
    res.status(500).json({
      error: 'Webhook Processing Failed',
      message: error.message
    });
  }
});

/**
 * Handle call.started event
 */
async function handleCallStarted(event: VapiWebhookEvent): Promise<void> {
  if (!event.call) return;

  const call = event.call;
  const userId = call.metadata?.userId;

  if (!userId) {
    console.warn('[Webhook] call.started event missing userId in metadata');
    return;
  }

  // Update call status in database
  await supabaseService.updateCall(call.id, {
    status: 'in_progress'
  });

  console.log(`[Webhook] Call ${call.id} started for user ${userId}`);
}

/**
 * Handle call.ended event
 */
async function handleCallEnded(event: VapiWebhookEvent): Promise<void> {
  if (!event.call) return;

  const call = event.call;
  const userId = call.metadata?.userId;

  if (!userId) {
    console.warn('[Webhook] call.ended event missing userId in metadata');
    return;
  }

  // Update call record in database
  await supabaseService.updateCall(call.id, {
    transcript: call.transcript,
    status: 'answered',
    duration: call.cost ? Math.round((call.cost / 0.01) * 60) : undefined, // Estimate duration
    audio_url: call.recordingUrl
  });

  console.log(`[Webhook] Call ${call.id} ended - Duration: ${call.cost}min`);

  // Extract lead information from transcript
  if (call.transcript) {
    await extractAndSaveLead(userId, call.id, call.transcript, call.customer?.number);
  }
}

/**
 * Handle call.failed event
 */
async function handleCallFailed(event: VapiWebhookEvent): Promise<void> {
  if (!event.call) return;

  const call = event.call;
  const userId = call.metadata?.userId;

  if (!userId) {
    console.warn('[Webhook] call.failed event missing userId in metadata');
    return;
  }

  // Update call status
  await supabaseService.updateCall(call.id, {
    status: 'missed'
  });

  console.log(`[Webhook] Call ${call.id} failed for user ${userId}`);

  // Notify admin of failed call
  await telegramService.notifyError(
    `Call ${call.id} failed`,
    new Error(`Call to ${call.customer?.number} failed`)
  );
}

/**
 * Handle transcript event (real-time during call)
 */
async function handleTranscript(event: VapiWebhookEvent): Promise<void> {
  if (!event.message?.transcript) return;

  console.log(`[Webhook] Transcript: ${event.message.transcript}`);

  // You can implement real-time transcript processing here
  // For example, trigger actions based on keywords during the call
}

/**
 * Extract lead information from call transcript using AI
 */
async function extractAndSaveLead(
  userId: string,
  callId: string,
  transcript: string,
  phoneNumber?: string
): Promise<void> {
  try {
    // Simple keyword-based intent extraction
    // TODO: Replace with AI-powered extraction (OpenAI/Claude)
    const intent = extractIntent(transcript);
    const isQualified = checkQualification(transcript);
    const confidence = calculateConfidence(transcript);

    // Extract name from transcript (basic implementation)
    const name = extractName(transcript);
    const email = extractEmail(transcript);

    // Save lead to database
    const lead = await supabaseService.saveLead({
      user_id: userId,
      call_id: callId,
      name,
      email,
      phone: phoneNumber,
      intent,
      is_qualified: isQualified,
      confidence_score: confidence
    });

    if (!lead) {
      console.error('[Webhook] Failed to save lead');
      return;
    }

    console.log(`[Webhook] Lead saved: ${lead.id} - Intent: ${intent}`);

    // Send Telegram notification
    await telegramService.notifyNewLead(lead, transcript);

    // Mark as notified
    await supabaseService.markLeadNotified(lead.id!);

    // Generate payment link for qualified leads
    if (isQualified && name && email) {
      const paymentLink = await flutterwaveService.generateLeadPaymentLink(
        name,
        email,
        phoneNumber,
        'starter' // Default plan
      );

      if (paymentLink) {
        await supabaseService.updateLeadPayment(lead.id!, paymentLink, 'pending');
        await telegramService.notifyPaymentLink(lead, paymentLink);

        console.log(`[Webhook] Payment link generated for lead ${lead.id}`);
      }
    }
  } catch (error) {
    console.error('[Webhook] Failed to extract and save lead:', error);
  }
}

/**
 * Extract intent from transcript
 * TODO: Replace with AI-powered extraction
 */
function extractIntent(transcript: string): string {
  const lowerTranscript = transcript.toLowerCase();

  if (lowerTranscript.includes('book') || lowerTranscript.includes('reservation')) {
    return 'booking';
  } else if (lowerTranscript.includes('price') || lowerTranscript.includes('cost') || lowerTranscript.includes('how much')) {
    return 'pricing_inquiry';
  } else if (lowerTranscript.includes('interested') || lowerTranscript.includes('sign up')) {
    return 'service_interest';
  } else if (lowerTranscript.includes('support') || lowerTranscript.includes('help')) {
    return 'support';
  } else if (lowerTranscript.includes('cancel') || lowerTranscript.includes('refund')) {
    return 'cancellation';
  }

  return 'general_inquiry';
}

/**
 * Check if lead is qualified
 */
function checkQualification(transcript: string): boolean {
  const lowerTranscript = transcript.toLowerCase();
  const qualifyingKeywords = ['interested', 'sign up', 'buy', 'purchase', 'book', 'yes'];

  return qualifyingKeywords.some(keyword => lowerTranscript.includes(keyword));
}

/**
 * Calculate confidence score
 */
function calculateConfidence(transcript: string): number {
  let score = 0.5; // Base score

  const positiveKeywords = ['interested', 'yes', 'definitely', 'sure', 'absolutely'];
  const negativeKeywords = ['no', 'not interested', 'maybe', 'later'];

  const lowerTranscript = transcript.toLowerCase();

  positiveKeywords.forEach(keyword => {
    if (lowerTranscript.includes(keyword)) score += 0.1;
  });

  negativeKeywords.forEach(keyword => {
    if (lowerTranscript.includes(keyword)) score -= 0.15;
  });

  return Math.max(0, Math.min(1, score)); // Clamp between 0 and 1
}

/**
 * Extract name from transcript
 */
function extractName(transcript: string): string | undefined {
  // Look for patterns like "my name is X" or "I'm X"
  const patterns = [
    /my name is ([a-z]+(?:\s[a-z]+)?)/i,
    /i'm ([a-z]+(?:\s[a-z]+)?)/i,
    /this is ([a-z]+(?:\s[a-z]+)?)/i
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Extract email from transcript
 */
function extractEmail(transcript: string): string | undefined {
  const emailPattern = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
  const match = transcript.match(emailPattern);

  return match ? match[1] : undefined;
}

export default router;
