import { useEffect, useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Video, User } from '../types';
import { dbService, isYoutubeShort } from '../services/db';
import { PlayCircle, Clock, CheckCircle2, Plus, X, AlertTriangle, Search, Share2, Upload, Youtube, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import VideoCard from '../components/VideoCard';
import ShareModal from '../components/ShareModal';

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<Video | null>(null);
  const [videoToShare, setVideoToShare] = useState<Video | null>(null);
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newDriveUrl, setNewDriveUrl] = useState('');
  const [newEditorIds, setNewEditorIds] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editorFilter, setEditorFilter] = useState('All');
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const outletContext = useOutletContext<{ user: User | null }>();

  useEffect(() => {
    setCurrentUser(outletContext.user);
    if (outletContext.user) {
      dbService.getAllUsers().then(setUsers);
    }
  }, [outletContext.user]);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = dbService.subscribeToVideos((videoData, err) => {
      if (err) {
        setError(err.message || 'Lỗi khi tải dữ liệu từ Firebase.');
      } else {
        setVideos(videoData);
      }
      setLoading(false);
    }, currentUser);

    return () => unsubscribe();
  }, [currentUser]);

  const handleVideoCardDelete = useCallback((video: Video) => {
    setVideoToDelete(video);
  }, []);

  const handleVideoCardShare = useCallback((video: Video) => {
    setVideoToShare(video);
  }, []);

  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      const matchesSearch = (v.title || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || v.status === statusFilter;
      const matchesEditor = editorFilter === 'All' || (v.editorIds && v.editorIds.includes(editorFilter));
      return matchesSearch && matchesStatus && matchesEditor;
    });
  }, [videos, searchTerm, statusFilter, editorFilter]);

  const stats = useMemo(() => [
    { label: 'Tổng Video', value: videos.length, icon: PlayCircle, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Cần Duyệt', value: videos.filter(v => v.status !== 'Đã duyệt' && v.status !== 'Đã hoàn thành').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Hoàn Thành', value: videos.filter(v => v.status === 'Đã duyệt' || v.status === 'Đã hoàn thành').length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ], [videos]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    setUploadProgress(10);
    
    try {
      // 1. Get signature from our server
      const sigResponse = await fetch('/api/cloudinary-signature');
      if (!sigResponse.ok) throw new Error('Failed to get upload signature');
      const { signature, timestamp, cloud_name, api_key } = await sigResponse.json();
      
      setUploadProgress(30);

      // 2. Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', file);
      formData.append('signature', signature);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', api_key);
      formData.append('folder', 'video_feedback_comments'); // Matching server.ts config

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/video/upload`);
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 60) + 30;
          setUploadProgress(percent);
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          setNewDriveUrl(data.secure_url);
          setUploadProgress(100);
          setTimeout(() => setIsUploadingFile(false), 1000);
        } else {
          setIsUploadingFile(false);
          alert('Upload failed: ' + xhr.responseText);
        }
      };

      xhr.onerror = () => {
        setIsUploadingFile(false);
        alert('Upload failed due to a network error');
      };

      xhr.send(formData);
    } catch (err: any) {
      console.error('File upload error:', err);
      setIsUploadingFile(false);
      alert('File upload failed: ' + err.message);
    }
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoTitle.trim() || !newVideoUrl.trim()) return;

    setIsSubmitting(true);
    try {
      let finalUrl = newVideoUrl.trim();
      
      // If user pasted an iframe, extract the src
      if (finalUrl.includes('<iframe')) {
        const srcMatch = finalUrl.match(/src="([^"]+)"/);
        if (srcMatch) {
          finalUrl = srcMatch[1];
        }
      }

      await dbService.addVideo({
        title: newVideoTitle,
        youtubeUrl: finalUrl,
        driveUrl: newDriveUrl.trim(),
        thumbnail: '', 
        editorIds: newEditorIds
      }, currentUser?.id || 'unknown');

      setNewVideoTitle('');
      setNewVideoUrl('');
      setNewDriveUrl('');
      setNewEditorIds([]);
      setShowAddForm(false);
    } catch (err: any) {
      alert("Không thể thêm video: " + (err.message || "Lỗi quyền truy cập."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoToDelete) return;

    setIsDeleting(true);
    try {
      await dbService.deleteVideo(videoToDelete.id);
      setVideoToDelete(null);
    } catch (err: any) {
      alert("Lỗi khi xóa: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0e1015]">
        <img src="https://ik.imagekit.io/39wvgoqre/B%20(1).png" alt="Loading" className="w-16 h-16 animate-pulse mb-4" />
        <p className="text-slate-400 font-medium animate-pulse">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0e1015] p-8">
        <div className="bg-red-500/10 text-red-500 p-8 rounded-3xl max-w-md text-center border border-red-500/20 shadow-2xl">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-80" />
          <h2 className="text-2xl font-black mb-3 text-white">Lỗi kết nối</h2>
          <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg active:scale-95"
          >
            Thử lại ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0e1015] text-slate-300">
      <header className="min-h-16 lg:min-h-20 bg-[#14151a]/80 backdrop-blur-xl border-b border-[#2e3138] px-4 lg:px-10 py-3 sm:py-4 flex flex-row items-center justify-between shadow-2xl sticky top-16 lg:top-0 z-30 gap-3 sm:gap-4 overflow-hidden">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0 shrink-0">
          <div className="w-8 h-8 sm:w-12 sm:h-12 bg-indigo-600 rounded-lg sm:rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20 shrink-0 group-hover:rotate-12 transition-transform">
            <PlayCircle className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg sm:text-3xl font-black text-white tracking-tighter uppercase italic leading-none">Video Feedback</h1>
            <span className="text-[8px] sm:text-[10px] text-indigo-400 font-bold uppercase tracking-[0.3em] mt-1 opacity-70">Production Pipeline</span>
          </div>
        </div>
        {(currentUser?.role === 'admin' || currentUser?.role === 'editor') && (
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center justify-center gap-2 sm:gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-8 py-2 sm:py-3.5 rounded-xl sm:rounded-2xl font-black transition-all shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 text-[10px] sm:text-sm tracking-widest shrink-0"
          >
            <Plus className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">THÊM VIDEO</span>
            <span className="xs:hidden">TỔNG</span>
          </button>
        )}
      </header>
      
      <div className="flex-1 p-6 lg:p-10 overflow-y-auto space-y-10 custom-scrollbar">
        {/* Stats Row */}
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-8">
          {stats.map((stat, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className={cn(
                "bg-[#1c1e23] p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-[#2e3138] shadow-[0_8px_30px_rgb(0,0,0,0.4)] flex flex-col items-start gap-4 sm:gap-6 hover:border-indigo-500/30 transition-all duration-500 group relative overflow-hidden",
                idx === 2 && "xs:col-span-2 sm:col-span-1"
              )}
            >
              <div className={`absolute -right-6 -bottom-6 w-32 h-32 ${stat.bg} rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-700`} />
              <div className={`w-10 h-10 sm:w-14 sm:h-14 ${stat.bg} ${stat.color} rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 border border-white/5`}>
                <stat.icon className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0">
                <div className="text-slate-500 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] mb-1 sm:mb-2">{stat.label}</div>
                <div className="text-2xl sm:text-4xl font-black text-white tracking-widest italic">{stat.value}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters Row */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 bg-[#14151a]/50 p-6 rounded-3xl border border-[#2e3138]">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white tracking-tight uppercase">
              Projects List
            </h2>
            <p className="text-slate-500 text-sm font-medium italic">Manage and review your video projects.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative w-full sm:w-72 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search projects..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-[#0e1015] border border-[#2e3138] text-white rounded-xl py-3 pl-11 pr-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner placeholder:text-slate-600 font-medium"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select 
                className="flex-1 sm:flex-none bg-[#0e1015] border border-[#2e3138] text-white rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer font-bold appearance-none shadow-inner"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="All">Tất cả trạng thái</option>
                <option value="Đang thực hiện">Đang thực hiện</option>
                <option value="Đang chờ duyệt">Đang chờ duyệt</option>
                <option value="Đã duyệt">Đã duyệt</option>
                <option value="Đã hoàn thành">Đã hoàn thành</option>
                <option value="Lịch feedback">Lịch feedback</option>
              </select>
              
              <select 
                className="flex-1 sm:flex-none bg-[#0e1015] border border-[#2e3138] text-white rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all cursor-pointer font-bold appearance-none shadow-inner"
                value={editorFilter}
                onChange={e => setEditorFilter(e.target.value)}
              >
                <option value="All">All Editors</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </div>

            {(searchTerm || statusFilter !== 'All' || editorFilter !== 'All') && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('All');
                  setEditorFilter('All');
                }}
                className="text-xs font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest px-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Forms Container */}
        <AnimatePresence mode="wait">
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-[#1c1e23] border-2 border-indigo-500/20 rounded-[2.5rem] p-8 lg:p-12 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
              
              <button 
                onClick={() => setShowAddForm(false)}
                className="absolute top-8 right-8 text-slate-500 hover:text-white p-2.5 hover:bg-white/5 rounded-full transition-all border border-white/5"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-4 mb-10">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/40">
                  <Plus className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Create New Project</h3>
                  <p className="text-slate-500 text-sm font-medium">Add a video link to start the collaboration.</p>
                </div>
              </div>
              
              <form onSubmit={handleAddVideo} className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Video Title</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Summer Campaign Final Cut" 
                    className="w-full bg-[#0e1015] border border-[#2e3138] text-white rounded-2xl p-4.5 focus:ring-2 focus:ring-indigo-500 hover:border-slate-600 outline-none transition-all placeholder:text-slate-700 font-bold"
                    value={newVideoTitle}
                    onChange={e => setNewVideoTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                    <Youtube className="w-3 h-3 text-red-500" />
                    YouTube URL (Required)
                  </label>
                  <div className="relative group">
                    <input 
                      type="url" 
                      required
                      placeholder="YouTube link (shorts or long)..." 
                      className="w-full bg-[#0e1015] border border-[#2e3138] text-white rounded-2xl p-4.5 focus:ring-2 focus:ring-indigo-500 hover:border-slate-600 outline-none transition-all placeholder:text-slate-700 font-bold pr-12"
                      value={newVideoUrl}
                      onChange={e => setNewVideoUrl(e.target.value)}
                    />
                    {isYoutubeShort(newVideoUrl) && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="bg-indigo-500/20 text-indigo-400 text-[8px] font-black px-2 py-1 rounded-full border border-indigo-500/30">SHORTS</div>
                      </div>
                    )}
                  </div>
                  {newVideoUrl && !newVideoUrl.startsWith('https://') && (
                    <p className="text-[10px] text-amber-500 font-bold ml-1 italic">Vui lòng nhập link YouTube hợp lệ</p>
                  )}
                </div>
                <div className="space-y-3 relative">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <HardDrive className="w-3 h-3 text-blue-500" />
                      Google Drive or Video File URL
                    </span>
                    <span className="text-slate-600">(Optional)</span>
                  </label>
                  <div className="relative group">
                     <input 
                      type="url" 
                      placeholder="https://drive.google.com/..." 
                      className={cn(
                        "w-full bg-[#0e1015] border border-[#2e3138] text-white rounded-2xl p-4.5 focus:ring-2 focus:ring-indigo-500 hover:border-slate-600 outline-none transition-all placeholder:text-slate-700 font-bold pr-14",
                        isUploadingFile && "opacity-50"
                      )}
                      value={newDriveUrl}
                      onChange={e => setNewDriveUrl(e.target.value)}
                      disabled={isUploadingFile}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <label className={cn(
                        "p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-center",
                        isUploadingFile ? "bg-amber-500/20 text-amber-500" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                      )}>
                        {isUploadingFile ? (
                          <div className="w-4 h-4 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <input type="file" className="hidden" accept="video/*" onChange={handleFileUpload} disabled={isUploadingFile} />
                      </label>
                    </div>
                  </div>
                  
                  {isUploadingFile && (
                    <div className="mt-2 space-y-1.5">
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-indigo-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest text-right">Uploading: {uploadProgress}%</p>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Assign Editors</label>
                  <div className="flex flex-wrap gap-2 mb-2 min-h-[40px]">
                    {newEditorIds.length > 0 ? (
                      newEditorIds.map(id => {
                        const user = users.find(u => u.id === id);
                        return (
                          <div key={id} className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2">
                            {user?.name}
                            <button 
                              type="button" 
                              onClick={() => setNewEditorIds(prev => prev.filter(eid => eid !== id))}
                              className="hover:text-white transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-slate-600 text-xs italic py-2 ml-1">No editors assigned yet.</div>
                    )}
                  </div>
                  <select 
                    className="w-full bg-[#0e1015] border border-[#2e3138] text-white rounded-2xl p-4.5 focus:ring-2 focus:ring-indigo-500 hover:border-slate-600 outline-none transition-all placeholder:text-slate-700 font-bold appearance-none"
                    value=""
                    onChange={e => {
                      const val = e.target.value;
                      if (val && !newEditorIds.includes(val)) {
                        setNewEditorIds(prev => [...prev, val]);
                      }
                    }}
                  >
                    <option value="">Select an Editor to add</option>
                    {users.filter(u => u.id !== currentUser?.id && !newEditorIds.includes(u.id)).map(user => (
                      <option key={user.id} value={user.id}>{user.name} ({user.email || 'No email'})</option>
                    ))}
                  </select>
                </div>
                
                <div className="md:col-start-2 flex justify-end gap-4 mt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowAddForm(false)}
                    className="px-10 py-4 text-sm font-black text-slate-400 hover:text-white transition-colors uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-500/30 disabled:opacity-50 flex items-center gap-3 uppercase tracking-widest text-xs"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : 'Create Project'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {videoToDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-[#1c1e23] rounded-[2rem] p-8 lg:p-10 max-w-md w-full shadow-2xl border border-[#2e3138]"
              >
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center border border-red-500/20 shadow-inner">
                    <AlertTriangle className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">Delete Project?</h3>
                    <p className="text-slate-400 text-sm font-medium leading-relaxed">
                       Are you sure you want to delete <span className="font-bold text-white">"{videoToDelete.title}"</span>? This will permanently erase all associated feedback and data.
                    </p>
                  </div>
                  <div className="flex w-full gap-4 pt-2">
                    <button 
                       disabled={isDeleting}
                       onClick={() => setVideoToDelete(null)}
                       className="flex-1 py-4 bg-[#2e3138] text-white font-black rounded-2xl hover:bg-slate-700 transition-all disabled:opacity-50 uppercase tracking-widest text-xs"
                    >
                      No, Keep it
                    </button>
                    <button 
                       disabled={isDeleting}
                       onClick={handleDeleteVideo}
                       className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                    >
                      {isDeleting ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : 'Delete Project'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8 pb-10">
          {filteredVideos.map((video, index) => (
            <VideoCard 
              key={video.id} 
              video={video} 
              index={index} 
              currentUser={currentUser}
              users={users}
              onDelete={handleVideoCardDelete}
              onShare={handleVideoCardShare}
            />
          ))}
          
          {filteredVideos.length === 0 && !loading && (
            <div className="col-span-full flex flex-col items-center justify-center py-24 bg-[#14151a]/50 rounded-[3rem] border-2 border-[#2e3138] border-dashed">
              <div className="w-20 h-20 bg-[#1c1e23] rounded-3xl flex items-center justify-center mb-6 shadow-xl border border-white/5">
                <PlayCircle className="w-10 h-10 text-slate-600" />
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">No Projects Found</h3>
              <p className="text-slate-500 text-sm mt-1 max-w-xs text-center font-medium">
                Try adjusting your search or filters, or create a brand new project.
              </p>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('All');
                  setEditorFilter('All');
                }}
                className="mt-8 text-indigo-400 font-black text-xs uppercase tracking-widest hover:text-indigo-300 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <ShareModal 
        isOpen={!!videoToShare}
        onClose={() => setVideoToShare(null)}
        videoId={videoToShare?.id || ''}
        videoTitle={videoToShare?.title || ''}
      />
    </div>
  );
}
