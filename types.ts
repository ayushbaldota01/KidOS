

export enum View {
  FEED = 'FEED',
  CREATE = 'CREATE',
  CHAT = 'CHAT',
  PARENTS = 'PARENTS',
  TV = 'TV'
}

export enum ImageSize {
  S_1K = '1K',
  S_2K = '2K',
  S_4K = '4K'
}

export interface ParentSettings {
  pin: string;
  childName: string;
  childAge: number;
  focusTopics: string[]; // Topics parent wants to encourage
}

export interface ActivityLog {
  id: string;
  type: 'video' | 'chat' | 'fact' | 'create';
  details: string;
  timestamp: number;
  category: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageUrl?: string;
  isThinking?: boolean;
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface FeedItem {
  id: string;
  title: string;
  fact: string;
  imageUrl: string;
  topic: string;
}

export interface Book {
    id: string;
    title: string;
    emoji: string;
    color: string;
    description: string;
}

export interface Story {
    title: string;
    coverPrompt: string;
    pages: { text: string; imagePrompt?: string | null }[];
}

export interface LearnVideo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  category: string;
  script?: string;
  visualPrompts?: string[];
  slideImages?: string[]; // Array of generated image URLs for the slideshow
}

export interface GeneratedVideo {
  uri: string;
  mimeType: string;
}
