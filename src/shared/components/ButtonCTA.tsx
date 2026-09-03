import { motion } from 'framer-motion';
import React from 'react';

interface ButtonCTAProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
}

export const ButtonCTA: React.FC<ButtonCTAProps> = ({
  children,
  onClick,
  type = 'button',
  disabled = false,
}) => {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="
        px-5 py-3 rounded-md
        bg-stone-800 text-white
        font-semibold
        hover:bg-stone-900
        focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-yellow-900
        transition
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      {children}
    </motion.button>
  );
};

export const ButtonSecondCTA: React.FC<ButtonCTAProps> = ({
  children,
  onClick,
  type = 'button',
  disabled = false,
}) => {
  return (
   <motion.button
      type={type}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="
        px-5 py-2 rounded-md
        border yellow-600 
        text-yellow-600 
        bg-transparent
        font-semibold

        dark:border-amber-400
        dark:text-amber-400

        focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:ring-amber-900
        dark:focus-visible:ring-amber-600
        transition
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      {children}
    </motion.button>
  );
};
