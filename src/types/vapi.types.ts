/**
 * Vapi API Types
 * Based on Vapi API documentation
 */

export interface VapiCallRequest {
  assistantId: string;
  customer: {
    number: string;
    name?: string;
    extension?: string;
  };
  phoneNumberId?: string;
  metadata?: Record<string, any>;
}

export interface VapiCallResponse {
  id: string;
  orgId: string;
  assistantId: string;
  customer: {
    number: string;
    name?: string;
  };
  phoneNumberId?: string;
  status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
  type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
  startedAt?: string;
  endedAt?: string;
  cost?: number;
  costBreakdown?: {
    transport?: number;
    stt?: number;
    llm?: number;
    tts?: number;
    vapi?: number;
    total?: number;
  };
  messages?: Array<{
    role: 'assistant' | 'user' | 'system' | 'function';
    message: string;
    time: number;
  }>;
  transcript?: string;
  recordingUrl?: string;
  stereoRecordingUrl?: string;
  summary?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface VapiAssistant {
  id: string;
  orgId: string;
  name: string;
  model: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  voice: {
    provider: string;
    voiceId: string;
  };
  firstMessage?: string;
  systemPrompt?: string;
  recordingEnabled?: boolean;
  endCallMessage?: string;
  endCallPhrases?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface VapiWebhookEvent {
  type: 'call.started' | 'call.ended' | 'call.failed' | 'transcript' | 'hang' | 'speech-update' | 'status-update' | 'function-call';
  call?: VapiCallResponse;
  message?: {
    type: 'transcript' | 'hang' | 'function-call';
    transcript?: string;
    role?: 'user' | 'assistant';
    functionCall?: {
      name: string;
      parameters: Record<string, any>;
    };
  };
  timestamp: string;
}

export interface VapiPhoneNumber {
  id: string;
  orgId: string;
  number: string;
  provider: string;
  assistantId?: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VapiError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// Abstract Voice Provider Interface (for future ODIADEV-TTS migration)
export interface VoiceProvider {
  initiateCall(params: VapiCallRequest): Promise<VapiCallResponse>;
  getCall(callId: string): Promise<VapiCallResponse>;
  listCalls(params?: { limit?: number; offset?: number }): Promise<VapiCallResponse[]>;
  createAssistant(config: Partial<VapiAssistant>): Promise<VapiAssistant>;
  updateAssistant(assistantId: string, config: Partial<VapiAssistant>): Promise<VapiAssistant>;
  getAssistant(assistantId: string): Promise<VapiAssistant>;
  deleteAssistant(assistantId: string): Promise<void>;
  getPhoneNumber(phoneNumberId: string): Promise<VapiPhoneNumber>;
}
