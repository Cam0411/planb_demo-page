import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MessageSquare, Trash2, Search, Filter, ArrowUpDown } from 'lucide-react';
import { Comment, User } from '../types';
import { formatTime } from '../lib/utils';

interface CommentTableProps {
  comments: Comment[];
  currentUser: User | null;
  onSeek: (seconds: number) => void;
  onToggleStatus: (id: string, current: boolean) => void;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

type SortField = 'time' | 'date' | 'priority';
type SortOrder = 'asc' | 'desc';

export default function CommentTable({ comments, currentUser, onSeek, onToggleStatus, onUpdate, onDelete }: CommentTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const handleEditStart = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleEditSave = (id: string) => {
    if (!editContent.trim()) return;
    onUpdate(id, editContent);
    setEditingId(null);
  };

  const filteredAndSortedComments = useMemo(() => {
    let result = [...comments];

    // Search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(c => c.content.toLowerCase().includes(lowerSearch));
    }

    // Filter
    if (filterCategory !== 'All') {
      result = result.filter(c => c.category === filterCategory);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'time') {
        comparison = (a.frameTime || 0) - (b.frameTime || 0);
      } else if (sortField === 'date') {
        comparison = a.createdAt - b.createdAt;
      } else if (sortField === 'priority') {
        const pMap = { 'High': 3, 'Normal': 2, 'Low': 1 };
        comparison = (pMap[a.priority || 'Normal'] || 0) - (pMap[b.priority || 'Normal'] || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [comments, searchTerm, sortField, sortOrder, filterCategory]);

  const resolvedCount = comments.filter(c => c.resolved).length;
  const progressPercent = comments.length > 0 ? (resolvedCount / comments.length) * 100 : 0;

  const categories = ['All', 'Edit', 'Audio', 'Color', 'Question', 'General'];

  const getPriorityColor = (p?: string) => {
    switch (p) {
      case 'High': return 'text-red-700 bg-red-100 border-red-200';
      case 'Low': return 'text-slate-600 bg-slate-100 border-slate-200';
      default: return 'text-blue-700 bg-blue-100 border-blue-200';
    }
  };

  return (
    <div className="w-full lg:w-[420px] xl:w-[460px] bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm overflow-hidden shrink-0 mt-4 lg:mt-0 lg:max-h-full">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-slate-500" />
            Database Feedback
          </h2>
          <div className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-0.5 rounded shadow-inner">
            {resolvedCount} / {comments.length}
          </div>
        </div>
        
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${progressPercent}%` }}
               className="bg-emerald-500 h-1.5 rounded-full"
               transition={{ duration: 0.5, ease: "easeOut" }}
             />
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Tìm nội dung feedback..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                }}
                className="flex-1 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 mr-2" />
                <span className="text-[11px] font-medium">Sắp xếp theo {sortField === 'date' ? 'Ngày' : sortField === 'time' ? 'Thời gian' : 'Độ ưu tiên'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative bg-slate-50 min-h-[300px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-white sticky top-0 border-b border-slate-200 shadow-sm z-10">
            <tr className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <th 
                className="p-3 w-16 border-r border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setSortField('time')}
              >
                Time {sortField === 'time' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="p-3 border-r border-slate-100">Feedback Detail</th>
              <th className="p-3 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 relative">
            <AnimatePresence initial={false}>
              {filteredAndSortedComments.map((comment) => (
                <motion.tr 
                  key={comment.id} 
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className={`transition-colors group hover:bg-blue-50/40 ${comment.resolved ? 'opacity-60 bg-slate-50' : 'bg-white'}`}
                >
                  <td className={`p-3 font-mono border-r border-slate-100 align-top whitespace-nowrap ${comment.resolved ? 'text-slate-500 bg-slate-50' : 'text-blue-600 bg-blue-50/20'}`}>
                    {comment.frameTime !== undefined ? formatTime(comment.frameTime) : 'FEEDBACK TỔNG THỂ'}
                  </td>
                  <td className="p-3 border-r border-slate-100 align-top relative">
                    <div className={`text-[13px] font-medium leading-relaxed mb-3 ${comment.resolved ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                      {editingId === comment.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditSave(comment.id)}
                              className="px-2 py-1 text-[10px] font-bold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              SAVE
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-2 py-1 text-[10px] font-bold bg-slate-200 text-slate-600 rounded hover:bg-slate-300 transition-colors"
                            >
                              CANCEL
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="cursor-pointer group/content relative"
                          onClick={() => !comment.resolved && handleEditStart(comment)}
                        >
                          {comment.content}
                          {!comment.resolved && (
                            <span className="ml-2 text-[10px] text-blue-500 opacity-0 group-hover/content:opacity-100 font-bold transition-opacity">
                              (Sửa)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                            {currentUser?.name?.charAt(0) || '?'}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium italic">{new Date(comment.createdAt).toLocaleDateString()}</span>
                       </div>
                       <div className="flex gap-2">
                          {comment.frameTime !== undefined && (
                            <button 
                              onClick={() => onSeek(comment.frameTime!)}
                              className="opacity-0 group-hover:opacity-100 flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded hover:bg-blue-100 transition-all"
                            >
                              <Clock className="w-3 h-3 mr-1" />
                              Seek
                            </button>
                          )}
                          <button
                            onClick={() => onToggleStatus(comment.id, comment.resolved)}
                            className={`opacity-0 group-hover:opacity-100 text-[10px] px-2 py-0.5 rounded border font-bold transition-all ${
                              comment.resolved 
                                ? 'bg-slate-100 text-slate-500 border-slate-200' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            }`}
                          >
                            {comment.resolved ? 'REVOKE' : 'RESOLVE'}
                          </button>
                       </div>
                    </div>
                  </td>
                  <td className="p-3 align-top text-center">
                     <button
                       onClick={() => onDelete(comment.id)}
                       className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                       title="Xóa feedback"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {filteredAndSortedComments.length === 0 && (
              <tr>
                <td colSpan={3} className="p-16 text-center text-slate-400 bg-white">
                  <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-100">
                     <Filter className="w-6 h-6 text-slate-200" />
                  </div>
                  <p className="font-bold text-sm text-slate-600">Không tìm thấy kết quả.</p>
                  <p className="text-xs mt-1">Vui lòng điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-500 bg-slate-50 shadow-sm z-10 shrink-0 uppercase tracking-widest">
        <span className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-100"></div> 
          Real-time Syncing
        </span>
        <span className="bg-slate-200 px-2 py-1 rounded block">Row Count: {comments.length}</span>
      </div>
    </div>
  );
}
