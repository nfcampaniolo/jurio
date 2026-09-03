import React from 'react';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { GoogleButton } from './components/GoogleButton';
import { motion } from 'framer-motion';

export const Login: React.FC = () => (
  // Sfondo leggermente colorato per togliere la freddezza del bianco puro
  <main className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
    
    {/* Colonna sinistra: Immagine */}
    <motion.div
      className="hidden lg:flex flex-1 relative h-screen p-6"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {/* Contenitore immagine con bordi molto arrotondati e ombra morbida */}
      <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl relative group">
        {/* CORREZIONE: Aggiunto bg-gradient-to-t */}
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
      {/* Aggiunta animazione anche al form per un ingresso coordinato */}
      <motion.div 
        className="w-full max-w-md flex flex-col gap-8"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
      >
        <div className="flex flex-col gap-6">
          <AuthForm initialMode="register" />
          
          {/* Separatore visivo morbido */}
          <div className="relative flex items-center py-2">
            <div className="grow"></div>
            <span className="shrink-0 mx-4 text-xs uppercase tracking-wider">
              oppure
            </span>
            <div className="grow"></div>
          </div>

          <GoogleButton />
        </div>
      </motion.div>
    </div>
  </main>
);