/**
 * AI Service (OpenAI & Groq)
 * Handles intelligent chat responses with GPT-4, Llama, and sentiment analysis
 */

import dotenv from 'dotenv';
dotenv.config();

import OpenAI from 'openai';
import Groq from 'groq-sdk';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface SentimentAnalysis {
  score: number; // 0-1, where 1 is most positive/interested
  intent: 'information' | 'demo' | 'pricing' | 'support' | 'purchase' | 'general';
  urgency: 'low' | 'medium' | 'high';
  keywords: string[];
}

export class OpenAIService {
  private provider: 'openai' | 'groq';
  private openaiClient?: OpenAI;
  private groqClient?: Groq;
  private model: string;

  constructor() {
    this.provider = (process.env.AI_PROVIDER as 'openai' | 'groq') || 'groq';

    // Initialize Groq (primary, faster)
    if (this.provider === 'groq') {
      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        console.warn('[AI] GROQ_API_KEY not set, falling back to OpenAI');
        this.provider = 'openai';
      } else {
        this.groqClient = new Groq({ apiKey: groqKey });
        this.model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
        console.log('[Groq] Service initialized with model:', this.model);
      }
    }

    // Initialize OpenAI (fallback)
    if (this.provider === 'openai' || !this.groqClient) {
      const openaiKey = process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        console.warn('[AI] No API keys configured, will use fallback responses');
      } else {
        this.openaiClient = new OpenAI({ apiKey: openaiKey });
        this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
        console.log('[OpenAI] Service initialized with model:', this.model);
      }
    }
  }

  /**
   * Get AI chat response with conversation context
   */
  async getChatResponse(
    userMessage: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<string> {
    try {
      const systemPrompt = `You are an expert AI sales assistant for CallWaitingAI, a voice AI receptionist service for UK businesses.

Your role is to:
- Answer questions about our AI voice receptionist service
- Explain features, pricing, and benefits clearly
- Qualify leads and identify purchase intent
- Guide users toward booking a demo or starting a free trial
- Be friendly, professional, and conversational

Key Information:
**Pricing:**
- Starter Plan: £99/month (50 calls, basic AI receptionist, email notifications)
- Pro Plan: £299/month (200 calls, advanced AI, priority support, Telegram/WhatsApp notifications)
- Enterprise: Custom pricing (unlimited calls, custom voice models, dedicated support, API access)

**Features:**
- 24/7 AI receptionists that never miss a call
- Natural conversation with customers
- Automatic lead capture and qualification
- Call recording & transcription
- Real-time notifications (Telegram/WhatsApp)
- Payment link generation
- CRM integration (Salesforce, HubSpot, Pipedrive)
- Multi-language support (50+ languages)
- Ultra-low latency (<500ms response time)

**Setup Process:**
1. Sign up (2 minutes)
2. Choose your plan
3. Configure AI receptionist
4. Connect phone number
5. Go live (most customers live within 24 hours)

**Support:**
- Live chat: Available now
- Email: support@callwaitingai.dev
- Phone: +44 (276) 582-5329
- 24/7 support for Pro and Enterprise plans

**Current Offer:**
- 30-day free trial with 100 free calls
- No credit card required
- Cancel anytime

Keep responses concise (2-3 paragraphs max). Use bullet points for lists. Always try to move the conversation toward a demo or trial signup. Ask qualifying questions when appropriate.`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      let completion: any;

      if (this.provider === 'groq' && this.groqClient) {
        // Use Groq (faster, Llama 3.3 70B)
        completion = await this.groqClient.chat.completions.create({
          model: this.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 500,
          top_p: 0.9,
        });
        console.log(`[Groq] Generated response (${completion.choices[0]?.message?.content?.length || 0} chars)`);
      } else if (this.openaiClient) {
        // Use OpenAI (GPT-4)
        completion = await this.openaiClient.chat.completions.create({
          model: this.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 500,
          presence_penalty: 0.6,
          frequency_penalty: 0.3,
        });
        console.log(`[OpenAI] Generated response (${completion.choices[0]?.message?.content?.length || 0} chars)`);
      } else {
        // No AI provider configured, use fallback
        return this.getFallbackResponse(userMessage);
      }

      const response = completion.choices[0]?.message?.content ||
        'I apologize, but I had trouble processing that. Could you rephrase your question?';

      return response;

    } catch (error) {
      console.error(`[${this.provider.toUpperCase()}] Chat completion error:`, error);

      // Fallback to knowledge base if AI fails
      console.log(`[${this.provider.toUpperCase()}] Falling back to knowledge base responses`);
      return this.getFallbackResponse(userMessage);
    }
  }

  /**
   * Fallback knowledge base when OpenAI API fails
   */
  private getFallbackResponse(message: string): string {
    const lowercaseMsg = message.toLowerCase();

    // Greeting
    if (lowercaseMsg.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
      return "Hello! I'm here to help you learn about CallWaitingAI's voice AI receptionist service. We help businesses never miss a call with 24/7 AI-powered voice receptionists.\n\nWhat would you like to know about? Our features, pricing, setup process, or would you like to see a demo?";
    }

    // Pricing questions
    if (lowercaseMsg.includes('price') || lowercaseMsg.includes('cost') || lowercaseMsg.includes('pricing') || lowercaseMsg.includes('plan')) {
      return "We offer flexible pricing plans to suit businesses of all sizes:\n\n💼 **Starter Plan** - £99/month\n• 50 calls included\n• Basic AI receptionist\n• Email notifications\n\n🚀 **Pro Plan** - £299/month\n• 200 calls included\n• Advanced AI with custom training\n• Priority support\n• Telegram & WhatsApp notifications\n\n🏢 **Enterprise** - Custom pricing\n• Unlimited calls\n• Custom voice models\n• Dedicated support\n• Full API access\n\nWe also offer a **30-day free trial** with 100 free calls - no credit card required! Would you like to start your free trial?";
    }

    // Features questions
    if (lowercaseMsg.includes('feature') || lowercaseMsg.includes('what can') || lowercaseMsg.includes('capability') || lowercaseMsg.includes('do')) {
      return "CallWaitingAI provides powerful features to transform your call handling:\n\n✅ **24/7 AI Receptionists** - Never miss a call, even outside business hours\n✅ **Natural Conversations** - Human-like voice interactions\n✅ **Automatic Lead Capture** - Collect caller information seamlessly\n✅ **Call Recording & Transcription** - Full call history and analysis\n✅ **Real-time Notifications** - Telegram, WhatsApp, Email alerts\n✅ **Payment Link Generation** - Collect payments during calls\n✅ **CRM Integration** - Salesforce, HubSpot, Pipedrive\n✅ **50+ Languages** - Multi-language support\n✅ **Custom Voice Training** - Tailor the AI to your business\n\nInterested in seeing how it works? I can arrange a live demo call to your phone right now!";
    }

    // Setup/How it works
    if (lowercaseMsg.includes('setup') || lowercaseMsg.includes('how') || lowercaseMsg.includes('start') || lowercaseMsg.includes('install') || lowercaseMsg.includes('work')) {
      return "Getting started with CallWaitingAI is incredibly simple:\n\n**5-Step Setup Process:**\n\n1️⃣ **Sign up** (takes just 2 minutes)\n2️⃣ **Choose your plan** (or start with free trial)\n3️⃣ **Configure your AI receptionist** (tell us about your business)\n4️⃣ **Connect your phone number** (we handle the technical setup)\n5️⃣ **Go live!** (start receiving AI-powered calls)\n\n⏱️ **Timeline:** Most customers are live within 24 hours\n🛠️ **Technical skills required:** None - we handle everything\n📞 **Support:** Our team guides you through every step\n\nReady to get started? I can connect you with our onboarding team or set up your free trial right now!";
    }

    // Integration questions
    if (lowercaseMsg.includes('integration') || lowercaseMsg.includes('integrate') || lowercaseMsg.includes('api') || lowercaseMsg.includes('connect')) {
      return "CallWaitingAI integrates seamlessly with the tools you already use:\n\n📞 **Phone Systems:**\n• Twilio\n• Vapi\n• Custom phone numbers\n\n💼 **CRM Platforms:**\n• Salesforce\n• HubSpot\n• Pipedrive\n\n💬 **Messaging:**\n• Telegram\n• WhatsApp\n• Slack\n\n💳 **Payment Processors:**\n• Stripe\n• Flutterwave\n• PayPal\n\n📊 **Analytics:**\n• Google Analytics\n• Mixpanel\n\nPlus, our **REST API** allows you to build completely custom integrations. Want to discuss your specific integration needs?";
    }

    // Demo requests
    if (lowercaseMsg.includes('demo') || lowercaseMsg.includes('try') || lowercaseMsg.includes('test') || lowercaseMsg.includes('show me')) {
      return "Excellent! I can set up a demo for you right now! 🎉\n\nChoose your preferred demo type:\n\n**1️⃣ Live Call Demo** - We'll call you in the next 2 minutes so you can experience our AI receptionist firsthand\n\n**2️⃣ Video Walkthrough** - Watch a recorded demo showing all features in action\n\n**3️⃣ Free Trial** - Get 30 days FREE with 100 calls to try it yourself (no credit card required)\n\nWhich would you prefer? Just let me know 1, 2, or 3, and I'll get you set up!";
    }

    // Support/Help
    if (lowercaseMsg.includes('support') || lowercaseMsg.includes('help') || lowercaseMsg.includes('contact')) {
      return "We're here to help! 🙌\n\n**Contact Options:**\n\n💬 **Live Chat:** Right here (that's me!)\n📧 **Email:** support@callwaitingai.dev\n📞 **Phone:** +44 (276) 582-5329\n💼 **Enterprise Support:** enterprise@callwaitingai.dev\n\n⏱️ **Response Time:** < 1 hour average\n🕐 **24/7 Support:** Available for Pro and Enterprise plans\n\nHow else can I assist you today?";
    }

    // Default/fallback
    return "Thanks for your question! I'm here to help you understand how CallWaitingAI can benefit your business.\n\nI can tell you about:\n• 💰 **Pricing** - Our flexible plans starting at £99/month\n• ⚡ **Features** - 24/7 AI receptionists, lead capture, integrations\n• 🚀 **Setup** - Quick 5-step process (live in 24 hours)\n• 🎯 **Demo** - See it in action with a live call or free trial\n\nWhat would you like to know more about? Or feel free to ask any specific questions!";
  }

  /**
   * Analyze sentiment and intent for lead qualification
   */
  async analyzeSentiment(message: string): Promise<SentimentAnalysis> {
    try {
      const prompt = `Analyze this customer message for sentiment, intent, and urgency. Return ONLY a JSON object with this exact structure:
{
  "score": 0.0-1.0,
  "intent": "information|demo|pricing|support|purchase|general",
  "urgency": "low|medium|high",
  "keywords": ["keyword1", "keyword2"]
}

Customer message: "${message}"

Analysis:`;

      const completion = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo', // Use faster model for analysis
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 150,
      });

      const responseText = completion.choices[0]?.message?.content || '{}';

      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid sentiment analysis response');
      }

      const analysis = JSON.parse(jsonMatch[0]);

      // Validate and set defaults
      return {
        score: Math.min(Math.max(analysis.score || 0.5, 0), 1),
        intent: ['information', 'demo', 'pricing', 'support', 'purchase', 'general'].includes(analysis.intent)
          ? analysis.intent
          : 'general',
        urgency: ['low', 'medium', 'high'].includes(analysis.urgency)
          ? analysis.urgency
          : 'medium',
        keywords: Array.isArray(analysis.keywords) ? analysis.keywords : [],
      };

    } catch (error) {
      console.error('[OpenAI] Sentiment analysis error:', error);
      // Return default values on error
      return {
        score: 0.5,
        intent: 'general',
        urgency: 'medium',
        keywords: [],
      };
    }
  }

  /**
   * Generate a qualification score based on conversation
   */
  calculateQualificationScore(sentimentHistory: SentimentAnalysis[]): number {
    if (sentimentHistory.length === 0) return 0.5;

    // Average sentiment score
    const avgSentiment = sentimentHistory.reduce((sum, s) => sum + s.score, 0) / sentimentHistory.length;

    // Intent scoring
    const intentScores = {
      purchase: 1.0,
      demo: 0.9,
      pricing: 0.8,
      information: 0.6,
      support: 0.5,
      general: 0.4,
    };

    const avgIntentScore = sentimentHistory.reduce((sum, s) =>
      sum + (intentScores[s.intent] || 0.5), 0
    ) / sentimentHistory.length;

    // Urgency scoring
    const urgencyScores = { high: 1.0, medium: 0.6, low: 0.3 };
    const avgUrgencyScore = sentimentHistory.reduce((sum, s) =>
      sum + (urgencyScores[s.urgency] || 0.5), 0
    ) / sentimentHistory.length;

    // Weighted average
    const qualificationScore = (
      avgSentiment * 0.3 +
      avgIntentScore * 0.5 +
      avgUrgencyScore * 0.2
    );

    return Math.min(Math.max(qualificationScore, 0), 1);
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();
