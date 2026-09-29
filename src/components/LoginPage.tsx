import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle2, 
  Languages, 
  LogIn
} from 'lucide-react';
import { AuthUser } from '../types';
import { authenticateUser } from '../utils/authService';
import { useLanguage } from '../i18n/LanguageContext';
import { GarmentIllustration } from './GarmentIllustration';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { language, setLanguage } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSuccessing, setIsSuccessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMessage(
        language === 'id' 
          ? 'Silakan masukkan Username / NIK dan Password Anda' 
          : 'Please enter your Username / NIK and Password'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await authenticateUser(username, password);
      if (result.success && result.user) {
        setIsSuccessing(true);
        setSuccessMessage(
          language === 'id' 
            ? `Selamat datang, ${result.user.name}!` 
            : `Welcome, ${result.user.name}!`
        );
        setTimeout(() => {
          onLoginSuccess(result.user!);
        }, 200);
      } else {
        setErrorMessage(
          result.message || 
          (language === 'id' 
            ? 'Username / NIK atau Password tidak valid. Silakan periksa kembali.' 
            : 'Invalid Username / NIK or Password. Please check again.')
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat proses login.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`w-screen h-screen min-h-screen m-0 p-0 overflow-x-hidden overflow-y-auto lg:overflow-hidden bg-[#1B433E] relative flex flex-col lg:flex-row select-none font-sans transition-opacity duration-200 ${
      isSuccessing ? 'opacity-0 pointer-events-none' : 'opacity-100'
    }`}>
      
      {/* ============================================================ */}
      {/* BACKGROUND ORGANIC CURVED SHAPE (DESKTOP & TABLET WIDE) */}
      {/* ============================================================ */}
      <div className="absolute inset-0 w-full h-full pointer-events-none hidden lg:block z-0 overflow-hidden">
        <svg
          className="w-full h-full"
          viewBox="0 0 1000 1000"
          fill="none"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main White Organic Curve: Starts 39% (x=390) on top, smooth soft crest, ends at 53% (x=530) on bottom */}
          <path
            d="M 0 0 L 390 0 C 420 140, 480 320, 545 460 C 585 545, 600 630, 585 730 C 570 820, 548 910, 530 1000 L 0 1000 Z"
            fill="#FFFFFF"
          />

          {/* Atmospheric Bubbles in Dark Teal Field */}
          <circle cx="920" cy="180" r="42" fill="#FFFFFF" fillOpacity="0.04" />
          <circle cx="960" cy="780" r="58" fill="#FFFFFF" fillOpacity="0.04" />
          <circle cx="680" cy="850" r="28" fill="#FFFFFF" fillOpacity="0.03" />
          <circle cx="650" cy="110" r="18" fill="#FFFFFF" fillOpacity="0.03" />
        </svg>
      </div>

      {/* Mobile Curved Divider Header SVG */}
      <div className="w-full lg:hidden absolute top-0 left-0 right-0 h-[480px] sm:h-[540px] bg-white pointer-events-none z-0">
        <svg
          className="absolute -bottom-12 left-0 w-full h-16 text-white fill-current"
          viewBox="0 0 400 50"
          preserveAspectRatio="none"
        >
          <path d="M0,0 C150,50 250,50 400,0 L400,0 L0,0 Z" />
        </svg>
      </div>

      {/* Top Right Quick Language Selector */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-8 z-30 flex items-center bg-[#14332F]/85 backdrop-blur-md rounded-full p-1 border border-white/15 shadow-md">
        <Languages className="w-3.5 h-3.5 text-[#8FC4D1] ml-2.5 mr-1" />
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
            language === 'en' ? 'bg-[#5B9590] text-white shadow-xs' : 'text-[#B8D8EE] hover:text-white'
          }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLanguage('id')}
          className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
            language === 'id' ? 'bg-[#5B9590] text-white shadow-xs' : 'text-[#B8D8EE] hover:text-white'
          }`}
        >
          ID
        </button>
      </div>

      {/* ============================================================ */}
      {/* LEFT SECTION (APPROX. 60-62% OF VIEWPORT): LOGO + ILLUSTRATION */}
      {/* ============================================================ */}
      <section className="w-full lg:w-[60%] min-h-[480px] lg:min-h-full flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-14 relative z-10 bg-transparent">
        
        {/* Top-Left: PT. Winners International Official Logo */}
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white p-2 flex items-center justify-center border border-[#E0ECEB] shadow-sm shrink-0">
            <img
              src="/winners-logo.png"
              alt="PT. Winners International"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-wider text-[#1769AA] uppercase font-sans leading-tight">
              PT. WINNERS
            </h1>
            <h2 className="text-sm sm:text-base font-bold tracking-widest text-[#214E49] uppercase font-sans">
              INTERNATIONAL
            </h2>
          </div>
        </div>

        {/* Center-Left: Large Flat-Design Garment Manufacturing & Teamwork Illustration (Seamless Vector - 150% Scaled) */}
        <div className="my-auto py-1 sm:py-2 flex flex-col items-center justify-center relative w-full">
          <div className="relative w-full max-w-[680px] lg:max-w-[760px] xl:max-w-[840px] 2xl:max-w-[920px] flex items-center justify-center scale-100 sm:scale-[1.08] lg:scale-[1.18] xl:scale-[1.25] transition-transform duration-700">
            <GarmentIllustration className="w-full h-auto drop-shadow-xs" />
          </div>
        </div>

        {/* Bottom-Left: Corporate Footer Copyright */}
        <div className="pt-2 text-xs text-[#527773] font-medium">
          &copy; 2026 PT. Winners International
        </div>

      </section>

      {/* ============================================================ */}
      {/* RIGHT SECTION (APPROX. 38-40% OF VIEWPORT): DARK TEAL LOGIN FORM */}
      {/* ============================================================ */}
      <section className="w-full lg:w-[42%] xl:w-[40%] min-h-[500px] lg:min-h-full flex flex-col items-center justify-center p-6 sm:p-10 lg:pl-[clamp(2.5rem,8vw,11vw)] lg:pr-[clamp(1.5rem,4vw,6vw)] relative z-10 bg-transparent">
        
        {/* SINGLE CONTAINER: Wrap Judul + Heading + Form (Centered Vertically & Horizontally) */}
        <div className="login-wrapper w-full max-w-[360px] sm:max-w-[380px] mx-auto my-auto -translate-y-[2vh] relative z-20 text-center">
          
          {/* System Title & "Login" Heading (24px Spacing) */}
          <div className="mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-black tracking-wide text-[#F4C430] uppercase font-sans leading-tight mb-6 drop-shadow-xs text-center">
              MULTI SKILL OPERATOR
            </h1>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white/90 font-sans text-center">
              Login
            </h2>
          </div>

          {/* Error Message Toast */}
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-100 text-xs flex items-start gap-2.5 shadow-md text-left">
              <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* Success Message Toast */}
          {successMessage && (
            <div className="mb-6 p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-100 text-xs flex items-center gap-2.5 shadow-md text-left">
              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          {/* Form (16px spacing between fields, 24px to button) */}
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            
            {/* Username Label & Pill Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#E5F0ED] block pl-1 text-left">
                Username
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={language === 'id' ? 'Enter your username or NIK' : 'Enter your username'}
                  className="w-full bg-[#122D2A] hover:bg-[#0E2421] focus:bg-[#0E2421] text-white text-xs sm:text-sm px-5 py-3.5 rounded-full border border-[#2E625C] focus:border-[#8FC4D1] focus:ring-2 focus:ring-[#8FC4D1]/30 outline-none transition-all placeholder:text-[#6C8E8A]"
                  disabled={isLoading}
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password Label & Pill Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#E5F0ED] block pl-1 text-left">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={language === 'id' ? 'Enter your password' : 'Enter your password'}
                  className="w-full bg-[#122D2A] hover:bg-[#0E2421] focus:bg-[#0E2421] text-white text-xs sm:text-sm px-5 pr-12 py-3.5 rounded-full border border-[#2E625C] focus:border-[#8FC4D1] focus:ring-2 focus:ring-[#8FC4D1]/30 outline-none transition-all placeholder:text-[#6C8E8A]"
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#6C8E8A] hover:text-white cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-[#8FC4D1]" />
                  ) : (
                    <Eye className="w-4 h-4 text-[#8FC4D1]" />
                  )}
                </button>
              </div>
            </div>

            {/* Large Rounded Primary Button: "Login" (24px Spacing / pt-2) */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-full font-bold text-xs sm:text-sm text-white bg-[#5B9590] hover:bg-[#4E8782] active:scale-[0.99] shadow-lg shadow-[#0E2421]/50 border border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{language === 'id' ? 'Memproses...' : 'Connecting...'}</span>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    <span>Login</span>
                  </div>
                )}
              </button>
            </div>

          </form>

        </div>

        {/* Bottom Right: POWERED BY ME TEAM Badge in Grey */}
        <div className="absolute bottom-4 right-6 sm:bottom-6 sm:right-8 z-20 text-sm sm:text-base lg:text-lg font-black font-mono tracking-widest text-[#94A3B8] uppercase drop-shadow-xs">
          POWERED BY ME TEAM
        </div>

      </section>

    </div>
  );
};
