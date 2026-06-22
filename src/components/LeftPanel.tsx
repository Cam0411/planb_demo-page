import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Video, User } from '../types';
import { dbService } from '../services/db';
import { User as UserIcon, ShieldAlert, X, Download, Globe, HardDrive, Edit3, Calendar, LayoutDashboard, History } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface LeftPanelProps {
  video: Video | null;
  currentUser?: User | null;
  onUpdateVideo?: (data: Partial<Video>) => Promise<void>;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function LeftPanel({ video, currentUser: propCurrentUser, onUpdateVideo, isCollapsed, onToggleCollapse }: LeftPanelProps) {
  const [activeTab, setActiveTab] = useState<'Project'|'History'>('Project');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingTimeline, setIsEditingTimeline] = useState(false);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [editDeadlineText, setEditDeadlineText] = useState('');
  const [isEditingEditor, setIsEditingEditor] = useState(false);
  const [editingAssigneeId, setEditingAssigneeId] = useState<string | null>(null);
  const [isEditingDrive, setIsEditingDrive] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAssigneeName, setEditAssigneeName] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [internalUser, setInternalUser] = useState<User | null>(null);

  const currentUser = propCurrentUser || internalUser;

  useEffect(() => {
    dbService.getAllUsers().then(setUsers);
    if (!propCurrentUser) {
      dbService.getCurrentUser().then(setInternalUser);
    }
  }, [propCurrentUser]);

  const assignedEditors = users.filter(u => video?.editorIds?.includes(u.id));
  const isOwner = video && currentUser && (video.ownerId === currentUser.id || currentUser.role === 'admin');

  const deadlineDate = video?.deadline ? new Date(video.deadline) : null;
  const daysLeft = deadlineDate ? Math.ceil((deadlineDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : null;

  const formatDateTime = (dateValue: any) => {
    if (!dateValue) return '';
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleDeadlineChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!video || !onUpdateVideo) return;
    
    console.log("Deadline change triggered, value:", e.target.value);
    
    if (!e.target.value) {
      console.log("Deadline cleared");
      await onUpdateVideo({ deadline: null as any });
      return;
    }
    
    // Parse YYYY-MM-DDTHH:mm
    const newDate = new Date(e.target.value);
    console.log("New deadline date:", newDate);
    await onUpdateVideo({ deadline: newDate.getTime() });
  };

  const startEditingDeadline = () => {
    if (video?.deadline) {
      const d = new Date(video.deadline);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      setEditDeadlineText(`${day}/${month}/${year} ${hours}:${minutes}`);
    } else {
      setEditDeadlineText('');
    }
    setIsEditingDeadline(true);
  };

  const handleDeadlineTextSubmit = async () => {
    if (!video || !onUpdateVideo) return;
    
    if (!editDeadlineText.trim()) {
      await onUpdateVideo({ deadline: null as any });
      setIsEditingDeadline(false);
      return;
    }

    // Try to parse DD/MM/YYYY HH:mm
    const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/;
    const match = editDeadlineText.trim().match(regex);
    
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      const hours = match[4] ? parseInt(match[4], 10) : 0;
      const minutes = match[5] ? parseInt(match[5], 10) : 0;
      
      const newDate = new Date(year, month, day, hours, minutes);
      
      if (!isNaN(newDate.getTime())) {
        await onUpdateVideo({ deadline: newDate.getTime() });
      } else {
        alert("Định dạng ngày không hợp lệ. Vui lòng dùng DD/MM/YYYY HH:mm");
      }
    } else {
      alert("Định dạng ngày không hợp lệ. Vui lòng dùng DD/MM/YYYY HH:mm");
    }
    setIsEditingDeadline(false);
  };

  const startEditingTitle = () => {
    if (video) {
      setEditTitle(video.title);
      setIsEditingTitle(true);
    }
  };

  const handleTitleSubmit = async () => {
    if (editTitle.trim() && video && editTitle !== video.title && onUpdateVideo) {
      await onUpdateVideo({ title: editTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!video || !onUpdateVideo) return;
    const newStatus = e.target.value as any;
    await onUpdateVideo({ status: newStatus });
    setIsEditingStatus(false);
  };

  return (
    <div className={cn(
      "w-full h-full flex flex-col bg-transparent text-slate-300 transition-all duration-300"
    )}>
      <>
        <div className="flex p-3 border-b border-[#2e3138] shrink-0 items-center gap-2">
            <Link to="/" className="p-1.5 hover:bg-[#2e3138] text-slate-400 hover:text-white rounded-md transition-colors" title="Back to Home">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </Link>
            <div className="flex bg-[#1c1e23] p-1 rounded-xl w-full border border-[#2e3138]">
              <button onClick={() => setActiveTab('Project')} className={`flex-1 rounded-lg py-1.5 text-xs lg:text-sm font-semibold transition-all ${activeTab === 'Project' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>Project</button>
              <button onClick={() => setActiveTab('History')} className={`flex-1 rounded-lg py-1.5 text-xs lg:text-sm font-semibold transition-all ${activeTab === 'History' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>History</button>
            </div>
          </div>

          {activeTab === 'Project' && video && (
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
              {/* Existing Project Tab Content */}
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 className="text-white font-black mb-3 text-[10px] uppercase tracking-[0.3em]">Project Details</h3>
                <div className="bg-[#1c1e23] border border-[#2e3138] shadow-[0_8px_30px_rgba(0,0,0,0.4)] rounded-[2rem] p-6 space-y-7 relative overflow-hidden">
              {/* Background accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] pointer-events-none" />
              
              <div className="flex justify-between items-center gap-4 group">
                <span className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] shrink-0">Title</span>
                {isEditingTitle ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleTitleSubmit}
                    onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                    autoFocus
                    className="flex-1 bg-[#0e1015] px-3 py-2 rounded-xl border border-indigo-500/50 text-white outline-none text-[11px] text-right font-black uppercase tracking-tight shadow-inner"
                  />
                ) : (
                  <span 
                    className="text-white font-black truncate cursor-pointer hover:text-indigo-400 transition-all max-w-[200px] text-right text-[11px] uppercase tracking-tight"
                    onClick={() => onUpdateVideo && (isOwner || currentUser?.role === 'admin') && startEditingTitle()}
                    title={(isOwner || currentUser?.role === 'admin') ? "Click to edit" : ""}
                  >
                    {video.title}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Assignees</span>
                  <button 
                    onClick={() => isOwner && setIsEditingEditor(!isEditingEditor)}
                    className="text-[10px] font-black text-indigo-500 hover:text-indigo-400 transition-all uppercase tracking-widest flex items-center gap-1.5"
                  >
                    {isEditingEditor ? (
                      <span className="flex items-center gap-1.5 bg-indigo-500/10 px-2 py-1 rounded-lg">CLOSE <X className="w-3 h-3" /></span>
                    ) : (
                      'MANAGE'
                    )}
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {assignedEditors.length > 0 ? (
                    assignedEditors.map(editor => (
                      <div 
                        key={editor.id}
                        className="bg-black/40 text-indigo-400 border border-indigo-500/20 px-3 py-2 rounded-xl text-[9px] font-black tracking-[0.1em] flex items-center gap-2 group transition-all hover:border-indigo-500/40"
                      >
                        <UserIcon className="w-3 h-3 opacity-50" />
                        {editingAssigneeId === editor.id ? (
                          <input
                            autoFocus
                            type="text"
                            value={editAssigneeName}
                            onChange={(e) => setEditAssigneeName(e.target.value)}
                            onBlur={async () => {
                              if (editAssigneeName.trim() && editAssigneeName !== editor.name) {
                                await dbService.updateUserName(editor.id, editAssigneeName);
                                setUsers(prev => prev.map(u => u.id === editor.id ? { ...u, name: editAssigneeName } : u));
                              }
                              setEditingAssigneeId(null);
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                if (editAssigneeName.trim() && editAssigneeName !== editor.name) {
                                  await dbService.updateUserName(editor.id, editAssigneeName);
                                  setUsers(prev => prev.map(u => u.id === editor.id ? { ...u, name: editAssigneeName } : u));
                                }
                                setEditingAssigneeId(null);
                              }
                              if (e.key === 'Escape') setEditingAssigneeId(null);
                            }}
                            className="bg-transparent text-indigo-400 outline-none w-20 border-b border-indigo-500/50 uppercase"
                          />
                        ) : (
                          <span 
                            onClick={(e) => {
                              if (isOwner || currentUser?.role === 'admin') {
                                e.stopPropagation();
                                setEditingAssigneeId(editor.id);
                                setEditAssigneeName(editor.name || '');
                              }
                            }}
                            className={`${(isOwner || currentUser?.role === 'admin') ? 'cursor-pointer hover:text-white' : ''} truncate max-w-[100px]`}
                            title={(isOwner || currentUser?.role === 'admin') ? "Click to edit name" : ""}
                          >
                            {editor.name?.toUpperCase() || 'UNKNOWN'}
                          </span>
                        )}
                        {isEditingEditor && (
                          <button 
                            onClick={async () => {
                              if (onUpdateVideo && video) {
                                const newIds = video.editorIds?.filter(id => id !== editor.id) || [];
                                await onUpdateVideo({ editorIds: newIds });
                              }
                            }}
                            className="hover:text-red-500 border-l border-white/5 ml-1 pl-2 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-600 text-[10px] font-black uppercase tracking-widest py-1 italic opacity-50">No editors assigned</span>
                  )}
                </div>

                {isEditingEditor && (
                  <div className="mt-2 animate-in slide-in-from-top-1 duration-200">
                    <select
                      className="w-full bg-[#0e1015] px-4 py-3 rounded-2xl border border-white/5 text-white outline-none text-[10px] font-black uppercase tracking-[0.15em] focus:ring-2 focus:ring-indigo-500/50 hover:border-white/10 transition-all cursor-pointer appearance-none shadow-inner"
                      onChange={async (e) => {
                        const val = e.target.value;
                        if (val && video && onUpdateVideo) {
                          const currentIds = video.editorIds || [];
                          if (!currentIds.includes(val)) {
                            await onUpdateVideo({ editorIds: [...currentIds, val] });
                          }
                        }
                        e.target.value = "";
                      }}
                    >
                      <option value="">+ SELECT EDITOR</option>
                      {users
                        .filter(u => u.id !== video.ownerId && !video.editorIds?.includes(u.id))
                        .map(u => (
                          <option key={u.id} value={u.id} className="bg-[#1c1e23]">{u.name?.toUpperCase() || 'UNKNOWN'}</option>
                        ))
                      }
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 group">
                <div className="flex justify-between items-center px-1">
                  <span className="text-slate-500 font-black text-[9px] uppercase tracking-[0.2em] shrink-0">Storage</span>
                  {(isOwner || currentUser?.role === 'admin') && !isEditingDrive && (
                    <button 
                      onClick={() => setIsEditingDrive(true)}
                      className="text-slate-500 hover:text-indigo-400 transition-colors"
                      title="Edit link"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {isEditingDrive ? (
                  <div className="flex gap-2 items-center bg-[#0e1015] px-3 py-2.5 rounded-xl border border-blue-500/30 shadow-inner overflow-hidden animate-in fade-in zoom-in duration-200">
                    <Download className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <input
                      type="text"
                      defaultValue={video.driveUrl}
                      autoFocus
                      onBlur={async (e) => {
                        if (e.target.value !== video.driveUrl && onUpdateVideo) {
                          await onUpdateVideo({ driveUrl: e.target.value });
                        }
                        setIsEditingDrive(false);
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          const target = e.target as HTMLInputElement;
                          if (target.value !== video.driveUrl && onUpdateVideo) {
                            await onUpdateVideo({ driveUrl: target.value });
                          }
                          setIsEditingDrive(false);
                        }
                        if (e.key === 'Escape') setIsEditingDrive(false);
                      }}
                      className="flex-1 bg-transparent text-white outline-none text-[10px] font-medium placeholder:opacity-20 placeholder:italic truncate"
                      placeholder="Paste Drive link..."
                    />
                  </div>
                ) : video.driveUrl ? (
                  <a 
                    href={video.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 p-2.5 rounded-xl transition-all group/btn shadow-sm hover:shadow-blue-500/10"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover/btn:scale-110 transition-transform">
                      <HardDrive className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-black text-blue-400 uppercase tracking-wider leading-tight">LINK TẢI VIDEO 4K - DRIVE</div>
                      <div className="text-[9px] text-slate-500 truncate mt-0.5 opacity-60">Open original files</div>
                    </div>
                    <Globe className="w-3 h-3 text-slate-600 group-hover/btn:text-blue-400 transition-colors" />
                  </a>
                ) : (
                  <div 
                    onClick={() => (isOwner || currentUser?.role === 'admin') && setIsEditingDrive(true)}
                    className={`bg-[#0e1015]/50 px-3 py-3 rounded-xl border border-dashed border-white/5 text-slate-600 text-[10px] text-center italic cursor-pointer hover:border-white/10 transition-all ${isOwner || currentUser?.role === 'admin' ? 'hover:text-slate-400' : ''}`}
                  >
                    {isOwner || currentUser?.role === 'admin' ? '+ Add Drive Link' : 'No storage link provided'}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 group">
                  <span className="text-slate-500 font-black text-[8px] uppercase tracking-[0.2em] px-1">Status</span>
                  <div className="relative">
                    <button 
                      onClick={() => (isOwner || currentUser?.role === 'admin') && setIsEditingStatus(!isEditingStatus)}
                      className={cn(
                        "w-full px-4 py-2 rounded-xl border text-[8px] font-black uppercase tracking-widest transition-all text-center h-[38px] flex items-center justify-center leading-tight shadow-md",
                        video.status === 'Đã duyệt' || video.status === 'Đã hoàn thành' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-emerald-500/5' : 
                        video.status === 'Đang chờ duyệt' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/5' : 
                        video.status === 'Lịch feedback' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20 shadow-purple-500/5' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20 shadow-black/20'
                      )}
                    >
                      {video.status?.toUpperCase() || 'ĐANG THỰC HIỆN'}
                    </button>
                    
                    <AnimatePresence>
                      {isEditingStatus && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full left-0 w-full mb-2 bg-[#1c1e26] border border-white/10 rounded-2xl shadow-2xl p-1 z-50 backdrop-blur-xl"
                        >
                          {['Đang thực hiện', 'Đang chờ duyệt', 'Đã duyệt', 'Đã hoàn thành', 'Lịch feedback'].map((status) => (
                            <button
                              key={status}
                              onClick={async () => {
                                if (onUpdateVideo) await onUpdateVideo({ status: status as any });
                                setIsEditingStatus(false);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-lg text-[8px] font-black uppercase tracking-widest mb-1 last:mb-0 transition-all",
                                video.status === status ? "bg-white/10 text-white" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                              )}
                            >
                              {status}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 group">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-slate-500 font-black text-[8px] uppercase tracking-[0.2em]">Deadline</span>
                  </div>
                  <div className="relative group/deadline">
                    {isEditingDeadline ? (
                      <input
                        type="text"
                        value={editDeadlineText}
                        onChange={(e) => setEditDeadlineText(e.target.value)}
                        onBlur={handleDeadlineTextSubmit}
                        onKeyDown={(e) => e.key === 'Enter' && handleDeadlineTextSubmit()}
                        autoFocus
                        placeholder="DD/MM/YYYY HH:mm"
                        className="w-full bg-[#0e1015] px-4 py-2 rounded-xl border border-indigo-500/50 text-white text-[10px] font-black uppercase tracking-tight shadow-inner outline-none h-[38px]"
                      />
                    ) : (
                      <div 
                        className="w-full bg-[#0e1015] px-4 py-2 rounded-xl border border-white/5 text-white text-[8px] font-black uppercase tracking-widest transition-all group-hover/deadline:border-indigo-500/40 flex items-center justify-center gap-2 h-[38px] shadow-inner cursor-pointer"
                        onClick={() => (isOwner || currentUser?.role === 'admin') && startEditingDeadline()}
                      >
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        {deadlineDate ? deadlineDate.toLocaleString('vi-VN') : 'MỚI'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-slate-500 font-black text-[8px] uppercase tracking-[0.2em] px-1">Remaining</span>
                  <div className={cn(
                    "bg-[#0e1015] p-3 rounded-xl border border-white/5 flex items-center justify-between shadow-inner h-[38px]",
                    daysLeft !== null && daysLeft < 0 ? "border-red-500/20 bg-red-500/5 shadow-[0_0_20px_rgba(239,68,68,0.05)]" : 
                    daysLeft !== null && daysLeft <= 3 ? "border-amber-500/20 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.05)]" :
                    "shadow-[0_0_20px_rgba(0,0,0,0.2)]"
                  )}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full shadow-lg",
                        daysLeft !== null && daysLeft < 0 ? "bg-red-500 animate-pulse shadow-red-500/50" : 
                        daysLeft !== null && daysLeft <= 3 ? "bg-amber-500 animate-pulse shadow-amber-500/50" : 
                        "bg-emerald-500 shadow-emerald-500/50"
                      )} />
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest",
                        daysLeft !== null && daysLeft < 0 ? "text-red-400" : 
                        daysLeft !== null && daysLeft <= 3 ? "text-amber-400" : 
                        "text-emerald-400"
                      )}>
                        {daysLeft !== null ? (
                          daysLeft > 0 ? `Còn ${daysLeft} ngày` : 
                          daysLeft === 0 ? 'Hôm nay' : 
                          `Trễ ${Math.abs(daysLeft)} ngày`
                        ) : 'Chưa thiết lập'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                 Timeline
              </h3>
              {(isOwner || currentUser?.role === 'admin') && (
                <button
                  onClick={() => setIsEditingTimeline(!isEditingTimeline)}
                  className="text-[10px] font-black text-indigo-500 hover:text-indigo-400 transition-all uppercase tracking-widest"
                >
                  {isEditingTimeline ? 'SAVE' : 'EDIT'}
                </button>
              )}
            </div>
            <div className="relative border-l-2 border-[#2e3138] ml-2 space-y-6 pb-4">
              {(video.timeline || []).map((step: any, idx: number) => (
                <div key={idx} className="relative pl-6 group">
                  <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-[#1c1e23] shadow-sm transition-transform group-hover:scale-125 ${step.status === 'Done' ? 'bg-emerald-500 shadow-emerald-500/20' : step.status === 'Doing' ? 'bg-indigo-500 shadow-indigo-500/20' : 'bg-slate-600'}`}></div>
                  {isEditingTimeline ? (
                    <div className="flex flex-col gap-2">
                      <input 
                        type="text"
                        value={step.title}
                        onChange={async (e) => {
                          if (!video || !onUpdateVideo) return;
                          const newTimeline = [...(video.timeline || [])];
                          newTimeline[idx] = { ...newTimeline[idx], title: e.target.value };
                          await onUpdateVideo({ timeline: newTimeline });
                        }}
                        className="bg-[#0e1015] border border-indigo-500/50 rounded-lg px-2 py-1 text-sm text-white"
                      />
                      <input 
                        type="text"
                        placeholder="DD/MM/YYYY HH:mm"
                        defaultValue={step.date ? (() => {
                          const d = new Date(step.date);
                          const day = String(d.getDate()).padStart(2, '0');
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const year = d.getFullYear();
                          const hours = String(d.getHours()).padStart(2, '0');
                          const minutes = String(d.getMinutes()).padStart(2, '0');
                          return `${day}/${month}/${year} ${hours}:${minutes}`;
                        })() : ''}
                        onBlur={async (e) => {
                          if (!video || !onUpdateVideo) return;
                          const val = e.target.value;
                          const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?$/;
                          const match = val.trim().match(regex);
                          
                          if (match) {
                            const day = parseInt(match[1], 10);
                            const month = parseInt(match[2], 10) - 1;
                            const year = parseInt(match[3], 10);
                            const hours = match[4] ? parseInt(match[4], 10) : 0;
                            const minutes = match[5] ? parseInt(match[5], 10) : 0;
                            const newDate = new Date(year, month, day, hours, minutes);
                            
                            if (!isNaN(newDate.getTime())) {
                              const newTimeline = [...(video.timeline || [])];
                              newTimeline[idx] = { ...newTimeline[idx], date: newDate.getTime() };
                              await onUpdateVideo({ timeline: newTimeline });
                            }
                          }
                        }}
                        className="bg-[#0e1015] border border-indigo-500/50 rounded-lg px-2 py-1 text-sm text-white"
                      />
                      <select 
                        value={step.status}
                        onChange={async (e) => {
                          if (!video || !onUpdateVideo) return;
                          const newTimeline = [...(video.timeline || [])];
                          newTimeline[idx] = { ...newTimeline[idx], status: e.target.value as any };
                          await onUpdateVideo({ timeline: newTimeline });
                        }}
                        className="bg-[#0e1015] border border-indigo-500/50 rounded-lg px-2 py-1 text-sm text-white"
                      >
                         <option value="Upcoming">Upcoming</option>
                         <option value="Doing">Doing</option>
                         <option value="Done">Done</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-start mb-0.5">
                      <span className={`font-semibold text-sm transition-colors ${step.status === 'Done' ? 'text-slate-400 line-through opacity-70' : step.status === 'Doing' ? 'text-indigo-400' : 'text-slate-200'}`}>{step.title}</span>
                      <span className="text-xs text-slate-500 font-mono mt-1">{new Date(step.date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              ))}
              {(!video.timeline || video.timeline.length === 0) && (
                <div className="text-slate-500 text-sm pl-6">No timeline events set.</div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'History' && (
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar animate-in fade-in slide-in-from-right-2 duration-300">
          <h3 className="text-white font-semibold mb-5 text-sm uppercase tracking-wider flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> 
            Project History
          </h3>
          <div className="space-y-6">
             <div className="flex gap-4 text-sm relative">
               <div className="absolute top-4 bottom-[-1.5rem] left-[5px] w-0.5 bg-[#2e3138]"></div>
               <div className="mt-1 w-3 h-3 rounded-full bg-blue-500 shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.5)] z-10 ring-4 ring-[#1c1e23]"></div>
               <div>
                  <div className="text-slate-200">User uploaded new version <span className="text-blue-400 font-semibold cursor-pointer hover:underline">V1.mp4</span></div>
                  <div className="text-slate-500 text-xs font-medium mt-1">Today at 14:30</div>
               </div>
             </div>
             <div className="flex gap-4 text-sm relative">
               <div className="absolute top-4 bottom-[-1.5rem] left-[5px] w-0.5 bg-[#2e3138]"></div>
               <div className="mt-1 w-3 h-3 rounded-full bg-amber-500 shrink-0 z-10 ring-4 ring-[#1c1e23]"></div>
               <div>
                  <div className="text-slate-200">Người sở hữu đã cập nhật trạng thái thành <span className="bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded text-xs font-semibold ring-1 ring-inset ring-amber-500/20">Đang chờ duyệt</span></div>
                  <div className="text-slate-500 text-xs font-medium mt-1">Today at 09:15</div>
               </div>
             </div>
             <div className="flex gap-4 text-sm relative">
               <div className="mt-1 w-3 h-3 rounded-full bg-slate-500 shrink-0 z-10 ring-4 ring-[#1c1e23]"></div>
               <div>
                  <div className="text-slate-200">Project was created</div>
                  <div className="text-slate-500 text-xs font-medium mt-1">Yesterday, 10:00</div>
               </div>
             </div>
          </div>
        </div>
      )}
    </>
  </div>
  );
}
