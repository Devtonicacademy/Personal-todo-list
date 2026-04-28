/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  ChevronRight, 
  ChevronDown, 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle,
  Network,
  LayoutDashboard,
  MessageSquare,
  Send,
  Search,
  ArrowRight,
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  LogIn,
  GripVertical,
  ListFilter,
  BookOpen,
  Quote,
  Trophy,
  Target,
} from 'lucide-react';
import { format, isSameDay, parseISO, addDays, startOfToday } from 'date-fns';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import * as d3 from 'd3';
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import { Task, SubTask, Priority, Status, ChatMessage, JournalEntry, JournalType } from './types';
import { auth, db, googleProvider, signInWithPopup, signOut } from './firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  getDocFromServer
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

const PERSONAL_USER = {
  uid: 'personal_user_123',
  displayName: 'Personal Owner',
  email: 'personal@example.com',
  photoURL: 'https://ui-avatars.com/api/?name=P+O&background=000&color=fff'
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, errorInfo: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.errorInfo || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          displayMessage = "You don't have permission to perform this action. Please check your login status.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#141414] p-8 rounded-3xl border border-gray-200 dark:border-[#262626] shadow-xl text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-4 dark:text-white">Application Error</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">{displayMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold hover:opacity-90 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <TaskFlowApp />
    </ErrorBoundary>
  );
}

function SidebarContent({ 
  user, 
  activeTab, 
  setActiveTab, 
  setIsSidebarOpen, 
  theme, 
  setTheme, 
  handleLogout, 
}: { 
  user: any; 
  activeTab: string; 
  setActiveTab: (tab: any) => void;
  setIsSidebarOpen: (open: boolean) => void;
  theme: string;
  setTheme: (theme: any) => void;
  handleLogout: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
            <LayoutDashboard className="text-white dark:text-black w-5 h-5" />
          </div>
          <h1 className="font-bold text-xl tracking-tight dark:text-white">TaskFlow</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg dark:text-white"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex flex-col gap-2">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { id: 'flow', icon: Network, label: 'Flow View' },
          { id: 'daily', icon: Calendar, label: 'Daily Planner' },
          { id: 'journal', icon: BookOpen, label: 'Journal' }
        ].map(item => (
          <button 
            key={item.id}
            onClick={() => {
              setActiveTab(item.id as any);
              setIsSidebarOpen(false);
            }}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
              activeTab === item.id 
                ? "bg-black dark:bg-white text-white dark:text-black shadow-lg" 
                : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            )}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-[#262626] flex items-center gap-3">
          <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate dark:text-white">{user.displayName}</p>
          </div>
        </div>
        <button 
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="lg:flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 py-3 rounded-xl transition-colors font-medium text-gray-700 dark:text-gray-300"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
      </div>
    </>
  );
}

function TaskFlowApp() {
  const [user, setUser] = useState<any>(PERSONAL_USER);
  const [isAuthReady, setIsAuthReady] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'flow' | 'daily' | 'journal'>('dashboard');
  const [sortBy, setSortBy] = useState<'created' | 'due' | 'priority'>('created');

  const sortedTasks = useMemo(() => {
    const sorted = [...tasks];
    switch (sortBy) {
      case 'priority':
        const priorityScore = { high: 3, medium: 2, low: 1 };
        return sorted.sort((a, b) => priorityScore[b.priority] - priorityScore[a.priority]);
      case 'due':
        return sorted.sort((a, b) => {
          const aDue = a.dueDate || '9999';
          const bDue = b.dueDate || '9999';
          return aDue.localeCompare(bDue);
        });
      case 'created':
      default:
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [tasks, sortBy]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });

  // Theme effect only
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sync tasks from Firestore
  useEffect(() => {
    const q = query(collection(db, 'tasks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList: Task[] = [];
      snapshot.forEach((doc) => {
        taskList.push(doc.data() as Task);
      });
      setTasks(taskList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => unsubscribe();
  }, []);

  // Remove the large seed function as it's no longer needed for "personal" context by default
  const seedInitialData = async () => {
    // ... logic removed to simplify
  };

  // Sync journal entries from Firestore
  useEffect(() => {
    const q = query(collection(db, 'journal'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entryList: JournalEntry[] = [];
      snapshot.forEach((doc) => {
        entryList.push(doc.data() as JournalEntry);
      });
      setJournalEntries(entryList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'journal');
    });

    return () => unsubscribe();
  }, []);

  const addJournalEntry = async (type: JournalType, content: string, author?: string) => {
    const entryId = `journal_${Math.random().toString(36).substr(2, 9)}`;
    const newEntry: any = {
      id: entryId,
      type,
      content,
      createdAt: new Date().toISOString(),
      ...(author && author.trim() ? { author } : {})
    };
    try {
      await setDoc(doc(db, 'journal', entryId), newEntry);
    } catch (error) {
      alert("Failed to save entry. Please check your connection.");
      handleFirestoreError(error, OperationType.WRITE, `journal/${entryId}`);
    }
  };

  const deleteJournalEntry = async (entryId: string) => {
    try {
      await deleteDoc(doc(db, 'journal', entryId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `journal/${entryId}`);
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("This domain is not authorized in your Firebase project. Please add '" + window.location.hostname + "' to the 'Authorized domains' list in the Firebase Console (Authentication > Settings).");
      } else {
        alert("Login failed: " + error.message);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const addTask = async () => {
    const taskId = Math.random().toString(36).substr(2, 9);
    const newTask: Task = {
      id: taskId,
      title: 'New Task',
      description: '',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      dueDate: addDays(new Date(), 7).toISOString(),
      dependencies: [],
      subTasks: []
    } as any;
    
    try {
      console.log(`Creating new task with ID: ${taskId}`);
      await setDoc(doc(db, 'tasks', taskId), newTask);
      console.log("Task created successfully");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tasks/${taskId}`);
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    try {
      await updateDoc(doc(db, 'tasks', id), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
      // Also clean up dependencies in other tasks
      const dependentTasks = tasks.filter(t => t.dependencies.includes(id));
      for (const t of dependentTasks) {
        await updateDoc(doc(db, 'tasks', t.id), {
          dependencies: t.dependencies.filter(depId => depId !== id)
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const addSubTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSub: SubTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Sub-task',
      completedPercentage: 0,
      priority: 'medium',
      dueDate: new Date().toISOString(),
      status: 'todo'
    };

    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        subTasks: [...task.subTasks, newSub]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const updateSubTask = async (taskId: string, subId: string, updates: Partial<SubTask>) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newSubTasks = task.subTasks.map(s => s.id === subId ? { ...s, ...updates } : s);
    try {
      await updateDoc(doc(db, 'tasks', taskId), { subTasks: newSubTasks });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const reorderSubTasks = async (taskId: string, newSubTasks: SubTask[]) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { subTasks: newSubTasks });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const deleteSubTask = async (taskId: string, subId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      await updateDoc(doc(db, 'tasks', taskId), { 
        subTasks: task.subTasks.filter(s => s.id !== subId) 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="w-12 h-12 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-sans transition-colors duration-300">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-[#141414] border-b border-gray-200 dark:border-[#262626] flex items-center justify-between px-6 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
            <LayoutDashboard className="text-white dark:text-black w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">TaskFlow</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Sidebar / Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Overlay for mobile */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-md z-[60]"
            />
            
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed left-0 top-0 h-full w-72 bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-[#262626] p-6 flex flex-col gap-8 z-[70] shadow-2xl"
            >
              <SidebarContent 
                user={user} 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                setIsSidebarOpen={setIsSidebarOpen}
                theme={theme}
                setTheme={setTheme}
                handleLogout={handleLogout}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-[#262626] p-6 flex-col gap-8 z-30">
        <SidebarContent 
          user={user} 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          setIsSidebarOpen={setIsSidebarOpen}
          theme={theme}
          setTheme={setTheme}
          handleLogout={handleLogout}
        />
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-6 lg:p-10 pt-24 lg:pt-10">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-5xl mx-auto"
            >
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-black dark:text-white">My Tasks</h2>
                  <p className="text-gray-500 mt-1">Manage your projects and their sub-tasks.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2 border border-gray-200 dark:border-gray-700">
                    <ListFilter size={16} className="text-gray-400 mr-2" />
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer dark:text-white"
                    >
                      <option value="created">Recently Created</option>
                      <option value="due">Due Date</option>
                      <option value="priority">Priority</option>
                    </select>
                  </div>
                  <button 
                    onClick={addTask}
                    className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-all shadow-md active:scale-95 shadow-black/10 dark:bg-white dark:text-black dark:hover:bg-gray-200"
                  >
                    <Plus size={20} />
                    Add Task
                  </button>
                </div>
              </div>

              <div className="grid gap-6">
                {sortedTasks.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-[#141414] rounded-3xl border border-gray-200 dark:border-[#262626] shadow-sm">
                    <LayoutDashboard className="w-16 h-16 text-gray-200 dark:text-gray-800 mx-auto mb-6" />
                    <h3 className="text-xl font-bold mb-2">No tasks found</h3>
                    <p className="text-gray-500 mb-8 max-w-xs mx-auto">Your database is currently empty. Start fresh by adding your first task.</p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <button 
                        onClick={addTask}
                        className="bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all"
                      >
                        <Plus size={20} />
                        Add First Task
                      </button>
                    </div>
                  </div>
                ) : (
                  sortedTasks.map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      allTasks={tasks}
                      onUpdate={updateTask} 
                      onDelete={deleteTask}
                      onAddSubTask={addSubTask}
                      onUpdateSubTask={updateSubTask}
                      onDeleteSubTask={deleteSubTask}
                      onReorderSubTasks={reorderSubTasks}
                    />
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'flow' && (
            <motion.div 
              key="flow"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-[calc(100vh-80px)]"
            >
              <FlowDiagram tasks={tasks} />
            </motion.div>
          )}

          {activeTab === 'journal' && (
            <motion.div 
              key="journal"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto"
            >
              <JournalView 
                entries={journalEntries} 
                onAdd={addJournalEntry} 
                onDelete={deleteJournalEntry} 
              />
            </motion.div>
          )}

          {activeTab === 'daily' && (
            <motion.div 
              key="daily"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <DailyView tasks={tasks} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function TaskCard({ 
  task, 
  allTasks,
  onUpdate, 
  onDelete, 
  onAddSubTask, 
  onUpdateSubTask, 
  onDeleteSubTask,
  onReorderSubTasks
}: { 
  task: Task; 
  allTasks: Task[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAddSubTask: (taskId: string) => void;
  onUpdateSubTask: (taskId: string, subId: string, updates: Partial<SubTask>) => void;
  onDeleteSubTask: (taskId: string, subId: string) => void;
  onReorderSubTasks: (taskId: string, newSubTasks: SubTask[]) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const avgCompletion = task.subTasks.length > 0 
    ? Math.round(task.subTasks.reduce((acc, s) => acc + s.completedPercentage, 0) / task.subTasks.length)
    : 0;

  const priorityConfig = {
    low: { color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: Circle },
    medium: { color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', icon: Clock },
    high: { color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: AlertCircle },
  };

  const config = priorityConfig[task.priority];

  return (
    <div className={cn(
      "bg-white dark:bg-[#141414] rounded-2xl border-l-4 overflow-hidden shadow-sm hover:shadow-md transition-all",
      task.priority === 'high' ? "border-l-red-500 border-y-gray-200 border-r-gray-200 dark:border-y-[#262626] dark:border-r-[#262626]" :
      task.priority === 'medium' ? "border-l-orange-500 border-y-gray-200 border-r-gray-200 dark:border-y-[#262626] dark:border-r-[#262626]" :
      "border-l-blue-500 border-y-gray-200 border-r-gray-200 dark:border-y-[#262626] dark:border-r-[#262626]",
      "border-y border-r"
    )}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", config.bg, config.color)}>
                <config.icon size={12} />
                {task.priority} Priority
              </div>
              <select 
                value={task.priority}
                onChange={(e) => onUpdate(task.id, { priority: e.target.value as Priority })}
                className="text-[10px] bg-transparent border-none p-0 focus:ring-0 font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                <option value="low">Change to Low</option>
                <option value="medium">Change to Medium</option>
                <option value="high">Change to High</option>
              </select>
            </div>
            <input 
              type="text" 
              value={task.title}
              onChange={(e) => onUpdate(task.id, { title: e.target.value })}
              className="text-xl font-bold bg-transparent border-none p-0 focus:ring-0 w-full dark:text-white"
            />
            <textarea 
              value={task.description}
              onChange={(e) => onUpdate(task.id, { description: e.target.value })}
              placeholder="Add a description..."
              className="text-gray-500 dark:text-gray-400 text-sm bg-transparent border-none p-0 focus:ring-0 w-full mt-1 resize-none h-6"
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => onDelete(task.id)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
            >
              <Trash2 size={18} />
            </button>
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
            >
              {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-6">
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden text-black dark:text-white">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${avgCompletion}%` }}
              className="h-full bg-black dark:bg-white"
            />
          </div>
          <span className="text-sm font-bold w-10 dark:text-white">{avgCompletion}%</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 items-center text-xs text-gray-400 font-medium">
          <div className="flex items-center gap-1.5 shrink-0">
            <Clock size={14} />
            Created {format(parseISO(task.createdAt), 'MMM d')}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Calendar size={14} />
            Due {task.dueDate ? format(parseISO(task.dueDate), 'MMM d') : 'No date'}
            <input 
              type="date" 
              className="w-4 h-4 opacity-0 absolute cursor-pointer"
              onChange={(e) => onUpdate(task.id, { dueDate: new Date(e.target.value).toISOString() })}
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Network size={14} />
            {task.dependencies.length} Dependencies
          </div>
          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto overflow-hidden">
            <span className="text-gray-300 dark:text-gray-600">Depends on:</span>
            <select 
              className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg py-1 px-2 text-gray-600 dark:text-gray-400 focus:ring-1 focus:ring-black dark:focus:ring-white shrink-0"
              onChange={(e) => {
                if (e.target.value && !task.dependencies.includes(e.target.value)) {
                  onUpdate(task.id, { dependencies: [...task.dependencies, e.target.value] });
                }
              }}
              value=""
            >
              <option value="">Add Dependency</option>
              {allTasks.filter(t => t.id !== task.id && !task.dependencies.includes(t.id)).map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              {task.dependencies.map(depId => (
                <span key={depId} className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-1 rounded flex items-center gap-1">
                  {allTasks.find(t => t.id === depId)?.title}
                  <button 
                    onClick={() => onUpdate(task.id, { dependencies: task.dependencies.filter(d => d !== depId) })}
                    className="hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="border-t border-gray-50 dark:border-[#262626] bg-gray-50/50 dark:bg-black/20"
          >
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Sub-tasks & Checklist</h4>
                <button 
                  onClick={() => onAddSubTask(task.id)}
                  className="text-xs font-bold text-black dark:text-white flex items-center gap-1 hover:underline"
                >
                  <Plus size={14} />
                  Add Sub-task
                </button>
              </div>
              
              {task.subTasks.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-2">No sub-tasks added yet.</p>
              ) : (
                <Reorder.Group 
                  axis="y" 
                  values={task.subTasks} 
                  onReorder={(newOrder) => onReorderSubTasks(task.id, newOrder)}
                  className="space-y-3"
                >
                  {task.subTasks.map(sub => (
                    <SubTaskItem 
                      key={sub.id} 
                      sub={sub} 
                      onUpdate={(updates) => onUpdateSubTask(task.id, sub.id, updates)}
                      onDelete={() => onDeleteSubTask(task.id, sub.id)}
                    />
                  ))}
                </Reorder.Group>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubTaskItem({ sub, onUpdate, onDelete }: { 
  sub: SubTask; 
  onUpdate: (updates: Partial<SubTask>) => void;
  onDelete: () => void;
}) {
  const priorityConfig = {
    low: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: Circle },
    medium: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', icon: Clock },
    high: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', icon: AlertCircle },
  };

  const config = priorityConfig[sub.priority];

  return (
    <Reorder.Item 
      value={sub}
      id={sub.id}
      className={cn(
        "bg-white dark:bg-[#141414] p-4 rounded-xl border border-gray-100 dark:border-[#262626] flex flex-col sm:flex-row sm:items-center gap-4 group shadow-sm transition-all",
        sub.priority === 'high' && "border-l-2 border-l-red-500",
        sub.priority === 'medium' && "border-l-2 border-l-orange-500",
        sub.priority === 'low' && "border-l-2 border-l-blue-500"
      )}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-700 hover:text-gray-500 transition-colors shrink-0">
          <GripVertical size={16} />
        </div>
        
        <button 
          onClick={() => onUpdate({ 
            status: sub.status === 'completed' ? 'todo' : 'completed',
            completedPercentage: sub.status === 'completed' ? 0 : 100
          })}
          className="text-gray-300 dark:text-gray-600 hover:text-black dark:hover:text-white transition-colors shrink-0"
        >
          {sub.status === 'completed' ? <CheckCircle2 className="text-black dark:text-white" /> : <Circle />}
        </button>

        <div className="flex-1 flex flex-col">
          <input 
            type="text" 
            value={sub.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            className={cn(
              "font-medium bg-transparent border-none p-0 focus:ring-0 text-sm min-w-[150px] dark:text-white",
              sub.status === 'completed' && "line-through text-gray-400 dark:text-gray-600"
            )}
          />
          <div className={cn("flex items-center gap-1 text-[9px] font-bold uppercase mt-0.5", config.color)}>
            <config.icon size={10} />
            {sub.priority}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-400">Progress</label>
          <div className="flex items-center gap-2">
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={sub.completedPercentage}
              onChange={(e) => onUpdate({ completedPercentage: parseInt(e.target.value) })}
              className="w-20 accent-black dark:accent-white"
            />
            <span className="text-xs font-bold w-8 dark:text-white">{sub.completedPercentage}%</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-400">Priority</label>
          <select 
            value={sub.priority}
            onChange={(e) => onUpdate({ priority: e.target.value as Priority })}
            className={cn(
              "text-xs font-bold border-none rounded-lg py-1 px-2 focus:ring-0 cursor-pointer",
              config.bg, config.color
            )}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-bold text-gray-400">Due Date</label>
          <input 
            type="date" 
            value={sub.dueDate.split('T')[0]}
            onChange={(e) => onUpdate({ dueDate: new Date(e.target.value).toISOString() })}
            className="text-xs font-bold bg-gray-50 dark:bg-gray-800 border-none rounded-lg py-1 px-2 focus:ring-0 dark:text-white cursor-pointer"
          />
        </div>

        <button 
          onClick={onDelete}
          className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-100 transition-all ml-auto sm:ml-0"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </Reorder.Item>
  );
}

function FlowDiagram({ tasks }: { tasks: Task[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = window.document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || tasks.length === 0) return;

    const updateDimensions = () => {
      if (!containerRef.current || !svgRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      // Prepare data for D3
      const nodes = tasks.map(t => ({ id: t.id, title: t.title }));
      const links: any[] = [];
      tasks.forEach(t => {
        t.dependencies.forEach(depId => {
          links.push({ source: depId, target: t.id });
        });
      });

      const simulation = d3.forceSimulation(nodes as any)
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance(150))
        .force("charge", d3.forceManyBody().strength(-1000))
        .force("center", d3.forceCenter(width / 2, height / 2));

      // Arrow marker
      svg.append("defs").append("marker")
        .attr("id", "arrowhead")
        .attr("viewBox", "-0 -5 10 10")
        .attr("refX", 25)
        .attr("refY", 0)
        .attr("orient", "auto")
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("xoverflow", "visible")
        .append("svg:path")
        .attr("d", "M 0,-5 L 10 ,0 L 0,5")
        .attr("fill", theme === 'dark' ? "#555" : "#999")
        .style("stroke", "none");

      const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("stroke", theme === 'dark' ? "#333" : "#ddd")
        .attr("stroke-width", 2)
        .attr("marker-end", "url(#arrowhead)");

      const node = svg.append("g")
        .selectAll("g")
        .data(nodes)
        .enter().append("g")
        .call(d3.drag<any, any>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

      node.append("rect")
        .attr("width", 140)
        .attr("height", 50)
        .attr("x", -70)
        .attr("y", -25)
        .attr("rx", 12)
        .attr("fill", theme === 'dark' ? "#1a1a1a" : "white")
        .attr("stroke", theme === 'dark' ? "#444" : "#000")
        .attr("stroke-width", 1.5)
        .style("filter", "drop-shadow(0 4px 6px rgba(0,0,0,0.1))");

      node.append("text")
        .text(d => d.title.length > 15 ? d.title.substring(0, 12) + '...' : d.title)
        .attr("text-anchor", "middle")
        .attr("dy", ".35em")
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .attr("fill", theme === 'dark' ? "#fff" : "#000");

      simulation.on("tick", () => {
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);

        node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
      });

      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }

      function dragged(event: any) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [tasks, theme]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white dark:bg-[#141414] rounded-3xl border border-gray-200 dark:border-[#262626] overflow-hidden relative">
      <div className="absolute top-6 left-6 z-10">
        <h3 className="font-bold text-lg dark:text-white">Process Flow</h3>
        <p className="text-sm text-gray-400">Visualize task dependencies and workflow.</p>
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-move" />
    </div>
  );
}

function JournalView({ 
  entries, 
  onAdd, 
  onDelete 
}: { 
  entries: JournalEntry[]; 
  onAdd: (type: JournalType, content: string, author?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newContent, setNewContent] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [selectedType, setSelectedType] = useState<JournalType>('commitment');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    onAdd(selectedType, newContent, selectedType === 'quote' ? newAuthor : undefined);
    setNewContent('');
    setNewAuthor('');
    setIsAdding(false);
  };

  const typeConfig: Record<JournalType, { icon: any; color: string; bg: string; label: string }> = {
    commitment: { icon: Target, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'Commitment' },
    quote: { icon: Quote, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', label: 'Inspiration' },
    milestone: { icon: Trophy, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Milestone' }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-black dark:text-white">Growth Journal</h2>
          <p className="text-gray-500 mt-1">Reflect on your commitments, inspirations, and victories.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-all shadow-md dark:bg-white dark:text-black dark:hover:bg-gray-200"
        >
          {isAdding ? <X size={20} /> : <Plus size={20} />}
          {isAdding ? 'Cancel' : 'New Entry'}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white dark:bg-[#141414] p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-[#262626] shadow-xl"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {(['commitment', 'quote', 'milestone'] as JournalType[]).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border-2",
                      selectedType === type 
                        ? cn("border-black dark:border-white", typeConfig[type].bg) 
                        : "border-transparent bg-gray-50 dark:bg-gray-800"
                    )}
                  >
                    {React.createElement(typeConfig[type].icon, { size: 20, className: typeConfig[type].color })}
                    <span className="text-xs font-bold uppercase tracking-wider dark:text-white">{typeConfig[type].label}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <textarea 
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder={
                    selectedType === 'commitment' ? "What are you committing to today?" :
                    selectedType === 'quote' ? "Write down a motivational quote..." :
                    "What major achievement are you celebrating?"
                  }
                  className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-5 min-h-[120px] focus:ring-2 focus:ring-black dark:focus:ring-white transition-all dark:text-white"
                  required
                />
                
                {selectedType === 'quote' && (
                  <input 
                    type="text"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    placeholder="Author name"
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl p-5 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all dark:text-white"
                  />
                )}
              </div>

              <button 
                type="submit"
                className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                Save Entry
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-6">
        {entries.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#141414] rounded-3xl border border-gray-200 dark:border-[#262626]">
            <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="text-gray-300 dark:text-gray-600 w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2 dark:text-white">Your journal is empty</h3>
            <p className="text-gray-500 max-w-xs mx-auto">Start logging your daily commitments and achievements.</p>
          </div>
        ) : (
          entries.map((entry) => {
            const config = typeConfig[entry.type];
            return (
              <motion.div 
                layout
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-[#141414] p-6 sm:p-8 rounded-3xl border border-gray-200 dark:border-[#262626] relative group hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-6">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", config.bg)}>
                    {React.createElement(config.icon, { className: config.color, size: 24 })}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                       <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md", config.bg, config.color)}>
                        {config.label}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        {format(parseISO(entry.createdAt), 'MMM d, yyyy')}
                      </span>
                    </div>
                    
                    <div className={cn(
                      "text-lg sm:text-xl font-medium leading-relaxed dark:text-white",
                      entry.type === 'quote' && "italic font-serif"
                    )}>
                      {entry.type === 'quote' && <span className="text-4xl text-gray-200 dark:text-gray-800 absolute -left-2 top-8 -z-10">"</span>}
                      {entry.content}
                    </div>

                    {entry.type === 'quote' && entry.author && (
                      <p className="mt-4 text-sm text-gray-500 font-bold">— {entry.author}</p>
                    )}
                  </div>
                  <button 
                    onClick={() => onDelete(entry.id)}
                    className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

function DailyView({ tasks }: { tasks: Task[] }) {
  const [selectedDate, setSelectedDate] = useState(startOfToday());

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(startOfToday(), i - 3));
  }, []);

  const dailyTasks = useMemo(() => {
    const result: { task: Task; sub: SubTask }[] = [];
    tasks.forEach(task => {
      task.subTasks.forEach(sub => {
        try {
          if (sub.dueDate && isSameDay(parseISO(sub.dueDate), selectedDate)) {
            result.push({ task, sub });
          }
        } catch (e) {
          // Skip invalid dates
        }
      });
    });
    return result;
  }, [tasks, selectedDate]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-4 overflow-x-auto pb-4 no-scrollbar">
        {days.map(day => (
          <button 
            key={day.toISOString()}
            onClick={() => setSelectedDate(day)}
            className={cn(
              "flex flex-col items-center p-3 sm:p-4 rounded-2xl transition-all min-w-[70px] sm:min-w-[80px]",
              isSameDay(day, selectedDate) 
                ? "bg-black dark:bg-white text-white dark:text-black shadow-xl scale-105 sm:scale-110" 
                : "bg-white dark:bg-[#141414] text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent dark:border-[#262626]"
            )}
          >
            <span className="text-[10px] font-bold uppercase tracking-widest mb-1">{format(day, 'EEE')}</span>
            <span className="text-lg sm:text-xl font-bold">{format(day, 'd')}</span>
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-[#141414] rounded-3xl border border-gray-200 dark:border-[#262626] p-6 sm:p-8 min-h-[400px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h3 className="text-xl sm:text-2xl font-bold dark:text-white">{format(selectedDate, 'MMMM d, yyyy')}</h3>
          <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl text-sm font-bold dark:text-white w-fit">
            {dailyTasks.length} Tasks Scheduled
          </div>
        </div>

        {dailyTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Clock size={48} className="mb-4 opacity-20" />
            <p className="font-medium">No tasks scheduled for this day.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dailyTasks.map(({ task, sub }, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 p-4 sm:p-6 rounded-2xl border border-gray-100 dark:border-[#262626] hover:border-gray-200 dark:hover:border-gray-700 transition-all group">
                <div className={cn(
                  "w-3 h-3 rounded-full hidden sm:block",
                  sub.priority === 'high' ? "bg-red-500" : 
                  sub.priority === 'medium' ? "bg-orange-500" : "bg-blue-500"
                )} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">{task.title}</span>
                    <ArrowRight size={12} className="text-gray-300" />
                  </div>
                  <h4 className="font-bold text-base sm:text-lg dark:text-white">{sub.title}</h4>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-8">
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Status</p>
                    <span className={cn(
                      "text-[10px] sm:text-xs font-bold px-3 py-1 rounded-full",
                      sub.status === 'completed' ? "bg-green-50 dark:bg-green-900/20 text-green-600" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    )}>
                      {sub.status.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Progress</p>
                    <span className="text-sm font-bold dark:text-white">{sub.completedPercentage}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
