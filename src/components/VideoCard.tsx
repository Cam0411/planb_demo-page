import { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, Download, Trash2, User as UserIcon, Share2 } from 'lucide-react';
import { Video, User } from '../types';
import { cn } from '../lib/utils';

interface VideoCardProps {
  video: Video;
  index: number;
  currentUser: User | null;
  users: User[];
  onDelete: (video: Video) => void;
  onShare: (video: Video) => void;
}

const VideoCard = memo(({ video, index, currentUser, users, onDelete, onShare }: VideoCardProps) => {
  const videoEditors = useMemo(() => {
    if (!video.editorIds) return [];
    return video.editorIds.map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
  }, [video.editorIds, users]);

  const canDelete = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (video.ownerId === currentUser.id) return true;
    if (video.editorIds?.includes(currentUser.id) && currentUser.role === 'editor') return true;
    return false;
  }, [video.ownerId, video.editorIds, currentUser]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.04,
        type: "spring",
        stiffness: 100,
        damping: 15
      }}
      className="group relative"
    >
      <div className="absolute top-3 right-3 z-10 flex gap-2 opacity-0 translate-y-[-10px] group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto">
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onShare(video);
          }}
          className="p-2.5 bg-black/70 backdrop-blur-xl rounded-2xl shadow-2xl text-slate-300 hover:text-indigo-400 hover:bg-indigo-400/20 transition-all border border-white/10 ring-1 ring-white/5 active:scale-90"
          title="Chia sẻ video"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const link = document.createElement('a');
            link.href = video.driveUrl || video.youtubeUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="p-2.5 bg-black/70 backdrop-blur-xl rounded-2xl shadow-2xl text-slate-300 hover:text-indigo-400 hover:bg-indigo-400/20 transition-all border border-white/10 ring-1 ring-white/5 active:scale-90"
          title="Tải video"
        >
          <Download className="w-4 h-4" />
        </button>
        {canDelete && (
          <button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(video);
            }}
            className="p-2.5 bg-black/70 backdrop-blur-xl rounded-2xl shadow-2xl text-slate-300 hover:text-red-500 hover:bg-red-500/20 transition-all border border-white/10 ring-1 ring-white/5 active:scale-90"
            title="Xóa video"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <Link to={`/video/${video.id}`} className="group h-full bg-[#1c1e23] rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.4)] border border-[#2e3138] overflow-hidden hover:shadow-[0_20px_50px_rgba(79,70,229,0.15)] transition-all duration-500 hover:border-indigo-500/30 flex flex-col ring-1 ring-white/5">
         <div className="aspect-video bg-[#0e1015] relative overflow-hidden shrink-0">
            <img 
              src={video.thumbnail || undefined} 
              alt={video.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out opacity-70 group-hover:opacity-100" 
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1c1e23] via-transparent to-transparent opacity-80" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-white/5 backdrop-blur-2xl rounded-full flex items-center justify-center border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-500 transform scale-50 group-hover:scale-100 shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white border-b-[10px] border-b-transparent ml-1.5 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
              </div>
            </div>
         </div>
         
         <div className="p-6 flex-1 flex flex-col justify-between group-hover:bg-[#202229] transition-colors duration-500">
            <div>
              <h3 className="font-bold text-white text-base mb-3 line-clamp-2 leading-relaxed tracking-tight group-hover:text-indigo-400 transition-colors uppercase">{video.title}</h3>
              
              <div className="flex flex-wrap gap-2 mb-6">
                <div className="flex items-center text-slate-500 text-[10px] font-black uppercase tracking-widest bg-black/30 px-2.5 py-1.5 rounded-xl border border-white/5">
                  <Clock className="w-3 h-3 mr-2 text-indigo-500" /> 
                  {new Date(video.createdAt).toLocaleDateString('vi-VN')}
                </div>
                <div className={cn(
                  "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border",
                  video.status === 'Đã duyệt' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" :
                  video.status === 'Đang chờ duyệt' ? "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]" :
                  video.status === 'Đã hoàn thành' ? "bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]" :
                  video.status === 'Lịch feedback' ? "bg-purple-500/10 text-purple-500 border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]" :
                  "bg-slate-500/10 text-slate-400 border-slate-500/20"
                )}>
                  {video.status || 'Đang thực hiện'}
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-5 border-t border-white/5">
              {video.deadline && (
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em]">
                  <span className="text-slate-600">DEADLINE</span>
                  {(() => {
                    const daysLeft = Math.ceil((new Date(video.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                    if (daysLeft > 3) return <span className="text-emerald-500">CON {daysLeft} NGAY</span>;
                    if (daysLeft > 0) return <span className="text-amber-500">SAP HET HAN</span>;
                    if (daysLeft === 0) return <span className="text-red-500 font-black">HOM NAY</span>;
                    return <span className="text-pink-500 animate-pulse">QUÁ HẠN</span>;
                  })()}
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex -space-x-2 mr-3 pointer-events-none">
                    {videoEditors.length > 0 ? (
                      videoEditors.slice(0, 3).map((editor, i) => (
                        <div key={editor.id} className="w-7 h-7 rounded-full bg-[#14151a] border-2 border-[#1c1e23] flex items-center justify-center text-[8px] font-bold text-indigo-400 overflow-hidden shadow-lg" title={editor.name}>
                          {editor?.avatar ? <img src={editor.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-3 h-3" />}
                        </div>
                      ))
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-500/10 border-2 border-[#1c1e23] flex items-center justify-center text-slate-600">
                        <UserIcon className="w-3 h-3" />
                      </div>
                    )}
                    {videoEditors.length > 3 && (
                      <div className="w-7 h-7 rounded-full bg-[#2e3138] border-2 border-[#1c1e23] flex items-center justify-center text-[9px] font-black text-slate-400 shadow-lg">
                        +{videoEditors.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[100px]">
                    {videoEditors.length > 0 ? (videoEditors.length === 1 ? (videoEditors[0].name?.split(' ')[0] || 'ED') : `${videoEditors.length} EDS`) : 'NO ASSIGN'}
                  </span>
                </div>
                <div className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] group-hover:text-indigo-400 group-hover:translate-x-1 transition-all">
                  PROJECT →
                </div>
              </div>
            </div>
         </div>
      </Link>
    </motion.div>
  );
});

VideoCard.displayName = 'VideoCard';

export default VideoCard;
