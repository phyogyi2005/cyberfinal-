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

export interface Message {
  id: string;
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

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: number;
}