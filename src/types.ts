export type Priority = 'low' | 'medium' | 'high';
export type Status = 'todo' | 'in-progress' | 'completed';

export interface SubTask {
  id: string;
  title: string;
  completedPercentage: number;
  priority: Priority;
  dueDate: string;
  status: Status;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  subTasks: SubTask[];
  dependencies: string[]; // IDs of tasks this task depends on
  createdAt: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
