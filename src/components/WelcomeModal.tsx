import React, { useEffect, useState } from 'react';
import { UserCheck, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

interface WelcomeModalProps {
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  userName,
  isOpen,
  onClose,
}) => {
  const { language } = useLanguage();
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  useEffect(() => {
    if (!isOpen) return;

    // Auto-close pop-up after 2 seconds (2000ms)
    const timer = setTimeout(() => {
      handleClose();
    }, 2000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed inset-x-0 top-3 sm:top-5 z-50 flex items-start justify-center p-3 sm:p-4 pointer-events-none transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div 
        className={`bg-[#EAF5F5] rounded-[20px] max-w-sm sm:max-w-md w-full shadow-[0_20px_60px_rgba(22,63,59,0.30)] border-2 border-[#12B886]/40 overflow-hidden relative p-5 sm:p-6 text-center select-none pointer-events-auto cursor-pointer transition-all duration-300 ${
          isClosing ? '-translate-y-4 scale-95 opacity-0' : 'translate-y-0 scale-100 opacity-100 animate-fadeInSmooth'
        }`}
        role="dialog"
        aria-modal="true"
        onClick={handleClose}
      >
        {/* Subtle decorative background bubbles */}
        <div className="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-[#214E49]/5 pointer-events-none" />
        <div className="absolute -left-6 -top-6 w-24 h-24 rounded-full bg-[#214E49]/5 pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          {/* User Icon Circle */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#214E49] border-2 border-white/80 shadow-md flex items-center justify-center mb-2.5 transition-transform duration-300 hover:scale-105">
            <UserCheck className="w-6 h-6 sm:w-7 sm:h-7 text-[#F4C430]" />
          </div>

          {/* Login Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#214E49]/10 border border-[#214E49]/15 text-[#214E49] text-[10px] sm:text-[11px] font-bold tracking-wide uppercase mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#12B886]" />
            <span>{language === 'id' ? 'Login Berhasil' : 'Login Successful'}</span>
          </div>

          {/* Welcome User Heading */}
          <h3 className="text-lg sm:text-xl font-bold text-[#102A2A] tracking-tight">
            Hallo , {userName}
          </h3>

          {/* Welcome Subtitle */}
          <p className="text-xs sm:text-[13px] text-[#2E625C] mt-1 max-w-xs font-medium leading-relaxed">
            {language === 'id' 
              ? 'Selamat datang di Sistem Skill Matrix & Multi-Skilling PT. Winners International.'
              : 'Welcome to PT. Winners International Skill Matrix & Multi-Skilling System.'}
          </p>
        </div>

        {/* 2-Second Smooth Auto-Close Progress Bar Indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#D8E5E5] overflow-hidden">
          <div className="h-full bg-[#214E49] animate-[autoCloseProgress_2s_linear_forwards]" />
        </div>
      </div>
    </div>
  );
};
