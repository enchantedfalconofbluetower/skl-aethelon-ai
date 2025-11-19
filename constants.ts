import { ModelConfig } from './types';

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'gemini-2.5-flash',
    apiModelId: 'gemini-2.5-flash',
    name: 'Aethelon Flash',
    description: 'Fastest model for everyday tasks',
    isPro: false,
    capabilities: { search: false, thinking: false }
  },
  {
    id: 'gemini-2.5-flash-search',
    apiModelId: 'gemini-2.5-flash',
    name: 'Aethelon + Search',
    description: 'Up-to-date information from the web',
    isPro: false,
    capabilities: { search: true, thinking: false }
  },
  {
    id: 'gemini-2.5-flash-thinking',
    apiModelId: 'gemini-2.5-flash',
    name: 'Aethelon Thinking',
    description: 'Enhanced reasoning capabilities',
    isPro: true,
    capabilities: { search: false, thinking: true, thinkingBudget: 10000 }
  },
  {
    id: 'gemini-3-pro-preview',
    apiModelId: 'gemini-3-pro-preview',
    name: 'Aethelon Pro',
    description: 'Complex reasoning and coding',
    isPro: true,
    capabilities: { search: false, thinking: false }
  },
  {
    id: 'gemini-2.5-flash-image',
    apiModelId: 'gemini-2.5-flash-image',
    name: 'Aethelon Imagine',
    description: 'Generate AI images',
    isPro: true,
    capabilities: { search: false, thinking: false, imageGeneration: true }
  }
];

export const DEFAULT_MODEL_ID = 'gemini-2.5-flash';
export const MAX_FILE_SIZE_MB = 10;
export const APP_NAME = "SKL Aethelon";
export const CREATOR_NAME = "Shreeman Iyer";
export const WELCOME_MESSAGE = "How can I help you today?";