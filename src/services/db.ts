import { Comment, User, Video, Notification, UserRole, SharedLink } from '../types';
import { db, auth } from '../firebase';
import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, limit, Timestamp, or } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getYoutubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function isYoutubeShort(url: string): boolean {
  if (!url) return false;
  return url.includes('youtube.com/shorts/') || url.includes('/shorts/');
}

function getYoutubeThumbnail(url: string): string {
  const vId = getYoutubeId(url);
  if (!vId) return '';
  return `https://img.youtube.com/vi/${vId}/maxresdefault.jpg`;
}

export function getYoutubeEmbedUrl(url: string): string {
  const id = getYoutubeId(url);
  if (!id) return url;
  return `https://www.youtube.com/embed/${id}?enablejsapi=1&rel=0&showinfo=0`;
}

const ADMIN_EMAILS = [
  'duongnguyencam00@gmail.com', 
  'hungbato19@gmail.com', 
  'hungbato01@gmail.com',
  'ducna224@gmail.com',
  'ducna225@gmail.com'
];

export const ADMIN_BRANDING = {
  name: 'PlanB Production',
  avatar: 'https://ik.imagekit.io/39wvgoqre/B%20(1).png?updatedAt=1777439253123'
};

export const brandUser = (user: User): User => {
  if (user.role === 'admin') {
    return {
      ...user,
      name: ADMIN_BRANDING.name,
      avatar: ADMIN_BRANDING.avatar
    };
  }
  return user;
};

async function getUserRole(userId: string, email?: string): Promise<UserRole> {
  const lowerEmail = email?.toLowerCase();
  
  // 1. Check hardcoded admin emails
  if (!!lowerEmail && ADMIN_EMAILS.some(e => e.toLowerCase() === lowerEmail)) {
    return 'admin';
  }
  
  try {
    // 2. Check users collection
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists() && userDoc.data().role) {
      return userDoc.data().role as UserRole;
    }
  } catch (e) {
    console.error('Error fetching user role:', e);
  }
  
  return 'guest';
}

export const dbService = {
  getVideos: async (userId?: string, role?: UserRole): Promise<Video[]> => {
    try {
      let q;
      const isAdminUser = role === 'admin' || (auth.currentUser?.email && ADMIN_EMAILS.some(e => e.toLowerCase() === auth.currentUser?.email?.toLowerCase()));

      if (isAdminUser) {
        q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
      } else if (userId && userId !== 'guest' && auth.currentUser) {
        q = query(
          collection(db, 'videos'),
          or(
            where('ownerId', '==', userId),
            where('editorIds', 'array-contains', userId)
          ),
          orderBy('createdAt', 'desc')
        );
      } else {
        // Guests can't list videos usually, return empty array
        return [];
      }
      
      const snapshot = await getDocs(q);
      const videos: Video[] = [];
      snapshot.forEach(doc => {
        videos.push({ ...doc.data() as any, id: doc.id } as Video);
      });
      return videos;
    } catch (e: any) {
      console.error('Firestore getVideos Error:', e);
      // Fallback if index missing or complex query fails
      if (userId && role !== 'admin') {
        try {
          const q1 = query(collection(db, 'videos'), where('ownerId', '==', userId));
          const q2 = query(collection(db, 'videos'), where('editorIds', 'array-contains', userId));
          const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
          const videoMap = new Map<string, Video>();
          s1.forEach(doc => videoMap.set(doc.id, { ...doc.data() as any, id: doc.id } as Video));
          s2.forEach(doc => videoMap.set(doc.id, { ...doc.data() as any, id: doc.id } as Video));
          return Array.from(videoMap.values()).sort((a, b) => b.createdAt - a.createdAt);
        } catch (fallbackError: any) {
          console.error('getVideos Fallback failed:', fallbackError);
          return [];
        }
      }
      return [];
    }
  },
  
  subscribeToVideos: (callback: (videos: Video[], error?: Error) => void, currentUser: User | null): (() => void) => {
    if (!currentUser || !auth.currentUser) {
      callback([]);
      return () => {};
    }

    let q;
    if (currentUser.role === 'admin') {
      q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
    } else {
      q = query(
        collection(db, 'videos'),
        or(
          where('ownerId', '==', currentUser.id),
          where('editorIds', 'array-contains', currentUser.id)
        ),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videos: Video[] = [];
      snapshot.forEach(doc => {
        videos.push({ ...doc.data(), id: doc.id } as Video);
      });
      callback(videos.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => {
      console.error('Firestore subscribeToVideos Error:', error);
      // Fallback if index error or permissions error for non-admin
      if (error.message?.includes('index') && currentUser.role !== 'admin') {
         const q1 = query(collection(db, 'videos'), where('ownerId', '==', currentUser.id));
         const q2 = query(collection(db, 'videos'), where('editorIds', 'array-contains', currentUser.id));
         const results = new Map<string, Video>();
         onSnapshot(q1, (s1) => {
           s1.forEach(doc => results.set(doc.id, { ...doc.data(), id: doc.id } as Video));
           callback(Array.from(results.values()).sort((a, b) => b.createdAt - a.createdAt));
         });
         onSnapshot(q2, (s2) => {
           s2.forEach(doc => results.set(doc.id, { ...doc.data(), id: doc.id } as Video));
           callback(Array.from(results.values()).sort((a, b) => b.createdAt - a.createdAt));
         });
      } else {
        callback([], error);
      }
    });
    return unsubscribe;
  },
  
  getVideoById: async (id: string): Promise<Video | undefined> => {
    try {
      const docRef = doc(db, 'videos', id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return { ...snapshot.data(), id: snapshot.id } as Video;
      }
      return undefined;
    } catch (e) {
      console.error('Firestore getVideoById Error:', e);
      return undefined;
    }
  },

  addVideo: async (video: Omit<Video, 'id' | 'createdAt' | 'ownerId' | 'status' | 'deadline' | 'timeline'>, ownerId: string): Promise<Video> => {
    try {
      const videoData = {
        ...video,
        createdAt: Date.now(),
        ownerId,
        status: 'Đang thực hiện' as const,
        deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // +7 days
        timeline: [
          { id: '1', title: 'Start Project', date: Date.now(), status: 'Done' as const },
          { id: '2', title: 'First Draft', date: Date.now() + 3 * 24 * 60 * 60 * 1000, status: 'Upcoming' as const },
          { id: '3', title: 'Final Delivery', date: Date.now() + 7 * 24 * 60 * 60 * 1000, status: 'Upcoming' as const },
        ],
        thumbnail: video.thumbnail || getYoutubeThumbnail(video.youtubeUrl)
      };

      // Remove undefined values to avoid Firestore errors
      Object.keys(videoData).forEach(key => {
        if ((videoData as any)[key] === undefined) {
          delete (videoData as any)[key];
        }
      });

      const docRef = await addDoc(collection(db, 'videos'), videoData);
      return { ...videoData, id: docRef.id } as Video;
    } catch (e) {
      console.error('Firestore addVideo Error:', e);
      throw e;
    }
  },

  deleteVideo: async (videoId: string): Promise<void> => {
    const path = `videos/${videoId}`;
    try {
      await deleteDoc(doc(db, 'videos', videoId));
      // Also delete related comments
      const q = query(collection(db, 'comments'), where('videoId', '==', videoId));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  updateVideo: async (videoId: string, updates: Partial<Video>): Promise<void> => {
    try {
      const oldVideo = await dbService.getVideoById(videoId);
      
      // Sanitize updates
      const sanitizedUpdates = { ...updates };
      Object.keys(sanitizedUpdates).forEach(key => {
        if ((sanitizedUpdates as any)[key] === undefined) {
          delete (sanitizedUpdates as any)[key];
        }
      });

      await updateDoc(doc(db, 'videos', videoId), sanitizedUpdates);
      
      if (updates.status && oldVideo && updates.status !== oldVideo.status) {
        await dbService.notifyInvolvedUsers(videoId, {
          type: 'status',
          title: 'Cập nhật trạng thái',
          message: `Video "${oldVideo.title}" đã chuyển sang trạng thái: ${updates.status}`,
          triggerUserId: auth.currentUser?.uid
        });
      }

      if (updates.editorIds && oldVideo) {
        const oldEditorIds = oldVideo.editorIds || [];
        const newEditors = updates.editorIds.filter(id => !oldEditorIds.includes(id));
        
        const promises = newEditors.map(editorId => 
          dbService.addNotification({
            userId: editorId,
            type: 'status',
            title: 'Dự án mới được chỉ định',
            message: `Bạn đã được chỉ định làm editor cho video: "${oldVideo.title}"`,
            videoId: videoId,
            triggerUserId: auth.currentUser?.uid
          })
        );
        await Promise.all(promises);
      }
    } catch (e) {
      console.error('Firestore updateVideo Error:', e);
      throw e;
    }
  },

  getAllComments: async (): Promise<Comment[]> => {
    try {
      const q = query(collection(db, 'comments'));
      const snapshot = await getDocs(q);
      const comments: Comment[] = [];
      snapshot.forEach(doc => {
        comments.push({ ...doc.data(), id: doc.id } as Comment);
      });
      return comments.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      console.error('Firestore getAllComments Error:', e);
      return [];
    }
  },

  subscribeToAllComments: (callback: (comments: Comment[]) => void) => {
    const q = query(collection(db, 'comments'));
    return onSnapshot(q, (snapshot) => {
      const comments: Comment[] = [];
      snapshot.forEach((doc) => {
        comments.push({ id: doc.id, ...doc.data() } as Comment);
      });
      callback(comments.sort((a, b) => b.createdAt - a.createdAt));
    }, (error) => {
      console.error("Firestore Error in subscribeToAllComments:", error);
    });
  },

  getCommentsForUser: async (userId: string): Promise<Comment[]> => {
    try {
      const q = query(
        collection(db, 'comments'),
        where('userId', '==', userId)
      );
      const snapshot = await getDocs(q);
      const comments: Comment[] = [];
      snapshot.forEach(doc => {
        comments.push({ ...doc.data(), id: doc.id } as Comment);
      });
      return comments.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      console.error('Firestore getCommentsForUser Error:', e);
      return [];
    }
  },

  getCommentsForVideo: async (videoId: string, version: string): Promise<Comment[]> => {
    try {
      const q = query(
        collection(db, 'comments'),
        where('videoId', '==', videoId)
      );
      const snapshot = await getDocs(q);
      const comments: Comment[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as Comment;
        // Filter by version in memory - handle missing version field for backward compatibility
        if (data.version === version || (!data.version && version === 'Feedback 1')) {
          comments.push({ ...data, id: doc.id });
        }
      });
      return comments.sort((a, b) => a.createdAt - b.createdAt);
    } catch (e) {
      console.error('Firestore getComments Error:', e);
      return [];
    }
  },

  subscribeToCommentsForVideo: (videoId: string, version: string, callback: (comments: Comment[]) => void): (() => void) => {
    const q = query(
      collection(db, 'comments'),
      where('videoId', '==', videoId)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comments: Comment[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as Comment;
        // Filter by version in memory
        if (data.version === version || (!data.version && version === 'Feedback 1')) {
          comments.push({ ...data, id: doc.id });
        }
      });
      callback(comments.sort((a, b) => a.createdAt - b.createdAt));
    }, (error) => {
      console.error('Firestore subscribeToComments Error:', error);
      callback([]);
    });

    return unsubscribe;
  },

  addComment: async (comment: Omit<Comment, 'id' | 'createdAt' | 'resolved'>): Promise<Comment> => {
    try {
      // Branding for admins
      let finalUserName = comment.userName;
      let finalUserAvatar = comment.userAvatar;
      
      if (comment.userId !== 'guest') {
        const userDoc = await getDoc(doc(db, 'users', comment.userId));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          finalUserName = ADMIN_BRANDING.name;
          finalUserAvatar = ADMIN_BRANDING.avatar;
        }
      }
      
      if (ADMIN_EMAILS.some(e => e.toLowerCase() === auth.currentUser?.email?.toLowerCase())) {
        // Fallback for current user if doc not yet updated or for direct auth check
        finalUserName = ADMIN_BRANDING.name;
        finalUserAvatar = ADMIN_BRANDING.avatar;
      }

      const commentData = {
        ...comment,
        userName: finalUserName,
        userAvatar: finalUserAvatar,
        createdAt: Date.now(),
        resolved: false,
        attachmentUrl: comment.attachmentUrl || null
      };

      // Remove undefined values to avoid Firestore errors
      Object.keys(commentData).forEach(key => {
        if (commentData[key as keyof typeof commentData] === undefined) {
          delete commentData[key as keyof typeof commentData];
        }
      });

      const docRef = await addDoc(collection(db, 'comments'), commentData);
      const newComment = { ...commentData, id: docRef.id } as Comment;

      // Parse mentions
      const mentionRegex = /@([^\s@]+)/g;
      const mentions: string[] = [];
      let match;
      const allUsers = await dbService.getAllUsers();
      
      while ((match = mentionRegex.exec(comment.content)) !== null) {
        const name = match[1];
        const mentionedUser = allUsers.find(u => u.name === name);
        if (mentionedUser) {
          mentions.push(mentionedUser.id);
        }
      }

      // Notify involved users about new comment
      await dbService.notifyInvolvedUsers(comment.videoId, {
        type: 'comment',
        title: 'Bình luận mới',
        message: `Có bình luận mới từ ${comment.userName || 'ai đó'}: "${comment.content.substring(0, 50)}${comment.content.length > 50 ? '...' : ''}"`,
        triggerUserId: comment.userId,
        mentions: mentions.length > 0 ? mentions : undefined
      });

      return newComment;
    } catch (e) {
      console.error('Firestore addComment Error:', e);
      throw e;
    }
  },

  toggleCommentStatus: async (commentId: string, resolved: boolean): Promise<void> => {
    try {
      await updateDoc(doc(db, 'comments', commentId), { resolved });
    } catch (e) {
      console.error('Firestore toggleStatus Error:', e);
      throw e;
    }
  },

  updateComment: async (commentId: string, updates: Partial<Comment>): Promise<void> => {
    const path = `comments/${commentId}`;
    try {
      await updateDoc(doc(db, 'comments', commentId), updates);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  deleteComment: async (commentId: string): Promise<void> => {
    const path = `comments/${commentId}`;
    try {
      await deleteDoc(doc(db, 'comments', commentId));
      
      // Also delete replies safely
      try {
        const q = query(collection(db, 'comments'), where('parentId', '==', commentId));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(async (d) => {
          try {
            await deleteDoc(d.ref);
          } catch (replyErr) {
            console.warn(`Failed to delete reply ${d.id}:`, replyErr);
          }
        });
        await Promise.all(deletePromises);
      } catch (e) {
        console.warn("Failed to delete replies for comment:", commentId, e);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  reactToComment: async (commentId: string, userId: string, emoji: string): Promise<void> => {
    try {
      const docRef = doc(db, 'comments', commentId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const comment = snapshot.data() as Comment;
        const reactions = comment.reactions || {};
        const users = reactions[emoji] || [];
        
        const newUsers = users.includes(userId)
          ? users.filter(id => id !== userId)
          : [...users, userId];
          
        const newReactions = { ...reactions, [emoji]: newUsers };
        if (newUsers.length === 0) {
          delete newReactions[emoji];
        }
        
        await updateDoc(docRef, { reactions: newReactions });
      }
    } catch (e) {
      console.error('Firestore reactToComment Error:', e);
      throw e;
    }
  },

  loginWithGoogle: async (): Promise<User> => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email || undefined;
      const role = await getUserRole(result.user.uid, email);
                      
      const user = brandUser({ 
        id: result.user.uid, 
        name: result.user.displayName || email || 'User',
        email,
        role
      });
      
      // Ensure user doc exists
      try {
        await setDoc(doc(db, 'users', user.id), { 
          name: user.name, 
          email: user.email, 
          role: user.role,
          lastLogin: Date.now()
        }, { merge: true });
      } catch (err) {
        console.warn('Could not update user profile in Firestore (might be expected for restricted roles):', err);
      }
      
      return user;
    } catch (e: any) {
      if (e.message?.includes('popup-closed-by-user')) {
        throw new Error('Đăng nhập bị hủy bởi người dùng.');
      }
      throw e;
    }
  },

  registerWithEmail: async (email: string, pass: string, name: string): Promise<User> => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(result.user, { displayName: name });
      const role = await getUserRole(result.user.uid, email);
      const user = brandUser({ id: result.user.uid, name, email, role });
      
      await setDoc(doc(db, 'users', user.id), { 
        name, 
        email, 
        role,
        createdAt: Date.now(),
        lastLogin: Date.now() 
      }, { merge: true });
      
      return user;
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        throw new Error('Email này đã được đăng ký.');
      }
      throw e;
    }
  },

  loginWithEmail: async (email: string, pass: string): Promise<User> => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      const role = await getUserRole(result.user.uid, email);
                      
      const user = brandUser({ 
        id: result.user.uid, 
        name: result.user.displayName || email,
        email,
        role
      });
      
      // Update last login
      try {
        await updateDoc(doc(db, 'users', user.id), { lastLogin: Date.now() });
      } catch (err) {
        // Silent fail for login timestamp if permissions restrictive
      }
      
      return user;
    } catch (e: any) {
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        throw new Error('Email hoặc mật khẩu không chính xác.');
      }
      throw e;
    }
  },

  resetPassword: async (email: string): Promise<void> => {
    const actionCodeSettings = {
      // URL to redirect back to. The domain must be whitelisted in the Firebase Console.
      url: window.location.origin,
      handleCodeInApp: true,
    };
    await sendPasswordResetEmail(auth, email, actionCodeSettings);
  },

  logout: async (): Promise<void> => {
    await signOut(auth);
  },

  getCurrentUser: (): Promise<User | null> => {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        unsubscribe();
        if (firebaseUser) {
          const email = firebaseUser.email || undefined;
          const role = await getUserRole(firebaseUser.uid, email);
          
          resolve(brandUser({ 
            id: firebaseUser.uid, 
            name: firebaseUser.displayName || email || 'User',
            email,
            role
          }));
        } else {
          resolve(null);
        }
      });
    });
  },

  getUsers: async (): Promise<User[]> => {
    try {
      if (!auth.currentUser) return [];
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as User[];
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'users');
      return []; // Never reached but for type safety
    }
  },

  addUser: async (name: string, email: string, role: string): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, 'users'), { name, email, role });
      return docRef.id;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'users');
      throw e;
    }
  },

  updateUserRole: async (userId: string, role: UserRole): Promise<void> => {
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), { role });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  updateUserName: async (userId: string, name: string): Promise<void> => {
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), { name });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  updateUserProfile: async (userId: string, updates: Partial<User>): Promise<void> => {
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), updates);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },

  deleteUser: async (userId: string): Promise<void> => {
    const path = `users/${userId}`;
    try {
      // 1. Delete comments made by user
      const commentsQuery = query(collection(db, 'comments'), where('userId', '==', userId));
      const commentsSnapshot = await getDocs(commentsQuery);
      const deleteCommentPromises = commentsSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteCommentPromises);

      // 2. Delete videos owned by user
      const videosQuery = query(collection(db, 'videos'), where('ownerId', '==', userId));
      const videosSnapshot = await getDocs(videosQuery);
      const deleteVideoPromises = videosSnapshot.docs.map(v => dbService.deleteVideo(v.id));
      await Promise.all(deleteVideoPromises);

      // 3. Delete user account from Firestore
      await deleteDoc(doc(db, 'users', userId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  getUserByEmail: async (email: string): Promise<User | null> => {
    try {
      const q = query(collection(db, 'users'), where('email', '==', email), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return brandUser({ ...doc.data(), id: doc.id } as User);
      }
      return null;
    } catch (e) {
      console.error('Firestore getUserByEmail Error:', e);
      return null;
    }
  },

  getAllUsers: async (): Promise<User[]> => {
    try {
      if (!auth.currentUser) return [];
      const snapshot = await getDocs(collection(db, 'users'));
      return snapshot.docs.map(doc => brandUser({ ...doc.data(), id: doc.id } as User));
    } catch (e) {
      console.error('Firestore getAllUsers Error:', e);
      return [];
    }
  },

  // Notification Methods
  getNotifications: async (userId: string): Promise<Notification[]> => {
    try {
      if (!auth.currentUser) return [];
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notification));
    } catch (e) {
      console.error('Firestore getNotifications Error:', e);
      return [];
    }
  },

  // Shared Link Methods
  formatSharedLink: (id: string, password?: string, expiresAt?: number): string => {
    const baseUrl = `${window.location.origin}/video/shared/${id}`;
    const params = new URLSearchParams();
    if (password) params.set('p', btoa(password));
    if (expiresAt) params.set('e', expiresAt.toString());
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  },

  createSharedLink: async (videoId: string, title: string, password?: string, expiresAt?: number): Promise<SharedLink> => {
    const path = 'sharedLinks';
    try {
      const linkData = {
        videoId,
        title,
        password: password || null,
        expiresAt: expiresAt || null,
        createdAt: Date.now(),
        createdBy: auth.currentUser?.uid || 'anonymous',
        viewCount: 0
      };
      const docRef = await addDoc(collection(db, 'sharedLinks'), linkData);
      return { ...linkData, id: docRef.id } as SharedLink;
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
      throw e;
    }
  },

  getSharedLink: async (id: string): Promise<SharedLink | null> => {
    try {
      const docRef = doc(db, 'sharedLinks', id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return { ...snapshot.data(), id: snapshot.id } as SharedLink;
      }
      return null;
    } catch (e) {
      console.error('Firestore getSharedLink Error:', e);
      return null;
    }
  },

  incrementShareViewCount: async (id: string): Promise<void> => {
    try {
      const docRef = doc(db, 'sharedLinks', id);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        const currentCount = snapshot.data().viewCount || 0;
        await updateDoc(docRef, { viewCount: currentCount + 1 });
      }
    } catch (e) {
      console.error('Firestore incrementShareViewCount Error:', e);
    }
  },

  getSharedLinksByVideo: async (videoId: string): Promise<SharedLink[]> => {
    try {
      const q = query(collection(db, 'sharedLinks'), where('videoId', '==', videoId), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SharedLink));
    } catch (e) {
      console.error('Firestore getSharedLinksByVideo Error:', e);
      return [];
    }
  },

  deleteSharedLink: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'sharedLinks', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `sharedLinks/${id}`);
    }
  },

  subscribeToNotifications: (userId: string, callback: (notifications: Notification[]) => void) => {
    if (!auth.currentUser) {
      callback([]);
      return () => {};
    }
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Notification));
      callback(notifications);
    }, (error) => {
      console.error('Firestore subscribeToNotifications Error:', error);
    });
  },

  addNotification: async (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<void> => {
    try {
      const notificationData = {
        ...notification,
        read: false,
        createdAt: Date.now()
      };

      // Sanitize
      Object.keys(notificationData).forEach(key => {
        if ((notificationData as any)[key] === undefined) {
          delete (notificationData as any)[key];
        }
      });

      await addDoc(collection(db, 'notifications'), notificationData);
    } catch (e) {
      console.error('Firestore addNotification Error:', e);
    }
  },

  markNotificationRead: async (notificationId: string): Promise<void> => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { read: true });
    } catch (e) {
      console.error('Firestore markNotificationRead Error:', e);
    }
  },

  notifyInvolvedUsers: async (videoId: string, partialNotif: { type: Notification['type'], title: string, message: string, triggerUserId?: string, mentions?: string[] }) => {
    try {
      const video = await dbService.getVideoById(videoId);
      if (!video) return;

      const usersToNotify = new Set<string>();
      if (video.ownerId) usersToNotify.add(video.ownerId);
      if (video.editorIds) {
        video.editorIds.forEach(id => usersToNotify.add(id));
      }

      // Add mentioned users
      if (partialNotif.mentions) {
        partialNotif.mentions.forEach(userId => usersToNotify.add(userId));
      }

      // Don't notify the person who triggered it
      if (partialNotif.triggerUserId) {
        usersToNotify.delete(partialNotif.triggerUserId);
      }

      const promises = Array.from(usersToNotify).map(userId => 
        dbService.addNotification({
          userId,
          type: userId === partialNotif.triggerUserId ? 'comment' : (partialNotif.mentions?.includes(userId) ? 'comment' : partialNotif.type),
          title: partialNotif.mentions?.includes(userId) ? 'Bạn được nhắc đến' : partialNotif.title,
          message: partialNotif.message,
          videoId: videoId,
          triggerUserId: partialNotif.triggerUserId
        })
      );

      await Promise.all(promises);
    } catch (e) {
      console.error('notifyInvolvedUsers Error:', e);
    }
  }
};
