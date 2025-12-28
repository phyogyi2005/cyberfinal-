
export enum KnowledgeLevel {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
}

export type ChatMode = 'normal' | 'quiz' | 'learning' | 'analysis';

export interface User {
  id: string;
  name: string;
  email: string;
  knowledgeLevel: KnowledgeLevel;
}

export enum MessageType {
  TEXT = 'text',
  QUIZ = 'quiz',
  ANALYSIS = 'analysis'
}

export interface ChartData {
  name: string;
  value: number;
  fill?: string;
  [key: string]: any;
}

export interface AnalysisResult {
  riskLevel: 'Safe' | 'Low' | 'Medium' | 'High' | 'Critical';
  score: number; // 0-100
  findings: Array<{ category: string; details: string }>;
  chartData: ChartData[];
}

export interface QuizData {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

// Updated Message interface: added optional _id and made id optional to support 
// backend-generated IDs and fix compilation errors in App.tsx.
export interface Message {
  id?: string;
  _id?: string;
  role: 'user' | 'model';
  content: string;
  type: MessageType;
  timestamp: number;
  attachments?: Attachment[];
  quizData?: QuizData; 
  analysisData?: AnalysisResult;
}

export interface Attachment {
  type: 'image' | 'file';
  mimeType: string;
  data: string; // base64
  name: string;
}

// Updated ChatSession interface: added optional _id to support 
// database identifiers and fix property access errors in App.tsx.
export interface ChatSession {
  id: string;
  _id?: string;
  title: string;
  messages: Message[];
  lastUpdated: number;
}
