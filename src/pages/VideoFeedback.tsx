import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { formatTime, parseTime, cn } from '../lib/utils';
import { dbService, isYoutubeShort } from '../services/db';
import { Video as VideoType, Comment, User, VideoEdits, TextOverlay, VideoVersion } from '../types';
import { Link as LinkIcon, Download, Brain, X, ChevronLeft, ChevronRight, Scissors, Type, Plus, Trash2, Save, History, RotateCcw, Share2, Check, MessageSquare, HardDrive, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VideoPlayer from '../components/VideoPlayer';
import RightPanel from '../components/RightPanel';
import LeftPanel from '../components/LeftPanel';
import LoginModal from '../components/LoginModal';
import ShareModal from '../components/ShareModal';
import { geminiService } from '../services/geminiService';
import Markdown from 'react-markdown';

export default function VideoFeedback({ sharedVideoId }: { sharedVideoId?: string }) {
  const { id: paramId } = useParams<{ id: string }>();
  const id = sharedVideoId || paramId;
  const [searchParams] = useSearchParams();
  const initialTimeParam = searchParams.get('t');
  const initialTime = initialTimeParam ? parseFloat(initialTimeParam) : undefined;
  
  const { user: currentUser, setUser, isSidebarCollapsed, setIsSidebarCollapsed } = useOutletContext<{ 
    user: User | null; 
    setUser: (u: User | null) => void;
    isSidebarCollapsed: boolean; 
    setIsSidebarCollapsed: (v: boolean) => void 
  }>();

  const [video, setVideo] = useState<VideoType | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVersion, setActiveVersion] = useState('Feedback 1');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [guestName, setGuestName] = useState<string>('');
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState<{content: string, frameTime: number | null, attachmentUrl: string | null, priority: string, category: string} | null>(null);
  const [showPostCommentLoginOffer, setShowPostCommentLoginOffer] = useState(false);
  const [sidebarElement, setSidebarElement] = useState<HTMLElement | null>(null);
  
  // Video Editing States
  const [isEditing, setIsEditing] = useState(false);
  const [edits, setEdits] = useState<VideoEdits>({ overlays: [] });
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [newVersionName, setNewVersionName] = useState('');
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const playerRef = useRef<any>(null);

  useEffect(() => {
    setIsSidebarCollapsed(false);
  }, []);

  useEffect(() => {
    setSidebarElement(document.getElementById('sidebar-content'));
    const savedName = localStorage.getItem('guestName');
    if (savedName) {
      setGuestName(savedName);
    }
  }, [currentUser, loading]);

  const handleSummarize = async () => {
    setIsSummarizing(true);
    setShowAiModal(true);
    const summary = await geminiService.summarizeFeedback(comments);
    setAiSummary(summary);
    setIsSummarizing(false);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.title = video ? video.title : 'Feedback | PlanB Production';
  }, [video]);

  useEffect(() => {
    console.log(`VideoFeedback: Fetching data for video ID: ${id}`);
    if (!id) return;
    
    // Fetch video details
    dbService.getVideoById(id).then(vid => {
      if (vid) {
        setVideo(vid);
        if (vid.edits) setEdits(vid.edits);
      }
      setLoading(false);
    });

    // Fetch users for branding/mentions
    dbService.getAllUsers().then(setAllUsers);

    // Subscribe to comments
    const unsubscribe = dbService.subscribeToCommentsForVideo(id, activeVersion, (fetchedComments) => {
      setComments(fetchedComments);
    });

    return () => {
      unsubscribe();
    };
  }, [id, activeVersion]);

  const onPlayerStateChange = useCallback((event: any) => {
    const state = event.data;
    if (state === 2) { // 2 = Paused
      const time = event.target.getCurrentTime();
      setCurrentTime(time);
    }
  }, []);

  const handlePause = () => {
    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      playerRef.current.pauseVideo();
    }
  };

  const handlePlay = () => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      playerRef.current.playVideo();
    }
  };

  const handleSeek = (timeInput: string | number) => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      const seconds = parseTime(timeInput);
      playerRef.current.seekTo(seconds);
      if (typeof playerRef.current.pauseVideo === 'function') {
        playerRef.current.pauseVideo();
      }
    }
  };

  const handleAddComment = useCallback(async (content: string, frameTime: number | null, attachmentUrl: string | null, parentId?: string) => {
    if (!video) return;
    console.log("handleAddComment: currentUser =", currentUser, "guestName =", guestName);

    let userId = currentUser?.id;
    let userName = currentUser?.name;
    let userAvatar = currentUser?.avatar;

    if (!currentUser) {
      if (!guestName) {
        setPendingFeedback({ content, frameTime, attachmentUrl, priority: 'Normal', category: 'Edit' });
        setShowGuestModal(true);
        return;
      }
      userId = 'guest';
      userName = guestName;
    }
    
    console.log("Adding comment for", userId, userName);
    try {
      const newComment = await dbService.addComment({
        videoId: video.id,
        userId: userId || 'guest',
        userName: userName || 'Guest',
        userAvatar: userAvatar || undefined,
        version: activeVersion,
        content,
        frameTime: frameTime !== null ? frameTime : undefined,
        attachmentUrl: attachmentUrl || undefined,
        parentId
      });
      console.log("Comment added successfully");
      
      if ((!currentUser || currentUser.id === 'guest') && newComment?.id) {
        try {
          const myCommentIds = JSON.parse(localStorage.getItem('myCommentIds') || '[]');
          myCommentIds.push(newComment.id);
          localStorage.setItem('myCommentIds', JSON.stringify(myCommentIds));
        } catch (storageErr) {
          console.error("Failed to store guest comment ID:", storageErr);
        }
      }
    } catch (err) {
      console.error("Error adding comment:", err);
      // alert replaced with a more silent failure or Toast (not implemented yet)
    }

    if (!currentUser) {
      setShowPostCommentLoginOffer(true);
      setTimeout(() => setShowPostCommentLoginOffer(false), 8000);
    }
  }, [video, currentUser, activeVersion, guestName]);

  const handleUpdateComment = useCallback(async (commentId: string, content: string) => {
    await dbService.updateComment(commentId, { content });
  }, []);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    try {
      await dbService.deleteComment(commentId);
    } catch (err: any) {
      console.error("Delete failed", err);
      // alert replaced with a more silent failure or Toast (not implemented yet)
    }
  }, []);

  const handleToggleCommentStatus = useCallback(async (commentId: string, resolved: boolean) => {
    try {
      await dbService.toggleCommentStatus(commentId, resolved);
    } catch (err: any) {
      console.error("Toggle comment status failed", err);
    }
  }, []);

  const handleReactComment = useCallback(async (commentId: string, emoji: string) => {
    if (!currentUser) return;
    const targetComment = comments.find(c => c.id === commentId);
    if (!targetComment) return;
    
    const reactions = targetComment.reactions || {};
    const users = reactions[emoji] || [];
    const hasReacted = users.includes(currentUser.id);
    
    let newUsers;
    if (hasReacted) {
      newUsers = users.filter(id => id !== currentUser.id);
    } else {
      newUsers = [...users, currentUser.id];
    }
    
    const newReactions = { ...reactions };
    if (newUsers.length > 0) {
      newReactions[emoji] = newUsers;
    } else {
      delete newReactions[emoji];
    }
    
    await dbService.updateComment(commentId, { reactions: newReactions });
  }, [currentUser, comments]);

  const handleSaveEdits = async () => {
    if (!video) return;
    try {
      await dbService.updateVideo(video.id, { edits });
      setVideo({ ...video, edits });
      setIsEditing(false);
      alert("Đã lưu các thay đổi video!");
    } catch (err) {
      alert("Không thể lưu thay đổi.");
    }
  };

  const handleSaveAsNewVersion = async () => {
    if (!video || !currentUser || !newVersionName) return;
    try {
      const newVersion: VideoVersion = {
        id: Math.random().toString(36).substr(2, 9),
        name: newVersionName,
        edits: JSON.parse(JSON.stringify(edits)),
        createdAt: Date.now(),
        createdBy: currentUser.name
      };
      
      const newVersions = [...(video.versions || []), newVersion];
      await dbService.updateVideo(video.id, { versions: newVersions });
      setVideo({ ...video, versions: newVersions });
      setNewVersionName('');
      alert(`Đã lưu phiên bản mới: ${newVersionName}`);
    } catch (err) {
      alert("Không thể lưu phiên bản mới.");
    }
  };

  const handleRevertToVersion = async (version: VideoVersion) => {
    if (!video) return;
    if (window.confirm(`Bạn có chắc muốn quay lại phiên bản "${version.name}"? Các thay đổi hiện tại chưa lưu sẽ bị mất.`)) {
      try {
        await dbService.updateVideo(video.id, { edits: version.edits });
        setVideo({ ...video, edits: version.edits });
        setEdits(version.edits);
        alert(`Đã quay lại phiên bản: ${version.name}`);
      } catch (err) {
        alert("Không thể quay lại phiên bản này.");
      }
    }
  };

  const addOverlay = () => {
    const newOverlay: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      text: "Văn bản mới",
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration),
      position: { x: 50, y: 50 },
      style: {
        fontSize: 24,
        color: '#ffffff',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }
    };
    setEdits(prev => ({
      ...prev,
      overlays: [...(prev.overlays || []), newOverlay]
    }));
    setSelectedOverlayId(newOverlay.id);
  };

  const updateOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setEdits(prev => ({
      ...prev,
      overlays: prev.overlays?.map(o => o.id === id ? { ...o, ...updates } : o)
    }));
  };

  const deleteOverlay = (id: string) => {
    setEdits(prev => ({
      ...prev,
      overlays: prev.overlays?.filter(o => o.id !== id)
    }));
    if (selectedOverlayId === id) setSelectedOverlayId(null);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
     return <div className="flex justify-center flex-col items-center h-screen bg-[#0e1015] text-white"><img src="https://ik.imagekit.io/39wvgoqre/B%20(1).png?updatedAt=1777439253123" alt="Loading" className="w-16 h-16 animate-pulse" /></div>;
  }

  if (!video) {
    return <div className="text-center text-red-500 py-12 bg-[#0e1015] h-screen">Không tìm thấy video.</div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#0e1015] overflow-hidden text-slate-300 relative">
      <header className="min-h-12 sm:min-h-14 bg-[#14151a] border-b border-[#2e3138] px-3 sm:px-4 py-1.5 sm:py-2 flex flex-row items-center justify-between shrink-0 gap-2 z-40 relative">
        <div className="flex items-center gap-2 sm:gap-3 truncate shrink-0">
          <Link to="/" className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full bg-slate-800 text-white font-bold hover:bg-slate-700 shrink-0">
            {currentUser?.name?.charAt(0) || guestName.charAt(0) || "G"}
          </Link>
          <div className="flex flex-col truncate max-w-[80px] xs:max-w-[120px] sm:max-w-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">{new Date(video.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black tracking-tighter uppercase hidden sm:block">Production</span>
            </div>
            <h1 className="text-[11px] sm:text-sm font-black text-white truncate leading-tight tracking-tight">{video.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {(video.driveUrl || video.youtubeUrl) && (
            <a 
               href={video.driveUrl || video.youtubeUrl}
               target="_blank"
               rel="noopener noreferrer"
               className="p-1 px-2 sm:px-3 sm:py-1.5 text-[9px] sm:text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded border border-indigo-500 flex items-center transition-all shadow-lg shadow-indigo-500/20"
               title={video.driveUrl ? "Google Drive" : "YouTube"}
            >
               {video.driveUrl ? <HardDrive className="w-3 h-3 sm:w-3.5 sm:h-3.5 sm:mr-1 shrink-0" /> : <LinkIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 sm:mr-1 shrink-0" />} 
               <span className="hidden sm:inline">{video.driveUrl ? "LINK TẢI VIDEO 4K - DRIVE" : "YouTube"}</span>
            </a>
          )}

          <button 
             onClick={() => setShowComments(!showComments)}
             className={`lg:hidden p-1 px-2 text-[9px] sm:text-xs font-bold rounded border flex items-center transition-all ${
               showComments ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'text-slate-300 bg-[#24262d] border-[#3e4148]'
             }`}
          >
             <MessageSquare className="w-3.5 h-3.5 sm:mr-1" />
             <span className="hidden xs:inline ml-1">Comments</span>
          </button>

          <button 
             onClick={() => setShowShareModal(true)}
             className="p-1 px-2 sm:px-3 sm:py-1.5 text-[9px] sm:text-xs font-bold text-indigo-400 bg-indigo-500/10 rounded border border-indigo-500/20 flex items-center hover:bg-indigo-500/20 transition-all"
             title="Share Video"
          >
             <Share2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 sm:mr-1 shrink-0" />
             <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Column - Portal Or Editing Panel */}
        {isEditing ? (
          <aside className="fixed inset-0 lg:relative lg:inset-auto z-50 lg:z-0 w-full lg:w-80 bg-[#14151a] border-r border-[#2e3138] flex flex-col overflow-hidden lg:animate-in lg:slide-in-from-left duration-300">
            <div className="p-4 border-b border-[#2e3138] flex items-center justify-between bg-[#1c1e23] lg:bg-transparent">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Scissors className="w-4 h-4 text-indigo-400" />
                Công cụ Edit
              </h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="lg:hidden text-slate-500 hover:text-white p-2"
                >
                  <X className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleSaveEdits}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-lg shadow-green-900/20"
                >
                  <Save className="w-3 h-3" /> Lưu
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Version History Section */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3 h-3" /> Quản lý phiên bản
                  </h3>
                  <button 
                    onClick={() => setShowVersionHistory(!showVersionHistory)}
                    className="p-1 px-2 text-[10px] bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
                  >
                    {showVersionHistory ? 'Đóng lịch sử' : 'Xem lịch sử'}
                  </button>
                </div>

                {showVersionHistory ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {video.versions?.length ? (
                      video.versions.slice().reverse().map(version => (
                        <div key={version.id} className="bg-[#0e1015] border border-[#2e3138] rounded-lg p-2.5 flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span className="text-white text-xs font-bold">{version.name}</span>
                              <span className="text-[10px] text-slate-500">{new Date(version.createdAt).toLocaleString()}</span>
                            </div>
                            <button 
                              onClick={() => handleRevertToVersion(version)}
                              className="text-indigo-400 hover:text-indigo-300 transition-colors"
                              title="Quay lại phiên bản này"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-600">Bởi: {version.createdBy}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-slate-600 text-[10px]">Chưa có phiên bản nào được lưu</div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input 
                      type="text"
                      className="w-full bg-[#0e1015] border border-[#2e3138] rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none"
                      placeholder="Tên phiên bản mới..."
                      value={newVersionName}
                      onChange={(e) => setNewVersionName(e.target.value)}
                    />
                    <button 
                      onClick={handleSaveAsNewVersion}
                      disabled={!newVersionName}
                      className="w-full bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600/20 disabled:opacity-50 disabled:hover:bg-indigo-600/10 border border-indigo-500/20 text-xs py-2 rounded-lg font-bold transition-all"
                    >
                      Lưu thành phiên bản mới
                    </button>
                  </div>
                )}
              </section>

              {/* Trim Section */}
              <section className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Scissors className="w-3 h-3" /> Trim Video
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 ml-1">Bắt đầu (s)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="w-full bg-[#0e1015] border border-[#2e3138] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                      value={edits.trimStart || 0}
                      onChange={(e) => setEdits(prev => ({ ...prev, trimStart: parseFloat(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 ml-1">Kết thúc (s)</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="w-full bg-[#0e1015] border border-[#2e3138] rounded-lg px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                      value={edits.trimEnd || duration}
                      onChange={(e) => setEdits(prev => ({ ...prev, trimEnd: parseFloat(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEdits(prev => ({ ...prev, trimStart: currentTime }))}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-[10px] py-1.5 rounded border border-slate-700 transition-colors"
                  >
                    Đặt ở v.trí hiện tại
                  </button>
                  <button 
                    onClick={() => setEdits(prev => ({ ...prev, trimEnd: currentTime }))}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-[10px] py-1.5 rounded border border-slate-700 transition-colors"
                  >
                    Đặt ở v.trí hiện tại
                  </button>
                </div>
              </section>

              {/* Overlays Section */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Type className="w-3 h-3" /> Text Overlays
                  </h3>
                  <button 
                    onClick={addOverlay}
                    className="p-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {edits.overlays?.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl text-slate-600 text-xs">
                      Chưa có text overlay nào
                    </div>
                  ) : (
                    edits.overlays?.map(overlay => (
                      <div 
                        key={overlay.id}
                        onClick={() => setSelectedOverlayId(overlay.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          selectedOverlayId === overlay.id ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-[#0e1015] border-[#2e3138] hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded">
                             {formatTime(overlay.startTime)} - {formatTime(overlay.endTime)}
                           </span>
                           <button 
                            onClick={(e) => { e.stopPropagation(); deleteOverlay(overlay.id); }}
                            className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        </div>
                        <p className="text-xs text-white truncate font-medium">{overlay.text || '(Chưa có nội dung)'}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Selected Overlay Settings */}
                {selectedOverlayId && edits.overlays?.find(o => o.id === selectedOverlayId) && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-4"
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 ml-1">Nội dung</label>
                      <textarea 
                        className="w-full bg-[#0e1015] border border-[#2e3138] rounded-lg px-3 py-2 text-white text-xs focus:border-indigo-500 outline-none min-h-[60px] resize-none"
                        value={edits.overlays.find(o => o.id === selectedOverlayId)?.text}
                        onChange={(e) => updateOverlay(selectedOverlayId, { text: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 ml-1">X (%)</label>
                        <input 
                          type="number"
                          className="w-full bg-[#0e1015] border border-[#2e3138] rounded-lg px-3 py-1.5 text-white text-xs"
                          value={edits.overlays.find(o => o.id === selectedOverlayId)?.position.x}
                          onChange={(e) => updateOverlay(selectedOverlayId, { position: { ...edits.overlays!.find(o => o.id === selectedOverlayId)!.position, x: parseFloat(e.target.value) } })}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 ml-1">Y (%)</label>
                        <input 
                          type="number"
                          className="w-full bg-[#0e1015] border border-[#2e3138] rounded-lg px-3 py-1.5 text-white text-xs"
                          value={edits.overlays.find(o => o.id === selectedOverlayId)?.position.y}
                          onChange={(e) => updateOverlay(selectedOverlayId, { position: { ...edits.overlays!.find(o => o.id === selectedOverlayId)!.position, y: parseFloat(e.target.value) } })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 ml-1">Cỡ chữ (px)</label>
                      <input 
                        type="number"
                        className="w-full bg-[#0e1015] border border-[#2e3138] rounded-lg px-3 py-1.5 text-white text-xs"
                        value={edits.overlays.find(o => o.id === selectedOverlayId)?.style?.fontSize}
                        onChange={(e) => updateOverlay(selectedOverlayId, { style: { ...edits.overlays!.find(o => o.id === selectedOverlayId)!.style, fontSize: parseInt(e.target.value) } })}
                      />
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => updateOverlay(selectedOverlayId, { startTime: currentTime })}
                        className="flex-1 bg-slate-800 text-[10px] py-1 rounded"
                       >
                         Bắt đầu tại đây
                       </button>
                       <button 
                         onClick={() => updateOverlay(selectedOverlayId, { endTime: currentTime })}
                         className="flex-1 bg-slate-800 text-[10px] py-1 rounded"
                       >
                         Kết thúc tại đây
                       </button>
                    </div>
                  </motion.div>
                )}
              </section>
            </div>
          </aside>
        ) : (
          sidebarElement && createPortal(
            <LeftPanel 
              video={video} 
              currentUser={currentUser}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed(false)}
              onUpdateVideo={async (data) => {
                const updated = { ...video, ...data } as VideoType;
                setVideo(updated);
                await dbService.updateVideo(video.id, data);
              }}
            />, 
            sidebarElement
          )
        )}

        {/* Center Column - Video */}
        <div className="w-full lg:flex-1 flex flex-col relative bg-[#0e1015] h-full overflow-y-auto lg:overflow-hidden shrink-0 custom-scrollbar">
          <div className="flex-1 flex items-start lg:items-center justify-center p-0 xs:p-2 sm:p-4 md:p-6 lg:p-8">
            <div className={cn(
              "lg:shadow-2xl rounded-none sm:rounded-xl md:rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative group bg-black shrink-0",
              isYoutubeShort(video.youtubeUrl || video.driveUrl) 
                ? "h-[70vh] sm:h-[80vh] aspect-[9/16]" 
                : "w-full max-w-6xl aspect-video"
            )}>
              <VideoPlayer 
                ref={playerRef} 
                url={video.youtubeUrl || video.driveUrl} 
                initialTime={initialTime}
                onStateChange={onPlayerStateChange}
                onDuration={setDuration}
                edits={edits}
                isEditing={isEditing}
              />
            </div>
          </div>
          
          {/* Mobile Editing Toggle Button */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'editor' || video.ownerId === currentUser?.id) && (
            <div className="lg:hidden flex justify-center p-4 border-t border-[#2e3138] bg-[#14151a]/50">
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-lg",
                  isEditing ? "bg-indigo-600 text-white shadow-indigo-500/20" : "bg-[#24262d] text-slate-300 hover:bg-[#2c2f38] border border-[#3e4148]"
                )}
              >
                {isEditing ? <><X className="w-4 h-4" /> Stop Editing</> : <><Scissors className="w-4 h-4" /> Edit Video</>}
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Comments Panel */}
        <div className={cn(
          "w-full lg:w-80 xl:w-96 flex flex-col bg-[#1c1e23] border-t lg:border-t-0 lg:border-l border-[#2e3138] transition-all duration-300 ease-in-out h-full overflow-hidden shrink-0",
          showComments ? "fixed inset-0 z-50 translate-y-0" : "hidden lg:flex"
        )}>
          {!isEditing && (
            <RightPanel 
              video={video}
              comments={comments} 
              currentUser={currentUser}
              guestName={guestName}
              allUsers={allUsers}
              currentTime={currentTime}
              onSeek={handleSeek}
              onPause={handlePause}
              onPlay={handlePlay}
              onAddComment={handleAddComment}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              onReactComment={handleReactComment}
              onToggleCommentStatus={handleToggleCommentStatus}
              onCloseOnMobile={() => setShowComments(false)}
            />
          )}
        </div>
      </div>

      {/* AI Summary Modal */}
      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-amber-100"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shadow-inner">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">AI Feedback Summary</h2>
                    <p className="text-[10px] uppercase tracking-widest text-amber-600 font-bold">Powered by Gemini 2.0 Flash</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto bg-white prose prose-slate prose-sm max-w-none prose-headings:text-slate-800 prose-headings:font-bold prose-p:text-slate-600 prose-li:text-slate-600">
                {isSummarizing ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-4">
                     <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div>
                     <p className="text-sm font-bold text-slate-500 animate-pulse uppercase tracking-wider">AI đang đọc toàn bộ feedback từ Firebase...</p>
                  </div>
                ) : (
                  <div className="markdown-body">
                    <Markdown>{aiSummary || "Không có dữ liệu tóm tắt."}</Markdown>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button 
                  onClick={() => setShowAiModal(false)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Đóng
                </button>
                <button 
                  disabled={isSummarizing}
                  onClick={handleSummarize}
                  className="px-6 py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-lg active:scale-95 disabled:opacity-50"
                >
                  Tạo lại
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGuestModal && (
          <LoginModal 
            onLogin={(user) => {
              if (user.id === 'guest') {
                setGuestName(user.name);
                localStorage.setItem('guestName', user.name);
                setUser({ id: 'guest', name: user.name, role: 'viewer' } as User);
              } else {
                setUser(user);
              }
              setShowGuestModal(false);
              if (pendingFeedback) {
                handleAddComment(pendingFeedback.content, pendingFeedback.frameTime, pendingFeedback.attachmentUrl);
                setPendingFeedback(null);
              }
            }} 
            initialMode="choice"
          />
        )}
      </AnimatePresence>

      {id && video && (
        <ShareModal 
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          videoId={id}
          videoTitle={video.title}
        />
      )}

      {/* Guest Login Offer Toast */}
      <AnimatePresence>
        {showPostCommentLoginOffer && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm"
          >
            <div className="bg-[#1c1e23] border border-indigo-500/30 rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Comment Posted as Guest!</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Feedback saved successfully</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setShowPostCommentLoginOffer(false);
                    setShowGuestModal(true);
                  }}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all"
                >
                  Log In / Sign Up
                </button>
                <button 
                  onClick={() => setShowPostCommentLoginOffer(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
                >
                  Later
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
