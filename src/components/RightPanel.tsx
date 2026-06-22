import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Comment, User, Video } from '../types';
import { formatTime, cn } from '../lib/utils';
import { MessageSquare, MoreHorizontal, Smile, Send, AtSign, X, Image as ImageIcon, Video as VideoIcon, ArrowDown, ArrowUp } from 'lucide-react';
import { upload } from '@imagekit/react';
import { dbService } from '../services/db';
import { motion, AnimatePresence } from 'framer-motion';
import CommentItem from './CommentItem';

interface RightPanelProps {
  video: Video | null;
  comments: Comment[];
  currentUser: User | null;
  guestName?: string;
  allUsers?: User[];
  currentTime: number;
  onSeek: (time: number) => void;
  onPause?: () => void;
  onPlay?: () => void;
  onAddComment: (content: string, frameTime: number | null, attachmentUrl: string | null, parentId?: string) => void;
  onUpdateComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReactComment: (commentId: string, emoji: string) => void;
  onToggleCommentStatus?: (commentId: string, resolved: boolean) => void;
  onCloseOnMobile?: () => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const renderTextWithMentions = (text: string) => {
  if (!text) return null;
  
  const parts = text.split(/(@[^\s@]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="text-indigo-400 font-bold hover:underline cursor-pointer">
          {part}
        </span>
      );
    }
    return part;
  });
};

const getAuthToken = async () => {
  try {
    const expire = Math.floor(Date.now() / 1000) + 2400; // 40 minutes 
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const str = token + expire;
    const privateKey = "private_20BiH1jR6XitK5WvklkRMCT7v8A=";
    const encoder = new TextEncoder();
    const key = await window.crypto.subtle.importKey('raw', encoder.encode(privateKey), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const signatureBuffer = await window.crypto.subtle.sign('HMAC', key, encoder.encode(str));
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return { token, expire, signature };
  } catch (error: any) {
    throw new Error(`Authentication generation failed: ${error.message}`);
  }
};

export default function RightPanel({ 
  video, 
  comments, 
  currentUser, 
  guestName,
  allUsers,
  currentTime, 
  onSeek, 
  onPause,
  onPlay,
  onAddComment, 
  onUpdateComment, 
  onDeleteComment, 
  onReactComment,
  onToggleCommentStatus,
  onCloseOnMobile
}: RightPanelProps) {
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [useFrameTime, setUseFrameTime] = useState(true);
  const [priority, setPriority] = useState<'Low' | 'Normal' | 'High'>('Normal');
  const [category, setCategory] = useState<'Edit' | 'Audio' | 'Color' | 'Question' | 'General'>('Edit');
  const [filterMode, setFilterMode] = useState<'all' | 'frame' | 'general'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentsStartRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [content, adjustTextareaHeight]);

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
    (allUsers || []).filter(u => userMatchesQuery(u, mentionQuery)).slice(0, 5),
    [allUsers, mentionQuery]
  );

  function userMatchesQuery(user: User, query: string) {
    return user.name.toLowerCase().includes(query.toLowerCase()) || 
           (user.email && user.email.toLowerCase().includes(query.toLowerCase()));
  }

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    if (!content.trim() && !attachmentUrl) return;

    setIsSubmitting(true);
    try {
      const finalContent = content;
      // Clear early for UI responsiveness
      setContent('');
      setAttachmentUrl(null);
      setReplyingTo(null);
      
      await onAddComment(finalContent, (replyingTo || !useFrameTime) ? null : currentTime, attachmentUrl, replyingTo?.id);
    } catch (err) {
      console.error("Submit failed", err);
    } finally {
      setIsSubmitting(false);
    }
  }, [content, attachmentUrl, onAddComment, replyingTo, useFrameTime, currentTime, isSubmitting]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Basic IME check: don't submit if we are in the middle of composition
    if (e.nativeEvent.isComposing) return;

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
  }, [showMentions, filteredUsers, mentionIndex, insertMention, handleSubmit]);

  useEffect(() => {
    if (sortOrder === 'desc') {
      commentsStartRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, sortOrder]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const isVideoFile = file.type.startsWith('video/') || file.name.endsWith('.mp4');

    try {
      if (isVideoFile) {
        if (file.size > 100 * 1024 * 1024) throw new Error("Video phải dưới 100MB");

        const sigRes = await fetch("/api/cloudinary-signature");
        if (!sigRes.ok) {
          const errorText = await sigRes.text();
          console.error("Signature API Error:", errorText);
          throw new Error(`Không thể lấy chữ ký upload (Status: ${sigRes.status}). Vui lòng kiểm tra server.`);
        }
        
        const contentType = sigRes.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await sigRes.text();
          console.error("Non-JSON response from signature API:", text);
          throw new Error("Server trả về dữ liệu không hợp lệ (HTML thay vì JSON). Có thể do lỗi cấu hình route.");
        }

        const { signature, timestamp, cloud_name, api_key } = await sigRes.json();

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", api_key);
        formData.append("timestamp", timestamp);
        formData.append("signature", signature);
        formData.append("folder", "video_feedback_comments");

        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`, {
          method: "POST",
          body: formData,
        });

        if (!cloudRes.ok) {
          try {
            const errorData = await cloudRes.json();
            throw new Error(errorData.error?.message || "Cloudinary upload failed");
          } catch (e) {
            const errorText = await cloudRes.text();
            throw new Error(`Cloudinary error (Status: ${cloudRes.status}): ${errorText.substring(0, 100)}`);
          }
        }

        const data = await cloudRes.json();
        setAttachmentUrl(data.secure_url);
      } else {
        const auth = await getAuthToken();
        const response = await upload({
          file,
          fileName: file.name || 'uploaded_image.png',
          publicKey: "public_lUDAoFgY6n9xUodQ0SiFhIhbSHA=",
          signature: auth.signature,
          expire: auth.expire,
          token: auth.token,
          folder: "/syncframe",
          useUniqueFileName: true
        });
        setAttachmentUrl(response.url);
      }
    } catch (err: any) {
      alert("Lỗi upload: " + (err.message || 'Unknown error'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const parentComments = useMemo(() => {
    let filtered = comments.filter(c => !c.parentId);
    if (filterMode === 'frame') {
      filtered = filtered.filter(c => c.frameTime !== undefined && c.frameTime !== null);
    } else if (filterMode === 'general') {
      filtered = filtered.filter(c => c.frameTime === undefined || c.frameTime === null);
    }
    
    return [...filtered].sort((a, b) => {
      const timeA = a.createdAt || 0;
      const timeB = b.createdAt || 0;
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [comments, filterMode, sortOrder]);

  return (
    <div className="flex-1 flex flex-col bg-[#1c1e23] text-slate-300 min-h-0">
      <div className="flex bg-[#14151a] p-3 gap-1 overflow-x-auto custom-scrollbar shrink-0 shadow-inner items-center justify-between">
        <h3 className="font-semibold text-white px-2 uppercase tracking-widest text-[10px]">Feedback list ({comments.length})</h3>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className={cn(
              "p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest border border-transparent",
              "hover:bg-white/5 text-slate-500 hover:text-indigo-400"
            )}
            title={sortOrder === 'desc' ? "Newest first" : "Oldest first"}
          >
            {sortOrder === 'desc' ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{sortOrder === 'desc' ? 'Newest' : 'Oldest'}</span>
          </button>
          
          {onCloseOnMobile && (
            <button onClick={onCloseOnMobile} className="lg:hidden p-1 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3 border-b border-[#2e3138] flex flex-col gap-3 shadow-sm bg-[#1c1e23] z-10">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-black uppercase tracking-wider text-[10px]">Feedback list ({comments.length})</span>
          <div className="flex gap-1">
            <button className="p-1 hover:bg-[#2e3138] text-slate-500 hover:text-white rounded transition-colors"><MoreHorizontal className="w-4 h-4"/></button>
          </div>
        </div>
        
        <div className="flex gap-1 bg-[#14151a] p-1 rounded-xl border border-[#2e3138]">
          <button 
            onClick={() => setFilterMode('all')}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
              filterMode === 'all' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Tất cả
          </button>
          <button 
            onClick={() => setFilterMode('frame')}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
              filterMode === 'frame' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Theo Frame
          </button>
          <button 
            onClick={() => setFilterMode('general')}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
              filterMode === 'general' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
            )}
          >
            FEEDBACK TỔNG THỂ
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-[#14151a] min-h-0">
        <div ref={commentsStartRef} />
        {parentComments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            replies={comments.filter(c => c.parentId === comment.id)}
            currentUser={currentUser}
            guestName={guestName}
            allUsers={allUsers}
            video={video}
            currentTime={currentTime}
            editingCommentId={editingCommentId}
            editContent={editContent}
            deletingId={deletingId}
            showEmojiPicker={showEmojiPicker}
            onSeek={onSeek}
            onUpdateComment={onUpdateComment}
            onDeleteComment={onDeleteComment}
            onReactComment={onReactComment}
            onToggleCommentStatus={onToggleCommentStatus}
            onSetEditing={(id, content) => { setEditingCommentId(id); setEditContent(content); }}
            onSetDeleting={setDeletingId}
            onSetEmojiPicker={setShowEmojiPicker}
            onReply={setReplyingTo}
            onZoom={setZoomedImage}
            renderTextWithMentions={renderTextWithMentions}
            EMOJIS={EMOJIS}
          />
        ))}
        {comments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
             <div className="w-16 h-16 bg-[#1c1e23] rounded-3xl flex items-center justify-center mb-4 border border-white/5">
                <MessageSquare className="w-6 h-6 text-slate-500" />
             </div>
             <p className="text-slate-400 text-sm font-black uppercase tracking-widest">No feedback yet</p>
             <p className="text-slate-500 text-[10px] mt-2 max-w-[150px] mx-auto font-medium">Be the first to share your creative thoughts!</p>
          </div>
        )}
        <div ref={commentsEndRef} />
      </div>

      <div className="p-4 bg-[#1c1e23] border-t border-[#2e3138] z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
        {replyingTo && (
          <div className="mb-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3 flex justify-between items-center animate-in slide-in-from-bottom-2">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-indigo-400 font-black uppercase tracking-widest mb-1">Replying to {replyingTo.userName}</div>
              <div className="text-xs text-slate-300 truncate opacity-80 italic">"{replyingTo.content}"</div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-full transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {attachmentUrl && (
          <div className="mb-4 relative inline-block group animate-in zoom-in-95">
             {attachmentUrl.match(/\.(mp4|webm|ogg)|cloudinary\.com.*video/) ? (
               <div className="relative">
                 <video src={attachmentUrl} className="h-32 rounded-2xl border-2 border-indigo-500/30 shadow-2xl" controls muted />
                 <div className="absolute top-2 left-2 bg-indigo-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md">Video</div>
               </div>
             ) : (
               <img src={attachmentUrl} className="h-24 rounded-2xl border-2 border-indigo-500/30 shadow-2xl object-cover" />
             )}
             <button onClick={() => setAttachmentUrl(null)} className="absolute -top-3 -right-3 bg-red-600 hover:bg-red-700 rounded-full p-1.5 border-2 border-[#1c1e23] transition-all shadow-xl">
               <X className="w-3 h-3 text-white" />
             </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-2 bg-[#14151a] border border-[#2e3138] rounded-2xl px-4 py-3 focus-within:border-indigo-500/50 transition-all shadow-inner relative group/input">
             <div className="flex items-center justify-between mb-1">
               <div className="flex gap-2">
                 <button 
                  type="button"
                  onClick={() => setUseFrameTime(true)}
                  className={cn(
                    "px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-widest border transition-all uppercase",
                    useFrameTime ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "bg-transparent text-slate-600 border-transparent hover:text-slate-400"
                  )}
                 >
                   Frame: {formatTime(currentTime)}
                 </button>
                 <button 
                  type="button"
                  onClick={() => setUseFrameTime(false)}
                  className={cn(
                    "px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-widest border transition-all uppercase",
                    !useFrameTime ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "bg-transparent text-slate-600 border-transparent hover:text-slate-400"
                  )}
                 >
                   FEEDBACK TỔNG THỂ
                 </button>
               </div>
               {isUploading && <span className="text-[10px] font-black text-amber-500 animate-pulse uppercase tracking-widest">Uploading...</span>}
             </div>
             

             <textarea 
               ref={textareaRef}
               rows={1}
               className="flex-1 bg-transparent text-sm text-slate-200 outline-none p-1 placeholder:text-slate-600 font-medium resize-none min-h-[40px] max-h-[200px] overflow-y-auto" 
               placeholder={replyingTo ? "Write a reply..." : (useFrameTime ? "Góp ý cho frame này..." : "Góp ý FEEDBACK TỔNG THỂ...")} 
               onFocus={() => onPause?.()}
               onBlur={() => setTimeout(() => onPlay?.(), 200)}
               value={content}
               onChange={handleInputChange}
               onKeyDown={handleKeyDown}
             />
             <AnimatePresence>
               {showMentions && filteredUsers.length > 0 && (
                 <motion.div
                   initial={{ opacity: 0, y: 10, scale: 0.95 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   exit={{ opacity: 0, y: 10, scale: 0.95 }}
                   className="absolute bottom-full mb-3 left-0 w-72 bg-[#1c1e23] border border-[#2e3138] rounded-2xl shadow-2xl overflow-hidden z-[100] transform -translate-x-2"
                 >
                   {filteredUsers.map((user, i) => (
                     <button
                       key={user.id}
                       type="button"
                       onMouseDown={(e) => { e.preventDefault(); insertMention(user); }}
                       className={cn("w-full flex items-center gap-4 p-3.5 hover:bg-white/5 transition-colors text-left", i === mentionIndex ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : '')}
                     >
                       <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-black text-white shrink-0">
                         {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover rounded-xl" /> : user.name.charAt(0)}
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="text-sm font-black text-white truncate">{user.name}</p>
                         {user.email && <p className="text-[10px] text-slate-500 truncate">{user.email}</p>}
                       </div>
                     </button>
                   ))}
                 </motion.div>
               )}
             </AnimatePresence>
          </div>
          <div className="flex justify-between items-center bg-[#14151a] p-1.5 rounded-2xl border border-[#2e3138]">
             <div className="flex gap-1">
               <button type="button" className="p-2.5 text-slate-500 hover:text-indigo-400 rounded-xl transition-all"><Smile className="w-5 h-5"/></button>
               <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-500 hover:text-indigo-400 rounded-xl transition-all"><ImageIcon className="w-5 h-5"/></button>
               <button type="button" onClick={() => videoInputRef.current?.click()} className="p-2.5 text-slate-500 hover:text-indigo-400 rounded-xl transition-all"><VideoIcon className="w-5 h-5"/></button>
               <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
               <input type="file" ref={videoInputRef} className="hidden" onChange={handleFileChange} accept="video/mp4" />
             </div>
             <button 
               type="submit" 
               disabled={(!content.trim() && !attachmentUrl) || isUploading} 
               className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
             >
                {isUploading ? 'Uploading...' : 'Send'} <Send className="w-4 h-4 ml-2 inline"/>
             </button>
          </div>
        </form>
      </div>
      
      {/* Zoom Image Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-6" onClick={() => setZoomedImage(null)}>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative max-w-5xl max-h-full" onClick={e => e.stopPropagation()}>
            <button className="absolute -top-10 right-0 text-white bg-white/10 p-2 rounded-full" onClick={() => setZoomedImage(null)}><X className="w-6 h-6" /></button>
            <img src={zoomedImage} className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
          </motion.div>
        </div>
      )}
    </div>
  );
}
