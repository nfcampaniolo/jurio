import React from 'react';
import { motion } from 'framer-motion';

interface AuthLayoutProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children }) => (
  <main className="flex flex-col lg:flex-row min-h-screen overflow-hidde">
    
    {/* Colonna sinistra: Immagine */}
    <motion.div
      className="hidden lg:flex flex-1 relative h-screen p-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl relative group">
        <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent z-10" />
        <img
          src="/login.webp"
          alt="Login illustration"
          className="object-cover w-full h-full transform group-hover:scale-105 transition-transform duration-1000"
        />
      </div>
    </motion.div>

    {/* Colonna destra: Form */}
    <div className="flex flex-1 flex-col items-center justify-center p-8 lg:p-16 h-screen">
      <motion.div 
        className="w-full max-w-md flex flex-col gap-6"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      >
        {/* Intestazione testuale dinamica (se passata) */}
        {title && (
          <div className="text-center mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 mt-2">{subtitle}</p>}
          </div>
        )}

        {/* Qui viene iniettato il form specifico */}
        {children}
      </motion.div>
    </div>
  </main>
);