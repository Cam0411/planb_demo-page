import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Plus, Clock, MessageSquare, CheckCircle, Send, Globe, X } from 'lucide-react';
import { cn, formatTime } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/db';
import { User } from '../types';

interface FeedbackFormProps {
  currentTime: number;
  onAddFrameFeedback: (content: string, priority: string, category: string) => void;
  onAddGeneralFeedback: (content: string, priority: string, category: string) => void;
}

export default function FeedbackForm({ currentTime, onAddFrameFeedback, onAddGeneralFeedback }: FeedbackFormProps) {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'frame' | 'general'>('frame');
  const [priority, setPriority] = useState('Normal');
  const [category, setCategory] = useState('Edit');
  const [users, setUsers] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    dbService.getAllUsers().then(setUsers);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAt = textBeforeCursor.lastIndexOf('@');

    if (lastAt !== -1 && (lastAt === 0 || textBeforeCursor[lastAt - 1] === ' ')) {
      const queryText = textBeforeCursor.substring(lastAt + 1);
      if (!queryText.includes(' ')) {
        setShowMentions(true);
        setMentionQuery(queryText);
        setMentionIndex(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
    setContent(value);
  }, []);

  const insertMention = useCallback((user: User) => {
    const cursorPosition = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = content.substring(0, cursorPosition);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    
    const newContent = content.substring(0, lastAt) + `@${user.name} ` + content.substring(cursorPosition);
    setContent(newContent);
    setShowMentions(false);
    
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = lastAt + user.name.length + 2;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [content]);

  const filteredUsers = useMemo(() => 
    users.filter(u => 
      u.name.toLowerCase().includes(mentionQuery.toLowerCase()) || 
      (u.email && u.email.toLowerCase().includes(mentionQuery.toLowerCase()))
    ).slice(0, 5),
    [users, mentionQuery]
  );

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!content.trim()) return;
    
    if (mode === 'frame') {
      onAddFrameFeedback(content, priority, category);
    } else {
      onAddGeneralFeedback(content, priority, category);
    }
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[mentionIndex]);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const categories = ['Edit', 'Audio', 'Color', 'Question', 'General'];
  const priorities = [
    { label: 'Thấp', value: 'Low', color: 'text-slate-400 bg-white/5 border-white/10' },
    { label: 'Vừa', value: 'Normal', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    { label: 'Cao', value: 'High', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#1c1e23] border border-[#2e3138] rounded-2xl p-4 flex flex-col gap-4 shadow-2xl">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-[#14151a] p-1 rounded-xl border border-[#2e3138]">
              <button 
                onClick={() => setMode('frame')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  mode === 'frame' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
                )}
               >
                Góp ý Frame
              </button>
              <button 
                onClick={() => setMode('general')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  mode === 'general' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
                )}
               >
                FEEDBACK TỔNG THỂ
              </button>
            </div>
          </div>

          <div className="flex bg-[#14151a] p-2 rounded-xl border border-[#2e3138]">
            {mode === 'frame' && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] font-black font-mono">{formatTime(currentTime)}</span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <textarea 
            ref={textareaRef}
            rows={3}
            placeholder={mode === 'frame' ? "Nhập yêu cầu chỉnh sửa cho đoạn phim này. Dùng @ để tag..." : "Nhập góp ý FEEDBACK TỔNG THỂ. Dùng @ để tag..."}
            className="w-full bg-[#14151a] border border-[#2e3138] rounded-xl p-3 text-sm text-white focus:border-indigo-500/50 outline-none transition-all placeholder:text-slate-600 resize-none min-h-[80px]"
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <AnimatePresence>
            {showMentions && filteredUsers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="absolute bottom-full left-0 mb-2 w-full max-w-[280px] bg-[#1c1e23] border border-white/5 rounded-2xl shadow-2xl overflow-hidden z-50"
              >
                {filteredUsers.map((user, i) => (
                  <button
                    key={user.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); insertMention(user); }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 text-left transition-all",
                      i === mentionIndex ? "bg-indigo-500/10 border-l-2 border-l-indigo-500" : "hover:bg-white/5"
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-black text-white shrink-0">
                      {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover rounded-lg" /> : user.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white truncate uppercase tracking-tight">{user.name}</p>
                      {user.email && <p className="text-[9px] text-slate-500 truncate">{user.email}</p>}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            type="submit"
            disabled={!content.trim()}
            className="absolute bottom-3 right-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white p-2 rounded-lg transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      <button 
        onClick={(e) => {
          const btn = e.currentTarget;
          const original = btn.innerHTML;
          btn.innerHTML = '<span class="flex items-center gap-2"><CheckCircle class="w-4 h-4" /> ĐÃ GỬI YÊU CẦU</span>';
          btn.className = "w-full py-3 bg-emerald-500 text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center uppercase tracking-widest";
          setTimeout(() => {
            btn.innerHTML = original;
            btn.className = "w-full py-3 bg-[#24262d] hover:bg-[#2e3138] text-white rounded-xl text-xs font-black transition-all border border-[#3e4148] flex items-center justify-center uppercase tracking-widest";
          }, 3000);
        }}
        className="w-full py-3 bg-[#24262d] hover:bg-[#2e3138] text-white rounded-xl text-xs font-black transition-all border border-[#3e4148] flex items-center justify-center uppercase tracking-widest"
      >
        <Globe className="w-4 h-4 mr-2" />
        Xác nhận hoàn tất Feedback
      </button>
    </div>
  );
}
