import { Router, Request, Response } from 'express';
import { openaiService } from '../services/openai.service';
import { SupabaseService } from '../services/supabase.service';

const router = Router();
const supabase = new SupabaseService();

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatRequest {
  message: string;
  conversationId?: string;
  sessionId?: string;
  userMetadata?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

/**
 * POST /api/voice/v1/chat
 * Send a message and get AI response with conversation memory
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, conversationId, sessionId, userMetadata }: ChatRequest = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Message is required',
      });
      return;
    }

    // Generate conversation ID if not provided
    const convId = conversationId || `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Retrieve conversation history from database
    let conversationHistory: ChatMessage[] = [];

    if (conversationId) {
      const historyData = await supabase.getChatConversation(conversationId);

      if (historyData?.messages) {
        conversationHistory = historyData.messages;
      }
    }

    // Format history for OpenAI
    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }));

    // Get AI response
    const aiResponse = await openaiService.getChatResponse(message, formattedHistory);

    // Analyze sentiment for lead qualification
    const sentiment = await openaiService.analyzeSentiment(message);

    // Update conversation history
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };

    const newAssistantMessage: ChatMessage = {
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
    };

    conversationHistory.push(newUserMessage, newAssistantMessage);

    // Store/update conversation in database
    const conversationData = {
      conversation_id: convId,
      session_id: sessId,
      messages: conversationHistory,
      last_message_at: new Date().toISOString(),
      message_count: conversationHistory.length,
      user_metadata: userMetadata || {},
      sentiment_score: sentiment.score,
      intent: sentiment.intent,
      urgency: sentiment.urgency,
      keywords: sentiment.keywords,
    };

    const { error: upsertError } = await supabase.upsertChatConversation(conversationData);

    if (upsertError) {
      console.error('[Chat] Failed to save conversation:', upsertError);
      // Don't fail the request if DB save fails
    }

    // Calculate qualification score
    const qualificationScore = openaiService.calculateQualificationScore([sentiment]);

    // Trigger lead capture if qualified (score > 0.7 and 3+ messages)
    const shouldCaptureLeadNow = (
      qualificationScore > 0.7 &&
      conversationHistory.length >= 6 && // 3 exchanges
      !userMetadata?.email // Not already captured
    );

    res.json({
      success: true,
      response: aiResponse,
      conversationId: convId,
      sessionId: sessId,
      messageCount: conversationHistory.length,
      sentiment: {
        score: sentiment.score,
        intent: sentiment.intent,
        urgency: sentiment.urgency,
      },
      qualificationScore,
      shouldCaptureLeadNow,
    });

  } catch (error) {
    console.error('[Chat] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/voice/v1/chat/:conversationId
 * Retrieve conversation history
 */
router.get('/:conversationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;

    const data = await supabase.getChatConversation(conversationId);

    if (!data) {
      res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
      return;
    }

    res.json({
      success: true,
      conversation: data,
    });

  } catch (error) {
    console.error('[Chat] Retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversation',
    });
  }
});

/**
 * POST /api/voice/v1/chat/:conversationId/metadata
 * Update user metadata for a conversation (when lead is captured)
 */
router.post('/:conversationId/metadata', async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { name, email, phone } = req.body;

    const { error } = await supabase.updateChatMetadata(conversationId, { name, email, phone });

    if (error) {
      console.error('[Chat] Metadata update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update metadata',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Metadata updated successfully',
    });

  } catch (error) {
    console.error('[Chat] Metadata error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update metadata',
    });
  }
});

export default router;
