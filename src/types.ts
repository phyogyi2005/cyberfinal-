
export enum KnowledgeLevel {
  Beginner = 'Beginner',
  Intermediate = 'Intermediate',
  Advanced = 'Advanced',
}

export type ChatMode = 'normal' | 'quiz' | 'learning' | 'analysis';

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  knowledgeLevel: KnowledgeLevel;
}

export enum MessageType {
  TEXT = 'text',
  QUIZ = 'quiz',
  ANALYSIS = 'analysis'
}

export interface AnalysisResult {
  riskLevel: 'Safe' | 'Low' | 'Medium' | 'High' | 'Critical';
  score: number;
  findings: Array<{ category: string; details: string }>;
  chartData: Array<{ name: string; value: number; fill?: string }>;
}

export interface QuizData {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Message {
  id?: string;
  _id?: string;
  role: 'user' | 'model';
  content: string;
  type: MessageType;
  timestamp: number;
  quizData?: QuizData; 
  analysisData?: AnalysisResult;
}

export interface Attachment {
  type: 'image' | 'file';
  mimeType: string;
  data: string;
  name: string;
}

export interface ChatSession {
  id: string;
  _id: string;
  title: string;
  mode: ChatMode;
  lastUpdated: number;
}
