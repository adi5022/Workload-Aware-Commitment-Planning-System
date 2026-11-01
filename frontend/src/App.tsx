import { useState, useEffect } from 'react';
import { 
  Calendar, CheckSquare, BarChart2, Sparkles, Settings, 
  ChevronLeft, ChevronRight, Clock, Zap,
  Database, BookOpen, Presentation,
  Flag, Play, ChevronDown, Plus, X, Trash2, RotateCcw
} from 'lucide-react';

interface EventBlock {
  id: string;
  title: string;
  duration: string;
  hours: number;
  timeSlot: string;
  dayIndex: number;
  colorBg: string;
  colorBorder: string;
  icon: 'database' | 'research' | 'presentation' | 'personal';
  category: string;
}

interface CommitmentItem {
  id: string;
  title: string;
  branch: string;
  branchPriority: number;
  deadlineDays: number;
  deadlineDateStr: string;
  focusHoursNeeded: number;
  remainingFocusHours: number;
  progress: number;
  categoryColor: string;
}

export default function App() {
  const [activeNav, setActiveNav] = useState('Plan');
  const [activeTab, setActiveTab] = useState<'Schedule' | 'Workload' | 'Timeline'>('Schedule');
  const [focusActive, setFocusActive] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const days = [
    { name: 'Mon', date: 'Oct 1', isCurrent: false },
    { name: 'Tue', date: 'Oct 2', isCurrent: false },
    { name: 'Wed', date: 'Oct 3', isCurrent: false },
    { name: 'Thu', date: 'Oct 4', isCurrent: true },
    { name: 'Fri', date: 'Oct 5', isCurrent: false },
    { name: 'Sat', date: 'Oct 6', isCurrent: false },
    { name: 'Sun', date: 'Oct 7', isCurrent: false },
  ];

  const timeSlots = [
    '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'
  ];

  const [events, setEvents] = useState<EventBlock[]>([]);

  const [commitments, setCommitments] = useState<CommitmentItem[]>([
    {
      id: 'c_demo_1',
      title: 'Train ResNet Model',
      branch: 'DeepLearning',
      branchPriority: 1.2,
      deadlineDays: 3,
      deadlineDateStr: 'Nov 5',
      focusHoursNeeded: 8.0,
      remainingFocusHours: 6.0,
      progress: 25.0,
      categoryColor: '#7DB596'
    }
  ]);

  // Trash bin state
  const [trashedCommitments, setTrashedCommitments] = useState<CommitmentItem[]>([]);
  const [taskToDelete, setTaskToDelete] = useState<CommitmentItem | null>(null);
  const [showTrashSection, setShowTrashSection] = useState(false);
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);

  // Dynamic ripple rescheduling when an event is moved to targetDay and targetSlot
  const handleMoveEvent = (eventId: string, targetDay: number, targetSlot: string) => {
    setEvents(prevEvents => {
      const targetEvent = prevEvents.find(e => e.id === eventId);
      if (!targetEvent) return prevEvents;

      // Available slots in chronological order
      const slotOrder = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'];

      // Check if target slot is occupied by another event
      const conflictingEvent = prevEvents.find(e => e.id !== eventId && e.dayIndex === targetDay && e.timeSlot === targetSlot);

      // Map through events
      return prevEvents.map(ev => {
        if (ev.id === eventId) {
          return {
            ...ev,
            dayIndex: targetDay,
            timeSlot: targetSlot
          };
        }

        // If another event was in that slot, ripple push it to the next available slot
        if (conflictingEvent && ev.id === conflictingEvent.id) {
          const currentSlotIdx = slotOrder.indexOf(targetSlot);
          let newSlot = slotOrder[currentSlotIdx + 1];
          let newDay = targetDay;

          if (!newSlot) {
            newSlot = '9 AM';
            newDay = Math.min(6, targetDay + 1);
          }

          return {
            ...ev,
            dayIndex: newDay,
            timeSlot: newSlot
          };
        }

        return ev;
      });
    });
  };

  // Dynamic Branches Registry with learned priority
  const [branches, setBranches] = useState<Record<string, { priority: number; completedHours: number }>>({
    'DeepLearning': { priority: 1.2, completedHours: 2.0 },
    'Research': { priority: 1.0, completedHours: 0.0 },
    'General': { priority: 1.0, completedHours: 0.0 }
  });

  // Task creation form state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskBranch, setNewTaskBranch] = useState('');
  const [newTaskDeadlineDays, setNewTaskDeadlineDays] = useState('3');
  const [newTaskFocusHours, setNewTaskFocusHours] = useState('6.0');
  const [capacityWarning, setCapacityWarning] = useState<string | null>(null);

  // Active focus session state
  const [activeFocusTaskId] = useState<string | null>(null);
  const [focusLogModal, setFocusLogModal] = useState(false);
  const [hoursToLog, setHoursToLog] = useState('1.5');

  const totalEffortHours = commitments.reduce((acc, curr) => acc + curr.focusHoursNeeded, 0);
  const remainingEffortHours = commitments.reduce((acc, curr) => acc + curr.remainingFocusHours, 0);
  const avgProgress = commitments.length > 0 
    ? Math.round(commitments.reduce((acc, curr) => acc + curr.progress, 0) / commitments.length) 
    : 0;

  // Re-generate calendar schedule events whenever commitments change
  const scheduleCommitmentsToCalendar = (items: CommitmentItem[]) => {
    const newEvents: EventBlock[] = [];
    const availableSlots = [
      '9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'
    ];

    const occupied = new Set<string>();

    const sorted = [...items].sort((a, b) => {
      const pA = branches[a.branch]?.priority || a.branchPriority || 1.0;
      const pB = branches[b.branch]?.priority || b.branchPriority || 1.0;
      if (pB !== pA) return pB - pA;
      return a.deadlineDays - b.deadlineDays;
    });

    // Multi-day balanced distribution
    // Max 1 session per day per task (or up to 2-3h max per day), spreading work across days until deadline
    for (const task of sorted) {
      if (task.remainingFocusHours <= 0) continue;

      let hoursToSchedule = task.remainingFocusHours;
      const maxDayIndex = Math.min(6, Math.max(0, task.deadlineDays - 1));
      const totalAvailableDays = maxDayIndex + 1;

      // Desired session length (e.g. 2.0h)
      const sessionLength = 2.0;

      // Round-robin pass across days so work is distributed across the entire timeline
      let dayPointer = 0;
      let attempts = 0;
      const maxAttempts = totalAvailableDays * 10;

      while (hoursToSchedule > 0 && attempts < maxAttempts) {
        const currentDay = dayPointer % totalAvailableDays;
        
        // Find first unoccupied slot on this day
        const freeSlot = availableSlots.find(slot => !occupied.has(`${currentDay}-${slot}`));

        if (freeSlot) {
          const sessionHours = Math.min(sessionLength, hoursToSchedule);
          occupied.add(`${currentDay}-${freeSlot}`);
          hoursToSchedule -= sessionHours;

          let iconType: 'database' | 'research' | 'presentation' | 'personal' = 'personal';
          const bLower = task.branch.toLowerCase();
          if (bLower.includes('data') || bLower.includes('db') || bLower.includes('ml')) iconType = 'database';
          else if (bLower.includes('research') || bLower.includes('study') || bLower.includes('thesis')) iconType = 'research';
          else if (bLower.includes('pres') || bLower.includes('talk') || bLower.includes('client')) iconType = 'presentation';

          newEvents.push({
            id: `ev_${task.id}_${currentDay}_${freeSlot}`,
            title: task.title,
            duration: `(${sessionHours} h)`,
            hours: sessionHours,
            timeSlot: freeSlot,
            dayIndex: currentDay,
            colorBg: `${task.categoryColor}25`,
            colorBorder: task.categoryColor,
            icon: iconType,
            category: task.branch
          });
        }

        dayPointer++;
        attempts++;
      }
    }

    setEvents(newEvents);
  };

  // Initial schedule run on load
  useEffect(() => {
    scheduleCommitmentsToCalendar(commitments);
  }, []);
  const calculateAvailableCapacity = (days: number): number => {
    return days * 24.0;
  };

  const checkCapacity = (hours: number, days: number) => {
    const available = calculateAvailableCapacity(days);
    if (hours > available) {
      setCapacityWarning(`Capacity Deficit: Requested ${hours}h exceeds available capacity (${available}h) across ${days} days!`);
    } else {
      setCapacityWarning(null);
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const hours = parseFloat(newTaskFocusHours) || 1.0;
    const days = parseInt(newTaskDeadlineDays) || 1;
    const branchName = newTaskBranch.trim() || 'General';

    // Register / update branch with default 1.0 priority
    if (!branches[branchName]) {
      setBranches(prev => ({
        ...prev,
        [branchName]: { priority: 1.0, completedHours: 0.0 }
      }));
    }

    const priorityScore = branches[branchName]?.priority || 1.0;

    const deadlineDt = new Date();
    deadlineDt.setDate(deadlineDt.getDate() + days);
    const deadlineDateStr = deadlineDt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const colors = ['#7DB596', '#A7A6E4', '#E6A76E', '#EBB47E', '#80A4C2', '#C28CAE'];
    const colorIndex = Math.abs(branchName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % colors.length;

    const newItem: CommitmentItem = {
      id: `c_${Date.now()}`,
      title: newTaskTitle.trim(),
      branch: branchName,
      branchPriority: priorityScore,
      deadlineDays: days,
      deadlineDateStr: deadlineDateStr,
      focusHoursNeeded: hours,
      remainingFocusHours: hours,
      progress: 0,
      categoryColor: colors[colorIndex]
    };

    const updatedCommitments = [newItem, ...commitments];
    setCommitments(updatedCommitments);
    scheduleCommitmentsToCalendar(updatedCommitments);

    // Reset & close
    setNewTaskTitle('');
    setNewTaskBranch('');
    setNewTaskDeadlineDays('3');
    setNewTaskFocusHours('6.0');
    setCapacityWarning(null);
    setShowTaskModal(false);
  };

  // LOG FOCUS SESSION & COUNTDOWN
  const handleCompleteFocusSession = (taskId: string, hoursSpent: number) => {
    setCommitments(prev => prev.map(t => {
      if (t.id === taskId) {
        const actualDeducted = Math.min(t.remainingFocusHours, hoursSpent);
        const newRemaining = Math.max(0, t.remainingFocusHours - actualDeducted);
        const newProgress = Math.min(100, Math.round(((t.focusHoursNeeded - newRemaining) / t.focusHoursNeeded) * 100));
        
        // Update learned branch priority
        setBranches(bPrev => {
          const b = bPrev[t.branch] || { priority: 1.0, completedHours: 0 };
          const newCompleted = b.completedHours + actualDeducted;
          const newPriority = parseFloat((1.0 + newCompleted * 0.1).toFixed(2));
          return {
            ...bPrev,
            [t.branch]: { priority: newPriority, completedHours: newCompleted }
          };
        });

        return {
          ...t,
          remainingFocusHours: parseFloat(newRemaining.toFixed(1)),
          progress: newProgress
        };
      }
      return t;
    }));

    setFocusLogModal(false);
    setFocusActive(false);
  };

  const confirmDeleteTask = () => {
    if (!taskToDelete) return;
    const remaining = commitments.filter(t => t.id !== taskToDelete.id);
    setCommitments(remaining);
    setTrashedCommitments(prev => [taskToDelete, ...prev]);
    scheduleCommitmentsToCalendar(remaining);
    setTaskToDelete(null);
  };

  const handleRestoreTask = (task: CommitmentItem) => {
    setTrashedCommitments(prev => prev.filter(t => t.id !== task.id));
    const restored = [task, ...commitments];
    setCommitments(restored);
    scheduleCommitmentsToCalendar(restored);
  };

  const handlePermanentDelete = (taskId: string) => {
    setTrashedCommitments(prev => prev.filter(t => t.id !== taskId));
  };

  const renderIcon = (icon: string) => {
    switch (icon) {
      case 'database':
        return <Database className="w-3.5 h-3.5 text-[#2A5C43]" />;
      case 'research':
        return <BookOpen className="w-3.5 h-3.5 text-[#4D4B85]" />;
      case 'presentation':
        return <Presentation className="w-3.5 h-3.5 text-[#A65B33]" />;
      case 'personal':
        return (
          <div className="w-3.5 h-3.5 rounded-full border border-[#9E6C2E] flex items-center justify-center text-[7.5px] font-bold text-[#9E6C2E]">
            P
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6EF] flex text-[#20231F] selection:bg-[#DCE9D8] tracking-[-0.01em]">
      
      {/* -------------------- LEFT SIDEBAR -------------------- */}
      <aside className="w-[205px] min-w-[205px] bg-[#153D30] text-[#FAF6EF] flex flex-col justify-between p-4 min-h-screen select-none border-r border-[#0F2C23]">
        <div>
          {/* Brand header */}
          <div className="flex items-center gap-2.5 px-2 py-3 mb-6">
            {/* Elegant leaf mark */}
            <svg className="w-5 h-5 text-[#FAF6EF]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
            </svg>
            <span className="font-editorial text-[20px] tracking-wide text-[#FAF6EF] font-medium">CommitWell</span>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1.5 text-[13.5px] font-medium">
            <button 
              onClick={() => setActiveNav('Plan')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'Plan' ? 'bg-[#FAF6EF] text-[#153D30] font-semibold shadow-xs' : 'text-[#FAF6EF]/75 hover:text-[#FAF6EF] hover:bg-[#1A4A3B]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Plan</span>
            </button>

            <button 
              onClick={() => setActiveNav('Tasks')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'Tasks' ? 'bg-[#FAF6EF] text-[#153D30] font-semibold shadow-xs' : 'text-[#FAF6EF]/75 hover:text-[#FAF6EF] hover:bg-[#1A4A3B]'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Tasks</span>
            </button>

            <button 
              onClick={() => setActiveNav('Insights')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'Insights' ? 'bg-[#FAF6EF] text-[#153D30] font-semibold shadow-xs' : 'text-[#FAF6EF]/75 hover:text-[#FAF6EF] hover:bg-[#1A4A3B]'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>Insights</span>
            </button>

            <button 
              onClick={() => setActiveNav('Learning')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'Learning' ? 'bg-[#FAF6EF] text-[#153D30] font-semibold shadow-xs' : 'text-[#FAF6EF]/75 hover:text-[#FAF6EF] hover:bg-[#1A4A3B]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Learning</span>
            </button>

            <button 
              onClick={() => setActiveNav('Settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'Settings' ? 'bg-[#FAF6EF] text-[#153D30] font-semibold shadow-xs' : 'text-[#FAF6EF]/75 hover:text-[#FAF6EF] hover:bg-[#1A4A3B]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Crisp botanical branch line illustration */}
        <div className="px-4 pb-4 pt-6 opacity-30 flex justify-center">
          <svg className="w-20 h-28 text-[#FAF6EF]" viewBox="0 0 80 120" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="40" y1="110" x2="40" y2="10" />
            <path d="M40 95 C25 85 15 75 18 68 C24 64 34 76 40 88" />
            <circle cx="18" cy="68" r="2.5" fill="currentColor" />
            <path d="M40 75 C55 65 65 55 62 48 C56 44 46 56 40 68" />
            <circle cx="62" cy="48" r="2.5" fill="currentColor" />
            <path d="M40 55 C25 45 15 35 18 28 C24 24 34 36 40 48" />
            <circle cx="18" cy="28" r="2.5" fill="currentColor" />
            <path d="M40 35 C55 25 63 15 60 10 C54 7 46 18 40 28" />
            <circle cx="60" cy="10" r="2.5" fill="currentColor" />
          </svg>
        </div>
      </aside>

      {/* -------------------- MAIN CENTRAL WORKSPACE -------------------- */}
      <main className="flex-1 p-6 lg:p-7 overflow-y-auto max-w-[1280px]">
        {activeNav === 'Tasks' ? (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-editorial text-[32px] font-semibold text-[#1F2420] leading-tight">Tasks</h1>
                <p className="text-[13.5px] text-[#77776F] mt-0.5">Manage and track your workload commitments.</p>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Trash Section Toggle Button */}
                <button 
                  onClick={() => setShowTrashSection(!showTrashSection)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-medium border border-[#E6DCCF] transition-all cursor-pointer ${
                    showTrashSection ? 'bg-[#F2E9DC] text-[#20231F] font-semibold' : 'bg-[#FAF6EF] text-[#77776F] hover:text-[#20231F]'
                  }`}
                >
                  <Trash2 className="w-4 h-4 text-[#B85F3D]" />
                  <span>Trash ({trashedCommitments.length})</span>
                </button>

                {/* Add Task Button */}
                <button 
                  onClick={() => setShowTaskModal(true)}
                  className="flex items-center gap-2 bg-[#153D30] hover:bg-[#1A4A3B] text-[#FAF6EF] px-4 py-2.5 rounded-xl text-[13.5px] font-semibold shadow-xs transition-all cursor-pointer active:scale-98"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Task</span>
                </button>
              </div>
            </div>

            {/* Trash Section (Conditional View) */}
            {showTrashSection && (
              <div className="mb-6 bg-[#FCECE6]/50 border border-[#F6D9CD] rounded-2xl p-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#F6D9CD]">
                  <div className="flex items-center gap-2 text-[#B85F3D]">
                    <Trash2 className="w-4 h-4" />
                    <span className="text-[13.5px] font-bold">Trash Bin</span>
                  </div>
                  <span className="text-[11.5px] text-[#77776F]">Items stay here until permanently deleted or restored.</span>
                </div>

                {trashedCommitments.length === 0 ? (
                  <p className="text-[12.5px] text-[#77776F] py-3 text-center">Trash bin is currently empty.</p>
                ) : (
                  <div className="space-y-2">
                    {trashedCommitments.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-[13px] bg-[#FAF6EF] p-2.5 rounded-xl border border-[#F6D9CD]">
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.categoryColor }} />
                          <span className="font-semibold text-[#20231F]">{t.title}</span>
                          <span className="text-[11px] text-[#77776F]">({t.branch})</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleRestoreTask(t)}
                            className="flex items-center gap-1 text-[12px] text-[#153D30] font-semibold bg-[#DCE9D8] hover:bg-[#C9DEC3] px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>
                          <button 
                            onClick={() => handlePermanentDelete(t.id)}
                            className="text-[12px] text-[#B85F3D] hover:bg-[#FCECE6] px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Delete Permanently
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tasks List Table Card */}
            <div className="bg-[#FAF6EF] border border-[#E6DCCF] rounded-2xl p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E6DCCF]/60 text-[12px] font-semibold text-[#77776F] uppercase tracking-wider">
                <span className="min-w-[200px]">Task Name</span>
                <span className="min-w-[150px]">Branch (Priority)</span>
                <span className="min-w-[90px]">Deadline</span>
                <span className="min-w-[120px]">Focus Remaining</span>
                <span className="min-w-[130px]">Progress</span>
                <span className="min-w-[70px] text-right">Delete</span>
              </div>

              <div className="space-y-3">
                {commitments.length === 0 ? (
                  <div className="py-8 text-center text-[#77776F] text-[13px]">
                    No commitments created yet. Click "+ New Task" above to add your first one.
                  </div>
                ) : (
                  commitments.map((c) => {
                    const bScore = branches[c.branch]?.priority || c.branchPriority || 1.0;
                    return (
                      <div key={c.id} className="flex items-center justify-between text-[13.5px] py-2.5 border-b border-[#E6DCCF]/30 last:border-0 hover:bg-[#F2E9DC]/30 px-2 rounded-xl transition-colors">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <span 
                            className="w-3 h-3 rounded-full shrink-0" 
                            style={{ backgroundColor: c.categoryColor }} 
                          />
                          <span className="font-semibold text-[#20231F]">{c.title}</span>
                        </div>

                        <div className="min-w-[150px]">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[12px] font-medium bg-[#F2E9DC] text-[#20231F] border border-[#E6DCCF]">
                            <span>{c.branch}</span>
                            <span className="text-[#3E6B48] font-bold text-[10.5px]">p:{bScore.toFixed(1)}</span>
                          </span>
                        </div>

                        <span className="text-[12.5px] text-[#B85F3D] font-medium min-w-[90px]">in {c.deadlineDays}d</span>

                        <span className="text-[13px] text-[#20231F] font-semibold min-w-[120px]">
                          {c.remainingFocusHours}h <span className="text-[11px] text-[#77776F] font-normal">/ {c.focusHoursNeeded}h</span>
                        </span>

                        <div className="flex items-center gap-2.5 min-w-[130px]">
                          <div className="w-16 h-2 bg-[#E6DCCF]/60 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#153D30] rounded-full transition-all duration-300" 
                              style={{ width: `${c.progress}%` }} 
                            />
                          </div>
                          <span className="text-[11.5px] text-[#77776F] font-semibold">{c.progress}%</span>
                        </div>

                        {/* Delete Button */}
                        <div className="min-w-[70px] text-right">
                          <button 
                            onClick={() => setTaskToDelete(c)}
                            title="Move to Trash"
                            className="p-1.5 rounded-lg text-[#77776F] hover:text-[#B85F3D] hover:bg-[#FCECE6] transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Top Header Row */}
            <div className="relative mb-5 flex items-start justify-between">
              <div>
                <h1 className="font-editorial text-[32px] font-semibold text-[#1F2420] leading-tight">Good morning!</h1>
                <p className="text-[13.5px] text-[#77776F] mt-0.5">
                  {commitments.length === 0 
                    ? "You have 0 commitments. Add your first task in Tasks."
                    : `You have ${commitments.length} commitment${commitments.length === 1 ? '' : 's'}.`}
                </p>
              </div>

              {/* Gentle Mountain Backdrop Illustration */}
              <div className="hidden lg:block absolute left-[260px] -top-1 pointer-events-none opacity-80">
                <svg width="270" height="55" viewBox="0 0 270 55" fill="none">
                  <circle cx="140" cy="24" r="13" fill="#FCE9D2" />
                  <path d="M60 52 L120 18 L180 52 Z" fill="#9FB89F" opacity="0.45" />
                  <path d="M110 52 L165 11 L230 52 Z" fill="#6A8E79" opacity="0.5" />
                  <path d="M160 52 L205 26 L260 52 Z" fill="#527963" opacity="0.45" />
                </svg>
              </div>

              {/* Week Selector Button */}
              <div className="flex items-center gap-1 bg-[#F2E9DC]/70 border border-[#E6DCCF] rounded-xl px-2.5 py-1.5 text-[12.5px] font-medium shadow-2xs">
                <button className="p-1 hover:bg-[#FAF6EF] rounded-lg text-[#77776F] hover:text-[#20231F] transition-colors cursor-pointer">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 text-[#20231F] font-semibold">Current Week</span>
                <button className="p-1 hover:bg-[#FAF6EF] rounded-lg text-[#77776F] hover:text-[#20231F] transition-colors cursor-pointer">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 4 Summary Indicator Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
              {/* Card 1 */}
              <div className="bg-[#FAF6EF] border border-[#E6DCCF] rounded-2xl p-3.5 flex items-center gap-3.5 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-[#F2E9DC]/80 border border-[#E6DCCF] flex items-center justify-center text-[#B85F3D]">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[17px] font-bold text-[#20231F] leading-tight">{commitments.length}</div>
                  <div className="text-[11.5px] text-[#77776F] font-medium">Active commitments</div>
                </div>
              </div>

              {/* Card 2: Remaining Focus Hours */}
              <div className="bg-[#FAF6EF] border border-[#E6DCCF] rounded-2xl p-3.5 flex items-center gap-3.5 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-[#F2E9DC]/80 border border-[#E6DCCF] flex items-center justify-center text-[#9E6C2E]">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[17px] font-bold text-[#20231F] leading-tight">{remainingEffortHours.toFixed(1)} h</div>
                  <div className="text-[11.5px] text-[#77776F] font-medium">Remaining focus ({totalEffortHours}h total)</div>
                </div>
              </div>

              {/* Card 3: Registered Branches with Learned Priorities */}
              <div className="bg-[#FAF6EF] border border-[#E6DCCF] rounded-2xl p-3.5 flex items-center gap-3.5 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-[#F2E9DC]/80 border border-[#E6DCCF] flex items-center justify-center text-[#B85F3D]">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[17px] font-bold text-[#20231F] leading-tight">{Object.keys(branches).length}</div>
                  <div className="text-[11.5px] text-[#77776F] font-medium">Learned Branches</div>
                </div>
              </div>

              {/* Card 4 */}
              <div className="bg-[#FAF6EF] border border-[#E6DCCF] rounded-2xl p-3.5 flex items-center gap-3.5 shadow-2xs">
                <div className="w-9 h-9 rounded-xl bg-[#F2E9DC]/80 border border-[#E6DCCF] flex items-center justify-center">
                  <svg className="w-5 h-5 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="#E6DCCF" strokeWidth="4.5" />
                    <circle 
                      cx="18" 
                      cy="18" 
                      r="14" 
                      fill="none" 
                      stroke="#3E6B48" 
                      strokeWidth="4.5" 
                      strokeDasharray={`${avgProgress} 100`} 
                      strokeLinecap="round" 
                    />
                  </svg>
                </div>
                <div>
                  <div className="text-[17px] font-bold text-[#20231F] leading-tight">{avgProgress}%</div>
                  <div className="text-[11.5px] text-[#77776F] font-medium">On track</div>
                </div>
              </div>
            </div>

            {/* -------------------- CALENDAR CONTAINER -------------------- */}
            <div className="bg-[#FAF6EF] border border-[#E6DCCF] rounded-2xl p-4 mb-5 shadow-2xs">
              
              {/* Calendar Toolbar with Tabs */}
              <div className="flex items-center justify-between pb-3.5 mb-2 border-b border-[#E6DCCF]/60">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={() => setActiveTab('Schedule')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12.5px] font-semibold transition-all cursor-pointer ${
                      activeTab === 'Schedule' ? 'bg-[#153D30] text-[#FAF6EF] shadow-2xs' : 'text-[#77776F] hover:text-[#20231F]'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Schedule</span>
                  </button>

                  <button 
                    onClick={() => setActiveTab('Workload')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12.5px] font-medium transition-all cursor-pointer ${
                      activeTab === 'Workload' ? 'bg-[#153D30] text-[#FAF6EF] shadow-2xs' : 'text-[#77776F] hover:text-[#20231F]'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Workload</span>
                  </button>

                  <button 
                    onClick={() => setActiveTab('Timeline')}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-[12.5px] font-medium transition-all cursor-pointer ${
                      activeTab === 'Timeline' ? 'bg-[#153D30] text-[#FAF6EF] shadow-2xs' : 'text-[#77776F] hover:text-[#20231F]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Timeline</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-[#F2E9DC]/60 border border-[#E6DCCF] rounded-lg px-2.5 py-1 text-[12px] text-[#20231F] font-semibold cursor-pointer">
                  <span>Week</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#77776F]" />
                </div>
              </div>

              {/* Weekly Calendar Grid */}
              <div className="overflow-x-auto">
                <div className="min-w-[690px]">
                  
                  {/* Day Headers */}
                  <div className="grid grid-cols-[50px_repeat(7,1fr)] mb-2">
                    <div className="pr-3"></div>
                    {days.map((d, idx) => (
                      <div key={idx} className="px-1 text-center">
                        <div className={`py-1.5 px-1 rounded-xl text-center transition-all ${
                          d.isCurrent 
                            ? 'bg-[#153D30] text-[#FAF6EF] shadow-2xs font-semibold' 
                            : 'text-[#20231F]'
                        }`}>
                          <div className="text-[12px] font-medium">{d.name}</div>
                          <div className="text-[11px] opacity-80">{d.date}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Time slots and event canvas */}
                  <div className="border-t border-[#E6DCCF]/50">
                    {timeSlots.map((time, rowIdx) => (
                      <div key={rowIdx} className="grid grid-cols-[50px_repeat(7,1fr)] min-h-[46px] border-b border-[#E6DCCF]/35">
                        {/* Time label */}
                        <div className="text-[11px] text-[#77776F] font-medium pt-1 text-right pr-3 select-none">
                          {time}
                        </div>

                        {/* 7 Columns for Mon-Sun */}
                        {days.map((d, colIdx) => {
                          const ev = events.find(e => e.dayIndex === colIdx && e.timeSlot === time);
                          const isSundayDeadline = (colIdx === 6 && time === '5 PM');

                          return (
                            <div 
                              key={colIdx} 
                              onDragOver={(e) => {
                                e.preventDefault();
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const evId = e.dataTransfer.getData('text/plain') || draggedEventId;
                                if (evId) {
                                  handleMoveEvent(evId, colIdx, time);
                                  setDraggedEventId(null);
                                }
                              }}
                              className={`relative border-r border-[#E6DCCF]/35 p-1 transition-colors min-h-[46px] ${
                                d.isCurrent ? 'bg-[#F2E9DC]/25' : ''
                              }`}
                            >
                              {ev && (
                                <div 
                                  draggable
                                  onDragStart={(e) => {
                                    setDraggedEventId(ev.id);
                                    e.dataTransfer.setData('text/plain', ev.id);
                                    e.dataTransfer.effectAllowed = 'move';
                                  }}
                                  style={{ 
                                    backgroundColor: ev.colorBg, 
                                    borderColor: ev.colorBorder 
                                  }}
                                  className="w-full h-full min-h-[38px] rounded-xl p-2 border flex flex-col justify-between shadow-2xs cursor-grab active:cursor-grabbing hover:brightness-95 hover:shadow-xs transition-all select-none"
                                >
                                  <div className="flex items-center gap-1.5">
                                    {renderIcon(ev.icon)}
                                    <span className="text-[11.5px] font-semibold text-[#20231F] leading-tight truncate">{ev.title}</span>
                                  </div>
                                  <span className="text-[10px] text-[#77776F] font-medium">{ev.duration}</span>
                                </div>
                              )}

                              {/* Sunday deadline flag badge */}
                              {isSundayDeadline && (
                                <div className="w-full h-full min-h-[38px] rounded-xl p-1.5 bg-[#FCECE6] border border-[#F6D9CD] flex items-center gap-1.5 shadow-2xs">
                                  <Flag className="w-3.5 h-3.5 text-[#B85F3D] fill-[#B85F3D]" />
                                  <div>
                                    <span className="text-[11px] font-bold text-[#B85F3D] block leading-tight">Database</span>
                                    <span className="text-[9.5px] text-[#B85F3D] font-medium">Due</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                </div>
              </div>

            </div>

            {/* -------------------- BOTTOM WORKSPACE PANELS -------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Commitments Panel (Left 7 cols) */}
              <div className="md:col-span-7 bg-[#FAF6EF] border border-[#E6DCCF] rounded-2xl p-4.5 shadow-2xs">
                <h2 className="text-[16px] font-editorial font-bold text-[#20231F] mb-3.5">Commitments</h2>

                <div className="space-y-3">
                  {commitments.length === 0 ? (
                    <div className="py-6 text-center text-[#77776F] text-[13px]">
                      No active commitments. Go to Tasks to create one.
                    </div>
                  ) : (
                    commitments.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-[13px] py-1 border-b border-[#E6DCCF]/30 last:border-0">
                        <div className="flex items-center gap-2.5 min-w-[170px]">
                          <span 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: c.categoryColor }} 
                          />
                          <span className="font-semibold text-[#20231F]">{c.title}</span>
                        </div>

                        <span className="text-[12px] text-[#B85F3D] font-medium min-w-[70px]">in {c.deadlineDays}d</span>

                        <span className="text-[12px] text-[#77776F] min-w-[45px] text-right">{c.remainingFocusHours}h</span>

                        {/* Restrained Progress Bar */}
                        <div className="flex items-center gap-2.5 min-w-[110px]">
                          <div className="w-16 h-2 bg-[#E6DCCF]/60 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-[#153D30] rounded-full transition-all duration-300" 
                              style={{ width: `${c.progress}%` }} 
                            />
                          </div>
                          <span className="text-[11.5px] text-[#77776F] font-semibold">{c.progress}%</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Next Up Panel (Right 5 cols) */}
              <div className="md:col-span-5 bg-[#DCE9D8]/45 border border-[#C9DEC3] rounded-2xl p-4.5 flex flex-col justify-between shadow-2xs">
                <div>
                  <div className="flex items-center gap-2 text-[#2A5C43] mb-1.5">
                    <Calendar className="w-4 h-4" />
                    <span className="text-[11.5px] font-bold uppercase tracking-wider">Next Up</span>
                  </div>
                  <h3 className="text-[18px] font-editorial font-bold text-[#1F2420]">Research Project</h3>
                  <p className="text-[12.5px] text-[#4F6352] mt-1">
                    2 h today <span className="mx-1">•</span> Keeps you on track for Oct 7
                  </p>
                </div>

                <button 
                  onClick={() => setFocusActive(!focusActive)}
                  className="mt-4 flex items-center justify-center gap-2 bg-[#153D30] hover:bg-[#1A4A3B] text-[#FAF6EF] py-2.5 px-4 rounded-xl text-[13.5px] font-semibold transition-all shadow-xs cursor-pointer active:scale-98"
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${focusActive ? 'animate-pulse text-[#DCE9D8]' : ''}`} />
                  <span>{focusActive ? 'Session Active (Focusing)' : 'Start Focus'}</span>
                </button>
              </div>

            </div>
          </>
        )}
      </main>

      {/* -------------------- RIGHT AI ASSISTANT PANEL (COLLAPSIBLE) -------------------- */}
      <aside 
        className={`bg-[#FAF6EF] border-l border-[#E6DCCF] transition-all duration-300 flex flex-col justify-between min-h-screen relative ${
          isAssistantOpen ? 'w-[360px] min-w-[360px] p-5' : 'w-[52px] min-w-[52px] p-2 items-center'
        }`}
      >
        {/* Toggle Collapse Button */}
        <button 
          onClick={() => setIsAssistantOpen(!isAssistantOpen)}
          title={isAssistantOpen ? "Collapse Assistant" : "Expand Assistant"}
          className={`flex items-center gap-2 text-[#77776F] hover:text-[#153D30] hover:bg-[#F2E9DC] p-2 rounded-xl transition-all cursor-pointer ${
            isAssistantOpen ? 'self-end mb-4' : 'mt-2'
          }`}
        >
          {isAssistantOpen ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Sparkles className="w-5 h-5 text-[#153D30]" />
              <ChevronLeft className="w-4 h-4" />
            </div>
          )}
        </button>

        {isAssistantOpen && (
          <div className="flex-1 flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-center gap-3 pb-3 mb-4 border-b border-[#E6DCCF]/60">
              <div className="w-8 h-8 rounded-full bg-[#F2E9DC] border border-[#E6DCCF] flex items-center justify-center text-[#153D30]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-[15px] font-editorial font-bold text-[#20231F]">Assistant</h2>
                <span className="text-[11px] text-[#77776F]">Ready for your instructions</span>
              </div>
            </div>

            {/* Empty Canvas */}
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <p className="text-[12.5px] text-[#77776F] italic">
                Assistant canvas is empty.
              </p>
            </div>
          </div>
        )}
      </aside>

      {/* -------------------- MANUAL TASK CREATION MODAL -------------------- */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-[#20231F]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF6EF] border border-[#E6DCCF] w-full max-w-md rounded-2xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#E6DCCF]">
              <div>
                <h3 className="font-editorial text-[20px] font-bold text-[#20231F]">New Commitment</h3>
                <p className="text-[12px] text-[#77776F]">Enter task specifications and effort estimate.</p>
              </div>
              <button 
                onClick={() => setShowTaskModal(false)}
                className="w-8 h-8 rounded-full bg-[#F2E9DC] hover:bg-[#E6DCCF] text-[#77776F] hover:text-[#20231F] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateTask} className="space-y-4 text-[13px]">
              <div>
                <label className="block text-[#20231F] font-semibold mb-1">Task Name *</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. Distributed Systems Lab 3"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-[#FAF6EF] border border-[#E6DCCF] rounded-xl px-3 py-2 text-[#20231F] focus:outline-hidden focus:border-[#153D30] focus:ring-1 focus:ring-[#153D30]"
                />
              </div>

              <div>
                <label className="block text-[#20231F] font-semibold mb-1">
                  Branch (User-Defined) *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. DeepLearning, Thesis, Client X, Gym..."
                  value={newTaskBranch}
                  onChange={(e) => setNewTaskBranch(e.target.value)}
                  className="w-full bg-[#FAF6EF] border border-[#E6DCCF] rounded-xl px-3 py-2 text-[#20231F] focus:outline-hidden focus:border-[#153D30] focus:ring-1 focus:ring-[#153D30]"
                />
                <p className="text-[11px] text-[#77776F] mt-1">
                  Starts with equal priority 1.0. Learned parameter automatically adapts from your workflow.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#20231F] font-semibold mb-1">Focus Hours Needed *</label>
                  <input 
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={newTaskFocusHours}
                    onChange={(e) => {
                      const newHoursVal = e.target.value;
                      setNewTaskFocusHours(newHoursVal);
                      checkCapacity(parseFloat(newHoursVal) || 0, parseInt(newTaskDeadlineDays) || 1);
                    }}
                    className="w-full bg-[#FAF6EF] border border-[#E6DCCF] rounded-xl px-3 py-2 text-[#20231F] focus:outline-hidden focus:border-[#153D30]"
                  />
                </div>

                <div>
                  <label className="block text-[#20231F] font-semibold mb-1">Deadline (Days) *</label>
                  <input 
                    type="number"
                    min="1"
                    required
                    value={newTaskDeadlineDays}
                    onChange={(e) => {
                      const newDaysVal = e.target.value;
                      setNewTaskDeadlineDays(newDaysVal);
                      checkCapacity(parseFloat(newTaskFocusHours) || 0, parseInt(newDaysVal) || 1);
                    }}
                    className="w-full bg-[#FAF6EF] border border-[#E6DCCF] rounded-xl px-3 py-2 text-[#20231F] focus:outline-hidden focus:border-[#153D30]"
                  />
                </div>
              </div>

              {/* Hard Invariant Warning Notice */}
              {capacityWarning && (
                <div className="p-3 bg-[#FCECE6] border border-[#F6D9CD] rounded-xl text-[#B85F3D] text-[12px] flex items-center gap-2">
                  <Flag className="w-4 h-4 shrink-0 fill-current" />
                  <span>{capacityWarning}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E6DCCF]">
                <button 
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-xl text-[#77776F] hover:bg-[#F2E9DC] transition-colors cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-[#153D30] hover:bg-[#1A4A3B] text-[#FAF6EF] px-5 py-2 rounded-xl font-semibold shadow-xs transition-all cursor-pointer active:scale-98"
                >
                  Add Commitment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- CONFIRM DELETION DIALOG -------------------- */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 bg-[#20231F]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF6EF] border border-[#E6DCCF] w-full max-w-sm rounded-2xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3 text-[#B85F3D]">
              <div className="w-9 h-9 rounded-xl bg-[#FCECE6] flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-[#B85F3D]" />
              </div>
              <h3 className="font-editorial text-[18px] font-bold text-[#20231F]">Move to Trash?</h3>
            </div>

            <p className="text-[13px] text-[#77776F] mb-4">
              Are you sure you want to remove <strong className="text-[#20231F]">"{taskToDelete.title}"</strong>? It will be moved to the Trash bin where you can restore or permanently delete it.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E6DCCF]">
              <button 
                onClick={() => setTaskToDelete(null)}
                className="px-4 py-2 rounded-xl text-[#77776F] hover:bg-[#F2E9DC] transition-colors cursor-pointer text-[13px] font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteTask}
                className="bg-[#B85F3D] hover:bg-[#A35132] text-[#FAF6EF] px-4 py-2 rounded-xl text-[13px] font-semibold shadow-xs transition-all cursor-pointer active:scale-98"
              >
                Move to Trash
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- FOCUS LOG MODAL (COUNTDOWN) -------------------- */}
      {focusLogModal && activeFocusTaskId && (
        <div className="fixed inset-0 z-50 bg-[#20231F]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF6EF] border border-[#E6DCCF] w-full max-w-sm rounded-2xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E6DCCF]">
              <div>
                <h3 className="font-editorial text-[19px] font-bold text-[#20231F]">Log Focus Session</h3>
                <p className="text-[12px] text-[#77776F]">Hours will deduct from remaining commitment.</p>
              </div>
              <button 
                onClick={() => setFocusLogModal(false)}
                className="w-7 h-7 rounded-full bg-[#F2E9DC] hover:bg-[#E6DCCF] text-[#77776F] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4 text-[13px]">
              <div>
                <label className="block text-[#20231F] font-semibold mb-1">Focused Hours</label>
                <input 
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={hoursToLog}
                  onChange={(e) => setHoursToLog(e.target.value)}
                  className="w-full bg-[#FAF6EF] border border-[#E6DCCF] rounded-xl px-3 py-2 text-[#20231F] focus:outline-hidden focus:border-[#153D30]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E6DCCF]">
                <button 
                  type="button"
                  onClick={() => setFocusLogModal(false)}
                  className="px-4 py-2 rounded-xl text-[#77776F] hover:bg-[#F2E9DC] transition-colors cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => handleCompleteFocusSession(activeFocusTaskId, parseFloat(hoursToLog) || 1.0)}
                  className="bg-[#153D30] hover:bg-[#1A4A3B] text-[#FAF6EF] px-5 py-2 rounded-xl font-semibold shadow-xs transition-all cursor-pointer active:scale-98"
                >
                  Apply Countdown
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
