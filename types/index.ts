export interface Notebook {
  id: string;
  title: string;
  icon: string;
  sources: Source[];
  lastModified: string;
  description: string;
}

export type SourceType = 'pdf' | 'text' | 'link';

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  data?: string; // base64 for PDF or encoded text for SourceType 'text'
  selected: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: number[];
}

export type ActivityType = 'notebook_opened' | 'source_added' | 'document_summarized' | 'semantic_search' | 'message_sent';

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  timestamp: Date;
  metadata?: string;
}
