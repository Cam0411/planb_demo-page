import { useState } from 'react';
import { User as UserIcon, Mail, Lock, LogIn, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { dbService } from '../services/db';
import { User as UserType } from '../types';

interface LoginModalProps {
  onLogin: (user: UserType) => void;
  initialMode?: 'login' | 'register' | 'forgot_password' | 'guest' | 'choice';
}

export default function LoginModal({ onLogin, initialMode = 'guest' }: LoginModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot_password' | 'guest' | 'choice'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [guestNameInput, setGuestNameInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isRestrictedBrowser = () => {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    return (
      (ua.indexOf('FBAN') > -1) || 
      (ua.indexOf('FBAV') > -1) || 
      (ua.indexOf('Instagram') > -1) || 
      (ua.indexOf('Zalo') > -1) ||
      (ua.indexOf('TikTok') > -1)
    );
  };

  const handleGoogleLogin = async () => {
    if (isRestrictedBrowser()) {
      setError('Google chặn đăng nhập từ trình duyệt bên trong ứng dụng (như Facebook, Zalo). Vui lòng nhấn vào dấu 3 chấm góc trên bên phải và chọn "Mở bằng trình duyệt" (Chrome/Safari) để đăng nhập, hoặc sử dụng Email/Mật khẩu.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await dbService.loginWithGoogle();
      onLogin(user);
      window.location.reload();
    } catch (err: any) {
      console.error('Google login failed:', err);
      let errorMessage = err.message || 'Google login failed';
      if (errorMessage.includes('network-request-failed') || errorMessage.includes('popup-closed-by-user')) {
        errorMessage = 'Trình duyệt đang chặn popup hiển thị đăng nhập Google (thường do chạy trong iframe). Vui lòng thử dùng Email/Mật khẩu hoặc mở ứng dụng trong thẻ mới (Open In New Tab).';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || (mode !== 'forgot_password' && !password.trim()) || (mode === 'register' && !name.trim())) return;

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === 'forgot_password') {
        await dbService.resetPassword(email);
        setMessage('Vui lòng kiểm tra hòm thư (bao gồm cả thư rác/spam) để đặt lại mật khẩu.');
        setMode('login');
      } else {
        let user;
        if (mode === 'register') {
          user = await dbService.registerWithEmail(email, password, name);
        } else {
          user = await dbService.loginWithEmail(email, password);
        }
        onLogin(user);
        window.location.reload(); 
      }
    } catch (err: any) {
      console.error('Authentication failed:', err);
      const errorCode = err.code || '';
      let errorMessage = err.message || 'Authentication failed';
      
      const adminEmails = ['duongnguyencam00@gmail.com', 'hungbato19@gmail.com', 'hungbato01@gmail.com', 'ducna224@gmail.com', 'ducna225@gmail.com'];
      const isAdminEmail = adminEmails.includes(email);

      if (errorCode === 'auth/operation-not-allowed' || errorMessage.includes('operation-not-allowed')) {
        errorMessage = 'Phương thức đăng nhập Email/Mật khẩu chưa được bật. Vui lòng vào Firebase Console > Authentication > Sign-in method để bật "Email/Password".';
      } else if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found' || errorMessage.includes('invalid-credential')) {
        errorMessage = 'Email hoặc mật khẩu không đúng.';
        if (isAdminEmail) {
          errorMessage = 'Tài khoản Admin này chưa được tạo hoặc sai mật khẩu. Nếu bạn chưa tạo tài khoản, vui lòng nhấn "Đăng ký ngay" bên dưới để đăng ký với mật khẩu bạn chọn.';
        }
      } else if (errorCode === 'auth/email-already-in-use' || errorMessage.includes('email-already-in-use')) {
        errorMessage = 'Email này đã được sử dụng. Nếu bạn đã có tài khoản, vui lòng dùng chức năng "Đăng nhập".';
        if (isAdminEmail) {
          errorMessage = 'Tài khoản Admin này đã tồn tại. Vui lòng quay lại màn hình "Đăng nhập" để vào hệ thống.';
        }
      } else if (errorCode === 'auth/weak-password' || errorMessage.includes('weak-password')) {
        errorMessage = 'Mật khẩu quá yếu. Vui lòng sử dụng ít nhất 6 ký tự.';
      } else if (errorCode === 'auth/invalid-email' || errorMessage.includes('invalid-email')) {
        errorMessage = 'Địa chỉ email không hợp lệ.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative border border-slate-200"
      >
         <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
         <div className="p-8">
            <div className="text-center mb-6">
              <img src="https://ik.imagekit.io/39wvgoqre/B%20(1).png?updatedAt=1777439253123" alt="Logo" className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-slate-800">Plan B Production</h2>
              <p className="text-slate-500 mt-2">
                {mode === 'login' ? 'Đăng nhập vào tài khoản của bạn' : 
                 mode === 'register' ? 'Tạo tài khoản mới' : 
                 mode === 'choice' ? 'Bắt đầu xem Feedback ngay' :
                 mode === 'guest' ? 'Chúng tôi rất vui khi được đón tiếp bạn' :
                 'Khôi phục mật khẩu'}
              </p>
            </div>
            
            {message && (
              <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg mb-6 border border-green-100">
                {message}
              </div>
            )}
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-50 text-red-600 text-[11px] font-bold p-3.5 rounded-xl mb-6 border border-red-100 flex items-start gap-3 shadow-sm"
              >
                <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <X className="w-3 h-3" />
                </div>
                <span>{error}</span>
              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {mode === 'guest' && (
                <motion.div 
                  key="guest-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="text-center py-2">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight">Chào mừng bạn!</h3>
                    <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Nhập tên để trải nghiệm ngay</p>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <UserIcon className="h-5 h-5 text-slate-400" />
                      </div>
                      <input 
                        type="text" 
                        value={guestNameInput}
                        onChange={e => setGuestNameInput(e.target.value)}
                        placeholder="Tên của bạn là..."
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-slate-800 font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 placeholder:font-medium"
                        required
                        autoFocus
                      />
                    </div>

                    <button 
                      type="button"
                      onClick={() => {
                        if (guestNameInput.trim()) {
                          localStorage.setItem('guestName', guestNameInput.trim());
                          onLogin({ id: 'guest', name: guestNameInput.trim(), role: 'viewer' } as any);
                        }
                      }}
                      className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-500/30 flex items-center justify-center gap-3 group active:scale-[0.97]"
                    >
                      BẮT ĐẦU NGAY
                      <motion.span 
                        animate={{ x: [0, 5, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        →
                      </motion.span>
                    </button>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-widest mb-4">Hoặc sử dụng tài khoản</p>
                    <button 
                      type="button"
                      onClick={() => setMode('login')}
                      className="w-full py-4 bg-white text-slate-700 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 border-2 border-slate-100 active:scale-[0.98]"
                    >
                      <LogIn className="w-4 h-4" />
                      Đăng nhập / Đăng ký
                    </button>
                  </div>
                </motion.div>
              )}

              {(mode === 'login' || mode === 'register' || mode === 'forgot_password') && (
                <motion.div
                  key="auth-form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  {mode !== 'forgot_password' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                      <button 
                        onClick={handleGoogleLogin} 
                        disabled={loading}
                        className="w-full py-3.5 mb-6 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50 shadow-sm active:scale-[0.98]"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Đăng nhập bằng Google
                      </button>

                      <div className="flex items-center gap-4 mb-6">
                        <div className="flex-1 h-px bg-slate-100"></div>
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">hoặc email</span>
                        <div className="flex-1 h-px bg-slate-100"></div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    {mode === 'register' && (
                       <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Tên hiển thị</label>
                          <input 
                            type="text" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="VD: Nguyễn Văn A"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                            required
                          />
                       </div>
                    )}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                        <input 
                          type="email" 
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="email@example.com"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                          required
                        />
                    </div>
                    {mode !== 'forgot_password' && (
                      <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Mật khẩu</label>
                          <input 
                            type="password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                            required
                          />
                          {mode === 'login' && (
                            <div className="text-right mt-1">
                              <button type="button" onClick={() => { setMode('forgot_password'); setError(null); setMessage(null); }} className="text-sm text-blue-600 hover:underline">
                                Quên mật khẩu?
                              </button>
                            </div>
                          )}
                      </div>
                    )}
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full py-3.5 mt-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                          mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Tạo tài khoản' : 'Gửi email khôi phục'
                      )}
                    </button>
                  </form>

                  <div className="mt-6 text-center text-sm font-medium text-slate-600 space-y-3">
                    <div>
                      {mode === 'login' ? 'Chưa có tài khoản? ' : mode === 'register' ? 'Đã có tài khoản? ' : 'Nhớ mật khẩu rồi? '}
                      <button 
                        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); setMessage(null); }}
                        className="text-blue-600 font-bold hover:underline"
                      >
                        {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
                      </button>
                    </div>
                    
                    <div className="pt-2">
                      <button 
                        onClick={() => setMode('guest')}
                        className="text-emerald-600 font-bold hover:underline py-1 px-3 bg-emerald-50 rounded-lg"
                      >
                        Tiếp tục với tư cách khách
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
         </div>
      </motion.div>
    </div>
  );
}
