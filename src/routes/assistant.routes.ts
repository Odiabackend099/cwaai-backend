/**
 * Assistant Routes
 * Manage Vapi assistants (create, update, retrieve)
 */

import { Router, Response } from 'express';
import { vapiService } from '../services/vapi.service';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';
import { VapiAssistant } from '../types/vapi.types';

const router = Router();

/**
 * GET /api/voice/v1/assistant/:assistantId
 * Get assistant details
 */
router.get('/assistant/:assistantId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { assistantId } = req.params;

    const assistant = await vapiService.getAssistant(assistantId);

    res.status(200).json({
      success: true,
      assistant
    });
  } catch (error: any) {
    console.error(`[Assistant] Failed to get assistant ${req.params.assistantId}:`, error);

    res.status(error.response?.status || 500).json({
      error: 'Failed to Retrieve Assistant',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * POST /api/voice/v1/assistant
 * Create a new assistant
 */
router.post('/assistant', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const assistantConfig: Partial<VapiAssistant> = req.body;

    // Validate required fields
    if (!assistantConfig.name || !assistantConfig.model || !assistantConfig.voice) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'name, model, and voice are required fields'
      });
      return;
    }

    const assistant = await vapiService.createAssistant(assistantConfig);

    console.log(`[Assistant] Created assistant ${assistant.id} for user ${req.user!.id}`);

    res.status(201).json({
      success: true,
      assistant
    });
  } catch (error: any) {
    console.error('[Assistant] Failed to create assistant:', error);

    res.status(error.response?.status || 500).json({
      error: 'Failed to Create Assistant',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * PATCH /api/voice/v1/assistant/:assistantId
 * Update an existing assistant
 */
router.patch('/assistant/:assistantId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { assistantId } = req.params;
    const updates: Partial<VapiAssistant> = req.body;

    const assistant = await vapiService.updateAssistant(assistantId, updates);

    console.log(`[Assistant] Updated assistant ${assistantId} for user ${req.user!.id}`);

    res.status(200).json({
      success: true,
      assistant
    });
  } catch (error: any) {
    console.error(`[Assistant] Failed to update assistant ${req.params.assistantId}:`, error);

    res.status(error.response?.status || 500).json({
      error: 'Failed to Update Assistant',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * DELETE /api/voice/v1/assistant/:assistantId
 * Delete an assistant
 */
router.delete('/assistant/:assistantId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { assistantId } = req.params;

    await vapiService.deleteAssistant(assistantId);

    console.log(`[Assistant] Deleted assistant ${assistantId} for user ${req.user!.id}`);

    res.status(200).json({
      success: true,
      message: 'Assistant deleted successfully'
    });
  } catch (error: any) {
    console.error(`[Assistant] Failed to delete assistant ${req.params.assistantId}:`, error);

    res.status(error.response?.status || 500).json({
      error: 'Failed to Delete Assistant',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

export default router;
