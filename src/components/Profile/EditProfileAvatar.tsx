import React from "react";
import { motion } from "framer-motion";
import { FiCamera } from "react-icons/fi";

interface EditProfileAvatarProps {
  avatar: string | null;
  name: string;
  shouldReduceMotion: boolean | null;
  setAvatar: (url: string) => void;
  setAvatarFile: (file: File) => void;
}

export const EditProfileAvatar: React.FC<EditProfileAvatarProps> = ({
  avatar,
  name,
  shouldReduceMotion,
  setAvatar,
  setAvatarFile,
}) => {
  return (
    <div className="lg:w-72 lg:shrink-0">
      <div className="flex flex-col items-center gap-4 lg:items-start lg:sticky lg:top-6">
        <motion.div
          className="relative group w-32 h-32 sm:w-36 sm:h-36 lg:w-40 lg:h-40 mx-auto rounded-full border border-(--color-border) shadow-xs overflow-hidden"
          whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
        >
          {avatar ? (
            <img
              src={avatar}
              alt="Foto profilo"
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-lg font-medium text-(--color-text) bg-(--color-bg)"
              style={{ fontFamily: 'var(--font-serif)' }}
              aria-hidden="true"
            >
              {(name?.[0] || "?").toUpperCase()}
            </div>
          )}

          <label
            className="absolute inset-0 bg-black/50 backdrop-blur-xs flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer z-30"
            aria-label="Cambia immagine profilo"
          >
            <FiCamera size={22} className="text-white opacity-90" aria-hidden="true" focusable={false} />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setAvatar(URL.createObjectURL(file));
                setAvatarFile(file);
              }}
              className="sr-only"
            />
          </label>
        </motion.div>

        <p className="text-xs text-(--color-muted) font-light text-center lg:text-left max-w-xs leading-relaxed">
          Clicca sull’avatar per cambiare immagine.
        </p>
      </div>
    </div>
  );
};