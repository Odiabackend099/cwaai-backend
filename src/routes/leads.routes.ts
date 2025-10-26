import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { SupabaseService } from '../services/supabase.service';
import { TelegramService } from '../services/telegram.service';
import { FlutterwaveService } from '../services/flutterwave.service';

const router = Router();
const supabase = new SupabaseService();
const telegram = new TelegramService();
const flutterwave = new FlutterwaveService();

interface LeadRequest {
  name: string;
  email: string;
  phone?: string;
  source: string;
  metadata?: Record<string, any>;
}

/**
 * GET /api/voice/v1/leads
 * Retrieve all leads (requires authentication)
 */
router.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 50, offset = 0, source, status } = req.query;

    let query = supabase.client
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (source) {
      query = query.eq('source', source);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: leads, error } = await query;

    if (error) {
      console.error('Database error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve leads',
      });
      return;
    }

    res.json({
      success: true,
      leads,
      count: leads?.length || 0,
    });

  } catch (error) {
    console.error('Lead retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/voice/v1/leads
 * Create a new lead from AI widget or other sources
 * Public endpoint (no auth required for lead capture)
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, phone, source, metadata }: LeadRequest = req.body;

    // Validation
    if (!name || !email) {
      res.status(400).json({
        success: false,
        error: 'Name and email are required',
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: 'Invalid email format',
      });
      return;
    }

    // Save to database
    const leadData = {
      name,
      email,
      phone: phone || null,
      source: source || 'unknown',
      qualification_score: 0.5, // Default moderate interest
      status: 'new',
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    };

    const { data: lead, error: dbError } = await supabase.client
      .from('leads')
      .insert([leadData])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      res.status(500).json({
        success: false,
        error: 'Failed to save lead',
      });
      return;
    }

    // Send Telegram notification
    try {
      const telegramMessage = `
🎯 **New Lead from ${source}**

👤 **Name:** ${name}
📧 **Email:** ${email}
${phone ? `📞 **Phone:** ${phone}` : ''}

🔍 **Source:** ${source}
${metadata?.conversationLength ? `💬 **Messages:** ${metadata.conversationLength}` : ''}

**Lead ID:** ${lead.id}
**Time:** ${new Date().toLocaleString()}
      `.trim();

      await telegram.sendMessage(telegramMessage);
    } catch (telegramError) {
      console.error('Telegram notification failed:', telegramError);
      // Don't fail the request if Telegram fails
    }

    // Generate payment link if applicable
    let paymentLink = null;
    if (source === 'ai_widget' || source === 'pricing_page') {
      try {
        paymentLink = await flutterwave.generatePaymentLink({
          customer: { name, email, phone_number: phone || '' },
          amount: 99, // Default to Starter plan
          currency: 'USD',
          tx_ref: `lead-${lead.id}-${Date.now()}`,
          customizations: {
            title: 'CallWaitingAI Subscription',
            description: 'Get started with AI-powered voice reception',
          },
        });

        // Update lead with payment link
        await supabase.client
          .from('leads')
          .update({ flutterwave_payment_link: paymentLink })
          .eq('id', lead.id);

      } catch (paymentError) {
        console.error('Payment link generation failed:', paymentError);
        // Don't fail the request if payment link fails
      }
    }

    res.status(201).json({
      success: true,
      lead: {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        status: lead.status,
      },
      paymentLink,
      message: 'Lead captured successfully! Our team will reach out soon.',
    });

  } catch (error) {
    console.error('Lead creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/voice/v1/leads/:id
 * Get single lead details (requires authentication)
 */
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: lead, error } = await supabase.client
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !lead) {
      res.status(404).json({
        success: false,
        error: 'Lead not found',
      });
      return;
    }

    res.json({
      success: true,
      lead,
    });

  } catch (error) {
    console.error('Lead retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * PATCH /api/voice/v1/leads/:id
 * Update lead status or details (requires authentication)
 */
router.patch('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Prevent updating certain fields
    delete updates.id;
    delete updates.created_at;

    const { data: lead, error } = await supabase.client
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error || !lead) {
      res.status(404).json({
        success: false,
        error: 'Lead not found or update failed',
      });
      return;
    }

    res.json({
      success: true,
      lead,
    });

  } catch (error) {
    console.error('Lead update error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
