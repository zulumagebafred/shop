import React from 'react';
import { motion } from 'motion/react';
import { createWhatsAppUrl } from '../utils/whatsapp';

interface FloatingWhatsAppButtonProps {
  /** Lift button above the mobile sticky add-to-basket bar on product detail pages */
  raisedOnMobile?: boolean;
  /** Current page context to pre-fill a helpful greeting */
  contextLabel?: string;
}

export const FloatingWhatsAppButton: React.FC<FloatingWhatsAppButtonProps> = ({
  raisedOnMobile = false,
  contextLabel,
}) => {
  const greeting = contextLabel
    ? `Hello AuraHut Co., I am browsing ${contextLabel} and would like to chat.`
    : 'Hello AuraHut Co., I have a fragrance enquiry and would like to chat.';

  const whatsappUrl = createWhatsAppUrl(greeting);
  if (!whatsappUrl) return null;

  return (
    <motion.a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with AuraHut Co. on WhatsApp"
      title="Chat with us on WhatsApp"
      initial={{ opacity: 0, scale: 0.85, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ scale: 1.07, y: -2 }}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={`group fixed right-4 sm:right-6 z-40 inline-flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#25D366] text-white shadow-[0_10px_28px_rgba(37,211,102,0.42)] hover:bg-[#1EBE5D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 ${
        raisedOnMobile ? 'bottom-20 lg:bottom-6' : 'bottom-5 sm:bottom-6'
      }`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-full mr-3 hidden sm:inline-flex items-center px-3 py-1.5 rounded-full bg-[#0A0A0A] text-white text-xs font-semibold whitespace-nowrap shadow-lg opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150"
      >
        Chat on WhatsApp
      </span>

      <svg
        viewBox="0 0 32 32"
        className="w-7 h-7 sm:w-[30px] sm:h-[30px] fill-current"
        aria-hidden="true"
      >
        <path d="M16.004 3.2c-7.058 0-12.8 5.742-12.8 12.8 0 2.256.59 4.458 1.71 6.4L3.1 28.9l6.678-1.752a12.74 12.74 0 0 0 6.226 1.616h.006c7.056 0 12.796-5.742 12.796-12.8 0-3.42-1.332-6.634-3.75-9.052A12.716 12.716 0 0 0 16.004 3.2Zm7.454 18.21c-.316.89-1.842 1.702-2.55 1.808-.65.098-1.472.14-2.376-.15-.548-.174-1.252-.406-2.152-.794-3.786-1.634-6.258-5.448-6.446-5.7-.188-.25-1.538-2.048-1.538-3.908s.972-2.772 1.318-3.15c.346-.378.754-.472 1.006-.472.25 0 .502.002.722.014.232.012.542-.088.848.648.316.756 1.07 2.616 1.164 2.804.094.188.156.408.032.66-.126.252-.188.408-.376.63-.188.22-.396.492-.566.66-.188.188-.384.392-.166.77.22.378.976 1.612 2.096 2.61 1.44 1.284 2.654 1.682 3.032 1.87.376.188.596.156.816-.094.22-.25.942-1.1 1.194-1.478.252-.376.502-.314.848-.188.346.126 2.2 1.038 2.578 1.226.376.188.628.282.722.44.094.156.094.91-.222 1.8Z" />
      </svg>
    </motion.a>
  );
};
