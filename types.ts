
export enum Role {
  User = 'user',
  Model = 'model'
}

export interface Attachment {
  mimeType: string;
  data: string; // base64
  uri?: string; // for display
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  searchEntryPoint?: {
    renderedContent: string;
  };
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  generatedImage?: string; // Base64 string of generated image
  timestamp: number;
  isStreaming?: boolean;
  isError?: boolean;
  groundingMetadata?: GroundingMetadata | null;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  modelId: string;
  updatedAt: number;
}

export interface ModelCapabilities {
  search: boolean;
  thinking: boolean;
  thinkingBudget?: number;
  imageGeneration?: boolean;
}

export interface ModelConfig {
  id: string;
  apiModelId: string;
  name: string;
  description: string;
  isPro: boolean;
  capabilities: ModelCapabilities;
}