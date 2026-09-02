import React, { useRef } from "react";
import { UploadCloud, FileText, X } from "lucide-react";

interface DropZoneUploaderProps {
  dragActive: boolean;
  isProcessing: boolean;
  pendingFiles: File[];
  maxAllowed: number;
  totalCount: number;
  onDrag: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removePendingFile: (index: number) => void;
}

export const DropZoneUploader: React.FC<DropZoneUploaderProps> = ({
  dragActive,
  isProcessing,
  pendingFiles,
  maxAllowed,
  totalCount,
  onDrag,
  onDrop,
  onFileChange,
  removePendingFile,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section>
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-3 flex items-center gap-2">
        <UploadCloud size={14} /> Carica nuovi
      </h3>
      <div
        role="button"
        tabIndex={0}
        className={`relative w-full overflow-hidden rounded-lg border-2 border-dashed p-6 transition-all text-center outline-none cursor-pointer group focus-visible:ring-1 focus-visible:ring-(--color-text)
          ${dragActive
            ? "border-(--color-text) bg-(--color-bg) shadow-sm"
            : "border-(--color-border) bg-(--color-surface) hover:border-(--color-text) hover:bg-(--color-bg)"
          }
          ${isProcessing || totalCount >= maxAllowed ? "opacity-50 pointer-events-none" : ""}
        `}
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        onClick={() => !isProcessing && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isProcessing) {
              inputRef.current?.click();
            }
          }
        }}
      >
        <div className="flex flex-col items-center">
          <div className={`mb-3 grid h-12 w-12 place-items-center rounded-md border transition-colors border-(--color-border) bg-(--color-bg)`}>
            <UploadCloud className="text-(--color-text) opacity-70 group-hover:opacity-100 transition-opacity" size={24} />
          </div>
          <p className="text-sm font-medium text-(--color-text)">Trascina i file qui</p>
          <p className="mt-1 text-xs text-(--color-muted) font-light">oppure <span className="text-(--color-text) font-medium underline underline-offset-4">sfoglia locale</span></p>
        </div>
        <input
          type="file"
          ref={inputRef}
          className="hidden"
          accept=".pdf,.docx,.txt,.mp3,.wav,.ogg,.opus,.webm,.mp4,.mov,.avi,.mkv,.m4v"
          multiple 
          onChange={onFileChange}
          disabled={isProcessing}
        />
      </div>

      {pendingFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-[10px] font-bold text-(--color-text) uppercase tracking-widest mb-2">In coda per l'elaborazione</h4>
          {pendingFiles.map((f, i) => (
            <div key={`pending-file-${i}-${f.name}`} className="flex justify-between items-center p-3 border border-(--color-border) bg-(--color-bg) rounded-md">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText size={14} className="text-(--color-text) opacity-70 shrink-0" />
                <span className="text-xs font-medium text-(--color-text) truncate">{f.name}</span>
              </div>
              <button 
                onClick={() => removePendingFile(i)} 
                disabled={isProcessing} 
                className="text-(--color-muted) hover:text-(--color-text) transition-colors disabled:opacity-50 ml-2 outline-none"
                aria-label="Rimuovi file in coda"
              >
                <X size={16}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};