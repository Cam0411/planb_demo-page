import { useState, useEffect, useRef } from 'react';
import { dbService } from '../services/db';
import { User, Comment } from '../types';
import { History, MessageSquare, PlayCircle, Paperclip, Send, Smile, AtSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatTime } from '../lib/utils';
import { upload } from '@imagekit/react';

interface CommentWithVideo extends Comment {
  videoTitle?: string;
}

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
    const key = await window.crypto.subtle.importKey(
      'raw', encoder.encode(privateKey), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    const signatureBuffer = await window.crypto.subtle.sign('HMAC', key, encoder.encode(str));
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return { token, expire, signature };
  } catch (error: any) {
    throw new Error(`Authentication generation failed: ${error.message}`);
  }
};

export default function CommentHistory() {
  const [comments, setComments] = useState<CommentWithVideo[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyAttachmentUrl, setReplyAttachmentUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let unsubscribe: () => void;

    async function loadData() {
      const u = await dbService.getCurrentUser();
      setCurrentUser(u);

      if (u) {
        const allVideos = await dbService.getVideos(u.id, u.role);
        const videoMap = new Map();
        allVideos.forEach(v => videoMap.set(v.id, v.title));

        unsubscribe = dbService.subscribeToAllComments((allComments) => {
          const userComments = allComments.map(c => ({
            ...c,
            videoTitle: videoMap.get(c.videoId)
          }));
          setComments(userComments);
          setIsLoading(false);
        });
      } else {
         setIsLoading(false);
      }
    }
    loadData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
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
      
      if (!response || !response.url) {
        throw new Error("Không nhận được URL từ server sau khi upload.");
      }
      
      setReplyAttachmentUrl(response.url);
    } catch (err: any) {
      console.error("Upload error details:", err);
      // More descriptive error for common JSON issue
      const msg = err.message || '';
      if (msg.includes('Unexpected token') || msg.includes('JSON')) {
        alert("Lỗi server: Phản hồi không đúng định dạng. Có thể do server chưa cấu hình đúng API upload.");
      } else {
        alert("Lỗi upload: " + (err.message || 'Unknown error'));
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReplySubmit = async (e: React.FormEvent, parentComment: CommentWithVideo) => {
    e.preventDefault();
    if (!currentUser || (!replyContent.trim() && !replyAttachmentUrl)) return;
    
    try {
      await dbService.addComment({
        videoId: parentComment.videoId,
        version: parentComment.version,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        content: replyContent,
        frameTime: undefined,
        attachmentUrl: replyAttachmentUrl || undefined,
        priority: 'Normal',
        category: 'General',
        parentId: parentComment.id
      });
      
      setReplyContent('');
      setReplyAttachmentUrl(null);
      setReplyingTo(null);
    } catch (error) {
       console.error("Failed to add reply", error);
    }
  };

  if (isLoading) {
    return <div className="p-4 sm:p-8 text-center text-slate-400">Đang tải...</div>;
  }

  if (!currentUser) {
    return (
      <div className="p-4 sm:p-8 text-center text-slate-400 flex-1 flex items-center justify-center bg-[#0e1015]">
        <div>
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-500" />
          <p>Vui lòng đăng nhập để xem lịch sử comment cá nhân.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 flex-1 overflow-y-auto bg-[#0e1015] custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <History className="text-indigo-400 w-5 h-5 sm:w-6 sm:h-6" />
            Lịch sử Comment
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">Danh sách tất cả các bình luận và phản hồi từ mọi người.</p>
        </div>

        <div className="bg-[#1c1e23] border border-[#2e3138] rounded-xl overflow-hidden shadow-sm">
          {comments.length > 0 ? (
            <div className="divide-y divide-[#2e3138]">
              {comments.map((comment) => (
                <div key={comment.id} className="p-4 hover:bg-[#24262d] transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-white text-sm flex items-center gap-2">
                      {comment.userAvatar ? (
                        <img src={comment.userAvatar} alt={comment.userName || 'User'} className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px]">
                          {(comment.userName || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      {comment.userName || 'Người dùng ẩn danh'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-start gap-3 mt-2">
                    <div className="mt-1 flex-shrink-0">
                       <MessageSquare className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {comment.frameTime !== undefined && comment.frameTime !== null && (
                          <Link 
                            to={`/video/${comment.videoId}?t=${comment.frameTime}`}
                            className="inline-block bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors hover:shadow-sm hover:shadow-indigo-500/20"
                          >
                            {formatTime(comment.frameTime)}
                          </Link>
                        )}
                        <Link to={`/video/${comment.videoId}`} className="text-xs text-indigo-400/80 hover:text-indigo-400 hover:underline flex items-center gap-1">
                          <PlayCircle className="w-3 h-3" />
                          {comment.videoTitle || 'Video Project'}
                        </Link>
                      </div>
                      <p className="text-slate-300 text-sm whitespace-pre-wrap">{renderTextWithMentions(comment.content)}</p>

                      {comment.attachmentUrl && (
                        <div className="mt-3 relative inline-block group/img overflow-hidden rounded-lg border border-[#3e4148] cursor-pointer" onClick={() => setZoomedImage(comment.attachmentUrl!)}>
                          <img src={comment.attachmentUrl} alt="Attachment" className="max-w-[300px] max-h-40 object-contain bg-[#14151a]" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                             <button className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 backdrop-blur-md">
                               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
                             </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 flex gap-4 text-xs font-semibold text-slate-500">
                        <button onClick={() => { setReplyingTo(comment.id); setReplyContent(''); setReplyAttachmentUrl(null); }} className="hover:text-indigo-400 transition-colors">Reply</button>
                      </div>

                      {replyingTo === comment.id && (
                        <div className="mt-4 bg-[#14151a] p-3 rounded-xl border border-[#2e3138]">
                          <form onSubmit={(e) => handleReplySubmit(e, comment)}>
                            <div className="flex gap-2">
                              {currentUser?.avatar ? (
                                <img src={currentUser.avatar} className="w-6 h-6 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] shrink-0 font-bold">
                                  {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                              )}
                              <div className="flex-1">
                                <input
                                  type="text"
                                  autoFocus
                                  value={replyContent}
                                  onChange={(e) => setReplyContent(e.target.value)}
                                  placeholder="Reply..."
                                  className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500 mb-2"
                                />
                                {replyAttachmentUrl && (
                                  <div className="mb-2 relative inline-block group">
                                     <img src={replyAttachmentUrl} className="h-16 rounded-lg border border-indigo-500/50 shadow-md" />
                                     <button type="button" onClick={() => setReplyAttachmentUrl(null)} className="absolute -top-2 -right-2 bg-slate-800 text-slate-300 hover:text-red-400 hover:bg-slate-700 rounded-full p-1 shadow-lg border border-[#3e4148] transition-colors"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                                  </div>
                                )}
                                <div className="flex justify-between items-center mt-1">
                                  <div className="flex items-center">
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-md transition-colors"><Paperclip className="w-3.5 h-3.5"/></button>
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
                                    {isUploading && (
                                      <span className="text-[10px] font-medium text-amber-500 ml-2 animate-pulse">Uploading...</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setReplyingTo(null)} className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded transition-colors">Cancel</button>
                                    <button type="submit" disabled={(!replyContent.trim() && !replyAttachmentUrl) || isUploading} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] px-3 py-1.5 rounded-md font-semibold transition-colors flex items-center gap-1.5">
                                      Reply <Send className="w-3 h-3"/>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 text-center text-slate-500 flex flex-col items-center">
              <History className="w-10 h-10 mb-3 opacity-20" />
              Chưa có bình luận nào trên hệ thống.
            </div>
          )}
        </div>
      </div>
      
      {/* Zoom Image Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImage(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-red-400 bg-white/10 p-2 rounded-full cursor-pointer" onClick={() => setZoomedImage(null)}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          <img src={zoomedImage} alt="Zoomed in" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
