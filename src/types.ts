export type Priority = 'low' | 'medium' | 'high';
export type Status = 'todo' | 'in-progress' | 'completed';

export interface SubTask {
  id: string;
  title: string;
  completedPercentage: number;
  priority: Priority;
  dueDate: string;
  status: Status;
  dependencies?: string[]; // IDs of other sub-tasks or parent tasks
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  subTasks: SubTask[];
  dependencies: string[]; // IDs of tasks this task depends on
  createdAt: string;
  dueDate?: string; // Optional top-level due date
  uid: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export type JournalType = 'commitment' | 'quote' | 'milestone';

export interface JournalEntry {
  id: string;
  type: JournalType;
  content: string;
  author?: string; // For quotes
  createdAt: string;
  uid: string;
}
