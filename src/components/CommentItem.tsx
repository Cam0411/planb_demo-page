import { memo, useState } from 'react';
import { Comment, User, Video } from '../types';
import { formatTime, cn } from '../lib/utils';
import { Trash2, Edit2, Smile, Check } from 'lucide-react';

interface CommentItemProps {
  comment: Comment;
  replies: Comment[];
  currentUser: User | null;
  guestName?: string;
  allUsers?: User[];
  video: Video | null;
  currentTime: number;
  editingCommentId: string | null;
  editContent: string;
  deletingId: string | null;
  showEmojiPicker: string | null;
  onSeek: (time: number) => void;
  onUpdateComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onReactComment: (commentId: string, emoji: string) => void;
  onToggleCommentStatus?: (commentId: string, resolved: boolean) => void;
  onSetEditing: (id: string | null, content: string) => void;
  onSetDeleting: (id: string | null) => void;
  onSetEmojiPicker: (id: string | null) => void;
  onReply: (comment: Comment) => void;
  onZoom: (url: string) => void;
  renderTextWithMentions: (text: string) => React.ReactNode;
  EMOJIS: string[];
}

const CommentItem = memo(({
  comment,
  replies,
  currentUser,
  guestName,
  allUsers,
  video,
  currentTime,
  editingCommentId,
  editContent,
  deletingId,
  showEmojiPicker,
  onSeek,
  onUpdateComment,
  onDeleteComment,
  onReactComment,
  onToggleCommentStatus,
  onSetEditing,
  onSetDeleting,
  onSetEmojiPicker,
  onReply,
  onZoom,
  renderTextWithMentions,
  EMOJIS
}: CommentItemProps) => {
  const isAuthor = comment.userId === currentUser?.id;
  
  const registeredGuestName = typeof window !== 'undefined' ? localStorage.getItem('guestName') : '';
  const myCommentIds = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('myCommentIds') || '[]') : [];

  const isVideoOwnerOrEditor = video?.ownerId === currentUser?.id || video?.editorIds?.includes(currentUser?.id || '') || currentUser?.role === 'admin';

  const renderCommentContent = (c: Comment, isReply = false) => {
    const isEditing = editingCommentId === c.id;
    
    // Check if the comment author is an admin to apply branding
    const author = allUsers?.find(u => u.id === c.userId);
    const isAdmin = author?.role === 'admin';
    const brandedName = isAdmin ? 'PlanB Production' : (c.userName || (c.userId === currentUser?.id ? currentUser?.name : 'User'));
    const brandedAvatar = isAdmin ? 'https://ik.imagekit.io/39wvgoqre/B%20(1).png?updatedAt=1777439253123' : (c.userAvatar || (c.userId === currentUser?.id && currentUser?.avatar ? currentUser.avatar : null));
    const isGuest = c.userId === 'guest';

    // Delete permissions specific to comment object 'c'
    const currentVisitorName = guestName || (currentUser?.id === 'guest' 
      ? currentUser.name 
      : (typeof window !== 'undefined' ? (localStorage.getItem('guestName') || '') : ''));

    const dynamicMyCommentIds = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('myCommentIds') || '[]') : [];

    const isAuthorOfC = c.userId !== 'guest' && c.userId === currentUser?.id;
    const isMyGuestCommentOfC = c.userId === 'guest' && (
      dynamicMyCommentIds.includes(c.id) || 
      myCommentIds.includes(c.id) || 
      (currentVisitorName && c.userName && currentVisitorName.trim().toLowerCase() === c.userName.trim().toLowerCase())
    );
    const canDeleteForC = isAuthorOfC || 
                          isMyGuestCommentOfC || 
                          video?.ownerId === currentUser?.id || 
                          video?.editorIds?.includes(currentUser?.id || '') ||
                          currentUser?.role === 'admin';
    
    return (
      <div className={cn("flex gap-3 relative animate-in fade-in slide-in-from-bottom-2", isReply ? "mt-4" : "")}>
        <div className={cn("rounded-[0.75rem] bg-gradient-to-br from-slate-700 to-slate-900 flex-shrink-0 flex items-center justify-center font-bold text-white overflow-hidden shadow-lg border border-white/5", isReply ? "w-6 h-6 text-[10px]" : "w-10 h-10 text-xs")}>
          {brandedAvatar ? <img src={brandedAvatar} className="w-full h-full object-cover" /> : brandedName?.charAt(0) || "U"}
        </div>
        <div className={cn(
          "flex-1 rounded-[1.25rem] group/comment relative border border-[#2e3138] shadow-2xl transition-all hover:bg-[#24262d]", 
          isReply ? "p-3 bg-[#111217] text-xs" : "p-4 bg-[#1c1e23] text-sm"
        )}>
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <span className={cn("font-bold tracking-tight", isReply ? "text-slate-200" : "text-white")}>
                {brandedName} 
              </span>
              {isGuest && (
                <span className="text-[7px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20">Guest</span>
              )}
              {isAdmin && (
                <span className="text-[7px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-500 px-1.5 py-0.5 rounded border border-indigo-500/20">Admin</span>
              )}
              <span className="text-slate-600 font-medium text-[9px] lowercase opacity-50">{new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>

            {/* Resolve/Tick Checkbox/Badge right side of comment header */}
            <div className="flex items-center gap-1.5 shrink-0 ml-4">
              {c.resolved && (
                <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/30">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                  ĐÃ XỬ LÝ
                </span>
              )}
              
              {isVideoOwnerOrEditor && (
                <button
                  onClick={() => onToggleCommentStatus?.(c.id, !c.resolved)}
                  className={cn(
                    "p-1 rounded-full transition-all border shrink-0 cursor-pointer",
                    c.resolved 
                      ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30" 
                      : "bg-[#14151a] hover:bg-slate-800 text-slate-500 hover:text-white border-[#2e3138]"
                  )}
                  title={c.resolved ? "Đánh dấu chưa sửa xong" : "Tích vào đây khi đã sửa xong feedback này"}
                >
                  <Check className={cn("w-3 h-3 stroke-[3.5]", c.resolved ? "opacity-100" : "opacity-30 group-hover/comment:opacity-100")} />
                </button>
              )}
            </div>
          </div>
          
          {isEditing ? (
            <div className="mt-2">
              <textarea
                autoFocus
                className="w-full bg-[#14151a] border border-indigo-500/50 text-slate-200 outline-none p-2.5 rounded-lg focus:ring-1 focus:ring-indigo-500 shadow-inner resize-none min-h-[60px]"
                value={editContent}
                onChange={(e) => onSetEditing(c.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onUpdateComment(c.id, editContent);
                    onSetEditing(null, '');
                  } else if (e.key === 'Escape') {
                    onSetEditing(null, '');
                  }
                }}
              />
              <div className="flex gap-2 mt-2 text-xs">
                <button onClick={() => { onUpdateComment(c.id, editContent); onSetEditing(null, ''); }} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold transition-colors shadow-sm font-black uppercase tracking-widest text-[9px]">SAVE</button>
                <button onClick={() => onSetEditing(null, '')} className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-[#2e3138] rounded-md transition-colors font-black uppercase tracking-widest text-[9px]">CANCEL</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap gap-2 mb-2">
                {!isReply && (
                  c.frameTime !== undefined && c.frameTime !== null ? (
                    <button 
                      onClick={() => onSeek(c.frameTime!)} 
                      className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest inline-flex items-center transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5 animate-pulse"></span>
                      FRAME: {formatTime(c.frameTime)}
                    </button>
                  ) : (
                    <div className="bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest inline-flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span>
                      FEEDBACK TỔNG THỂ
                    </div>
                  )
                )}
              </div>
              <span className={cn(
                "leading-relaxed break-words transition-all duration-300", 
                isReply ? "text-slate-400 text-[11px]" : "text-slate-300 text-[13px]",
                c.resolved ? "line-through text-slate-500 opacity-60 decoration-slate-600 decoration-2" : ""
              )}>
                {renderTextWithMentions(c.content)}
              </span>
            </div>
          )}

          {c.attachmentUrl && (
            <div className="mt-3 relative group/img overflow-hidden rounded-lg border border-[#3e4148] cursor-pointer">
              {c.attachmentUrl.match(/\.(mp4|webm|ogg)|cloudinary\.com.*video/) ? (
                <video src={c.attachmentUrl} className="w-full h-auto bg-[#14151a]" controls onClick={e => e.stopPropagation()} />
              ) : (
                <div onClick={() => onZoom(c.attachmentUrl!)}>
                  <img src={c.attachmentUrl} alt="Attachment" className="max-w-full max-h-40 object-contain w-full bg-[#14151a]" loading="lazy" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                     <button className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-md">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
                     </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {c.reactions && Object.keys(c.reactions).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Object.entries(c.reactions).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => onReactComment(c.id, emoji)}
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border transition-colors",
                    users.includes(currentUser?.id || '') 
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200' 
                      : 'bg-black/20 border-transparent text-slate-400 hover:bg-[#2e3138]'
                  )}
                >
                  <span>{emoji}</span>
                  <span className="font-semibold">{users.length}</span>
                </button>
              ))}
            </div>
          )}
          
          {!isEditing && (
            <div className="mt-3 relative text-xs text-slate-400 font-semibold flex items-center gap-4 opacity-80 hover:opacity-100 lg:opacity-0 lg:group-hover/comment:opacity-100 transition-opacity">
              <button 
                className="cursor-pointer hover:text-indigo-400 transition-colors flex items-center" 
                onClick={() => onSetEmojiPicker(showEmojiPicker === c.id ? null : c.id)}
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
              
              {showEmojiPicker === c.id && (
                <div className="absolute left-0 bottom-full mb-1 z-20 bg-[#2e3138] border border-[#3e4148] rounded-xl flex items-center p-1 shadow-lg">
                  {EMOJIS.map(emoji => (
                    <button 
                      key={emoji} 
                      onClick={() => { onReactComment(c.id, emoji); onSetEmojiPicker(null); }} 
                      className="w-8 h-8 rounded-lg hover:bg-slate-700 flex items-center justify-center text-lg transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {!isReply && (
                <span className="cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => onReply(c)}>Reply</span>
              )}

              {canDeleteForC && (
                <div className="flex items-center gap-2">
                  {(isAuthorOfC || isMyGuestCommentOfC) && (
                    <button className="cursor-pointer hover:text-indigo-400 transition-colors p-1" onClick={() => onSetEditing(c.id, c.content)}>
                      <Edit2 className="w-3 h-3" />
                    </button>
                  )}
                  
                  {deletingId === c.id ? (
                    <div className="flex items-center gap-2 bg-red-500/10 rounded-lg px-2 py-1 animate-in fade-in zoom-in-95 duration-200">
                      <span className="text-[10px] text-red-400 font-bold">Xoá?</span>
                      <button onClick={() => onDeleteComment(c.id)} className="text-red-500 font-bold hover:text-red-400 transition-colors">Vâng</button>
                      <button onClick={() => onSetDeleting(null)} className="text-slate-400 hover:text-white transition-colors">Không</button>
                    </div>
                  ) : (
                    <button className="cursor-pointer hover:text-red-500 transition-colors p-1" onClick={() => onSetDeleting(c.id)}>
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {renderCommentContent(comment)}
      {replies.map(reply => (
        <div key={reply.id} className="pl-6">
          {renderCommentContent(reply, true)}
        </div>
      ))}
    </div>
  );
});

CommentItem.displayName = 'CommentItem';

export default CommentItem;
