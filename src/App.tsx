/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Sun
} from 'lucide-react';
import { format, isSameDay, parseISO, addDays, startOfToday } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import * as d3 from 'd3';
import Markdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { cn } from './lib/utils';
import { Task, SubTask, Priority, Status, ChatMessage } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'flow' | 'daily'>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load initial data
  useEffect(() => {
    const saved = localStorage.getItem('taskflow_tasks');
    if (saved) {
      setTasks(JSON.parse(saved));
    } else {
      // Sample data
      const sampleTasks: Task[] = [
        {
          id: '1',
          title: 'Project Kickoff',
          description: 'Initial planning and setup',
          createdAt: new Date().toISOString(),
          dependencies: [],
          subTasks: [
            { id: 's1', title: 'Define scope', completedPercentage: 100, priority: 'high', dueDate: new Date().toISOString(), status: 'completed' },
            { id: 's2', title: 'Assemble team', completedPercentage: 50, priority: 'medium', dueDate: addDays(new Date(), 2).toISOString(), status: 'in-progress' }
          ]
        },
        {
          id: '2',
          title: 'Design Phase',
          description: 'UI/UX design and prototyping',
          createdAt: new Date().toISOString(),
          dependencies: ['1'],
          subTasks: [
            { id: 's3', title: 'Wireframes', completedPercentage: 0, priority: 'high', dueDate: addDays(new Date(), 5).toISOString(), status: 'todo' }
          ]
        }
      ];
      setTasks(sampleTasks);
    }
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem('taskflow_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const addTask = () => {
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Task',
      description: '',
      createdAt: new Date().toISOString(),
      dependencies: [],
      subTasks: []
    };
    setTasks([...tasks, newTask]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(t => t.id !== id).map(t => ({
      ...t,
      dependencies: t.dependencies.filter(depId => depId !== id)
    })));
  };

  const addSubTask = (taskId: string) => {
    const newSub: SubTask = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Sub-task',
      completedPercentage: 0,
      priority: 'medium',
      dueDate: new Date().toISOString(),
      status: 'todo'
    };
    updateTask(taskId, {
      subTasks: [...(tasks.find(t => t.id === taskId)?.subTasks || []), newSub]
    });
  };

  const updateSubTask = (taskId: string, subId: string, updates: Partial<SubTask>) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newSubTasks = task.subTasks.map(s => s.id === subId ? { ...s, ...updates } : s);
    updateTask(taskId, { subTasks: newSubTasks });
  };

  const deleteSubTask = (taskId: string, subId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    updateTask(taskId, { subTasks: task.subTasks.filter(s => s.id !== subId) });
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', text: userInput }];
    setChatHistory(newHistory);
    setUserInput('');
    setIsTyping(true);

    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: "You are TaskFlow AI, a helpful assistant for managing tasks and projects. You can help users organize their work, suggest sub-tasks, and provide productivity tips. You have access to Google Search for up-to-date information.",
          tools: [{ googleSearch: {} }]
        }
      });

      const response = await chat.sendMessage({ message: userInput });
      setChatHistory([...newHistory, { role: 'model', text: response.text || "I'm sorry, I couldn't process that." }]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatHistory([...newHistory, { role: 'model', text: "Error connecting to AI. Please check your connection." }]);
    } finally {
      setIsTyping(false);
    }
  };

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
        {(isSidebarOpen || window.innerWidth >= 1024) && (
          <>
            {/* Overlay for mobile */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed left-0 top-0 h-full w-64 bg-white dark:bg-[#141414] border-r border-gray-200 dark:border-[#262626] p-6 flex flex-col gap-8 z-50 lg:translate-x-0",
                !isSidebarOpen && "hidden lg:flex"
              )}
            >
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
                    <LayoutDashboard className="text-white dark:text-black w-5 h-5" />
                  </div>
                  <h1 className="font-bold text-xl tracking-tight">TaskFlow AI</h1>
                </div>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex flex-col gap-2">
                {[
                  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                  { id: 'flow', icon: Network, label: 'Process Flow' },
                  { id: 'daily', icon: Calendar, label: 'Daily View' }
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
                <button 
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="hidden lg:flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 py-3 rounded-xl transition-colors font-medium text-gray-700 dark:text-gray-300"
                >
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                  {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </button>
                <button 
                  onClick={() => setIsChatOpen(true)}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 py-3 rounded-xl transition-colors font-medium text-gray-700 dark:text-gray-300"
                >
                  <MessageSquare size={18} />
                  AI Assistant
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

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
                  <h2 className="text-3xl font-bold tracking-tight">My Tasks</h2>
                  <p className="text-gray-500 mt-1">Manage your projects and their sub-tasks.</p>
                </div>
                <button 
                  onClick={addTask}
                  className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition-all shadow-md active:scale-95"
                >
                  <Plus size={20} />
                  Add Task
                </button>
              </div>

              <div className="grid gap-6">
                {tasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    allTasks={tasks}
                    onUpdate={updateTask} 
                    onDelete={deleteTask}
                    onAddSubTask={addSubTask}
                    onUpdateSubTask={updateSubTask}
                    onDeleteSubTask={deleteSubTask}
                  />
                ))}
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

      {/* AI Chat Drawer */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full sm:w-[450px] bg-white dark:bg-[#141414] shadow-2xl z-40 flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 dark:border-[#262626] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center">
                    <MessageSquare className="text-white dark:text-black w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg dark:text-white">AI Assistant</h3>
                    <p className="text-xs text-green-500 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      Online
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Plus className="rotate-45 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {chatHistory.length === 0 && (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="text-gray-300 dark:text-gray-600 w-8 h-8" />
                    </div>
                    <p className="text-gray-500 text-sm">How can I help you with your tasks today?</p>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}>
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      msg.role === 'user' 
                        ? "bg-black dark:bg-white text-white dark:text-black rounded-tr-none" 
                        : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none"
                    )}>
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <Markdown>
                          {msg.text}
                        </Markdown>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-bold">
                      {msg.role === 'user' ? 'You' : 'TaskFlow AI'}
                    </span>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex flex-col mr-auto items-start">
                    <div className="bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-2xl rounded-tl-none flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-gray-100 dark:border-[#262626]">
                <div className="relative">
                  <input 
                    type="text" 
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask TaskFlow AI..."
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl py-4 pl-5 pr-14 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all text-sm dark:text-white"
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!userInput.trim() || isTyping}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-black dark:bg-white text-white dark:text-black rounded-lg flex items-center justify-center hover:bg-gray-800 dark:hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
  onDeleteSubTask 
}: { 
  task: Task; 
  allTasks: Task[];
  onUpdate: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAddSubTask: (taskId: string) => void;
  onUpdateSubTask: (taskId: string, subId: string, updates: Partial<SubTask>) => void;
  onDeleteSubTask: (taskId: string, subId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  const avgCompletion = task.subTasks.length > 0 
    ? Math.round(task.subTasks.reduce((acc, s) => acc + s.completedPercentage, 0) / task.subTasks.length)
    : 0;

  return (
    <div className="bg-white dark:bg-[#141414] rounded-2xl border border-gray-200 dark:border-[#262626] overflow-hidden shadow-sm hover:shadow-md transition-all">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
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
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${avgCompletion}%` }}
              className="h-full bg-black dark:bg-white"
            />
          </div>
          <span className="text-sm font-bold w-10 dark:text-white">{avgCompletion}%</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 items-center text-xs text-gray-400 font-medium">
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            Created {format(parseISO(task.createdAt), 'MMM d')}
          </div>
          <div className="flex items-center gap-1.5">
            <Network size={14} />
            {task.dependencies.length} Dependencies
          </div>
          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto">
            <span className="text-gray-300 dark:text-gray-600">Depends on:</span>
            <select 
              className="bg-gray-50 dark:bg-gray-800 border-none rounded-lg py-1 px-2 text-gray-600 dark:text-gray-400 focus:ring-1 focus:ring-black dark:focus:ring-white"
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
            <div className="p-4 sm:p-6 space-y-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Sub-tasks & Checklist</h4>
                <button 
                  onClick={() => onAddSubTask(task.id)}
                  className="text-xs font-bold text-black dark:text-white flex items-center gap-1 hover:underline"
                >
                  <Plus size={14} />
                  Add Sub-task
                </button>
              </div>
              
              {task.subTasks.length === 0 && (
                <p className="text-sm text-gray-400 italic py-2">No sub-tasks added yet.</p>
              )}

              {task.subTasks.map(sub => (
                <SubTaskItem 
                  key={sub.id} 
                  sub={sub} 
                  onUpdate={(updates) => onUpdateSubTask(task.id, sub.id, updates)}
                  onDelete={() => onDeleteSubTask(task.id, sub.id)}
                />
              ))}
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
  return (
    <div className="bg-white dark:bg-[#141414] p-4 rounded-xl border border-gray-100 dark:border-[#262626] flex flex-col sm:flex-row sm:items-center gap-4 group shadow-sm transition-all">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={() => onUpdate({ 
            status: sub.status === 'completed' ? 'todo' : 'completed',
            completedPercentage: sub.status === 'completed' ? 0 : 100
          })}
          className="text-gray-300 dark:text-gray-600 hover:text-black dark:hover:text-white transition-colors"
        >
          {sub.status === 'completed' ? <CheckCircle2 className="text-black dark:text-white" /> : <Circle />}
        </button>

        <input 
          type="text" 
          value={sub.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className={cn(
            "flex-1 font-medium bg-transparent border-none p-0 focus:ring-0 text-sm min-w-[150px] dark:text-white",
            sub.status === 'completed' && "line-through text-gray-400 dark:text-gray-600"
          )}
        />
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
              "text-xs font-bold border-none rounded-lg py-1 px-2 focus:ring-0",
              sub.priority === 'high' ? "bg-red-50 dark:bg-red-900/20 text-red-600" : 
              sub.priority === 'medium' ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600" : "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
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
            className="text-xs font-bold bg-gray-50 dark:bg-gray-800 border-none rounded-lg py-1 px-2 focus:ring-0 dark:text-white"
          />
        </div>

        <button 
          onClick={onDelete}
          className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
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

function DailyView({ tasks }: { tasks: Task[] }) {
  const [selectedDate, setSelectedDate] = useState(startOfToday());

  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDays(startOfToday(), i - 3));
  }, []);

  const dailyTasks = useMemo(() => {
    const result: { task: Task; sub: SubTask }[] = [];
    tasks.forEach(task => {
      task.subTasks.forEach(sub => {
        if (isSameDay(parseISO(sub.dueDate), selectedDate)) {
          result.push({ task, sub });
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
