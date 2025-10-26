/**
 * Call Routes
 * Handle outbound call initiation and call history
 */

import { Router, Response } from 'express';
import { vapiService } from '../services/vapi.service';
import { supabaseService } from '../services/supabase.service';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { VapiCallRequest } from '../types/vapi.types';

const router = Router();

/**
 * POST /api/voice/v1/call
 * Initiate an outbound call
 */
router.post('/call', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { assistantId, customer, phoneNumberId, metadata } = req.body as VapiCallRequest;

    // Validate required fields
    if (!assistantId || !customer?.number) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'assistantId and customer.number are required'
      });
      return;
    }

    // Check user's remaining calls
    const callsRemaining = await supabaseService.getUserCallsRemaining(userId);

    if (callsRemaining === null) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to check user call quota'
      });
      return;
    }

    if (callsRemaining <= 0) {
      res.status(403).json({
        error: 'Quota Exceeded',
        message: 'No calls remaining. Please upgrade your plan.',
        callsRemaining: 0
      });
      return;
    }

    // Initiate call via Vapi
    const callRequest: VapiCallRequest = {
      assistantId,
      customer,
      phoneNumberId: phoneNumberId || process.env.VAPI_PHONE_ID,
      metadata: {
        ...metadata,
        userId,
        source: 'callwaitingai'
      }
    };

    const vapiResponse = await vapiService.initiateCall(callRequest);

    // Save call record to Supabase
    await supabaseService.saveCall({
      id: vapiResponse.id,
      user_id: userId,
      caller_phone: customer.number,
      status: 'in_progress',
      created_at: vapiResponse.createdAt
    });

    // Decrement user's call count
    await supabaseService.decrementUserCalls(userId);

    console.log(`[Call] Initiated call ${vapiResponse.id} for user ${userId}`);

    res.status(200).json({
      success: true,
      call: vapiResponse,
      callsRemaining: callsRemaining - 1
    });
  } catch (error: any) {
    console.error('[Call] Failed to initiate call:', error);

    res.status(error.response?.status || 500).json({
      error: 'Call Initiation Failed',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * GET /api/voice/v1/call/:callId
 * Get call details
 */
router.get('/call/:callId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { callId } = req.params;

    const callData = await vapiService.getCall(callId);

    res.status(200).json({
      success: true,
      call: callData
    });
  } catch (error: any) {
    console.error(`[Call] Failed to get call ${req.params.callId}:`, error);

    res.status(error.response?.status || 500).json({
      error: 'Failed to Retrieve Call',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * GET /api/voice/v1/calls
 * List all calls for authenticated user
 */
router.get('/calls', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get calls from Vapi
    const calls = await vapiService.listCalls({ limit, offset });

    // Filter calls for this user (based on metadata.userId)
    const userId = req.user!.id;
    const userCalls = calls.filter(call => call.metadata?.userId === userId);

    res.status(200).json({
      success: true,
      calls: userCalls,
      count: userCalls.length,
      limit,
      offset
    });
  } catch (error: any) {
    console.error('[Call] Failed to list calls:', error);

    res.status(error.response?.status || 500).json({
      error: 'Failed to List Calls',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

export default router;
