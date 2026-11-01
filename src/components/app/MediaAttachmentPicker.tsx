import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  FileText, 
  Film, 
  X, 
  Maximize2, 
  Plus, 
  Paperclip, 
  Check, 
  Sparkles,
  Trash2
} from 'lucide-react';
import { MediaAttachment } from '../../types';

export const NEXORA_STUDIO_ASSETS: MediaAttachment[] = [
  {
    id: 'sample-kyoto',
    name: 'kyoto-atelier-workspace.jpg',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=1000&auto=format&fit=crop&q=80',
    size: '2.4 MB'
  },
  {
    id: 'sample-grid',
    name: 'spatial-editorial-grid.png',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1000&auto=format&fit=crop&q=80',
    size: '1.8 MB'
  },
  {
    id: 'sample-diagram',
    name: 'qualification-engine-diagram.png',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1000&auto=format&fit=crop&q=80',
    size: '920 KB'
  },
  {
    id: 'sample-manifesto',
    name: 'the-quiet-horizon-manifesto.pdf',
    type: 'document',
    url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1000&auto=format&fit=crop&q=80',
    size: '3.1 MB'
  }
];

interface MediaAttachmentPickerProps {
  attachments: MediaAttachment[];
  onChange: (attachments: MediaAttachment[]) => void;
  compact?: boolean;
  label?: string;
  helperText?: string;
  maxAttachments?: number;
}

export default function MediaAttachmentPicker({
  attachments,
  onChange,
  compact = false,
  label = 'Media Attachments',
  helperText = 'Attach images, carousels, video, or documents to accompany this broadcast.',
  maxAttachments = 8
}: MediaAttachmentPickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showAssetDrawer, setShowAssetDrawer] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const processFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const availableSlots = maxAttachments - attachments.length;
    if (availableSlots <= 0) return;

    const filesToProcess = Array.from(files).slice(0, availableSlots);

    filesToProcess.forEach(file => {
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');
      const fileType: MediaAttachment['type'] = isImg ? 'image' : isVid ? 'video' : 'document';
      
      const sizeStr = file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.max(1, Math.round(file.size / 1024))} KB`;

      if (isImg) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newAttachment: MediaAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name,
            type: 'image',
            url: (e.target?.result as string) || '',
            size: sizeStr
          };
          onChange([...attachments, newAttachment]);
        };
        reader.readAsDataURL(file);
      } else {
        const newAttachment: MediaAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          type: fileType,
          url: URL.createObjectURL(file),
          size: sizeStr
        };
        onChange([...attachments, newAttachment]);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (id: string) => {
    onChange(attachments.filter(a => a.id !== id));
  };

  const handleAddSample = (sample: MediaAttachment) => {
    const isAlreadyAttached = attachments.some(a => a.url === sample.url || a.name === sample.name);
    if (isAlreadyAttached) {
      onChange(attachments.filter(a => a.url !== sample.url && a.name !== sample.name));
    } else {
      if (attachments.length < maxAttachments) {
        onChange([...attachments, { ...sample, id: `sample-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }]);
      }
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-3">
      {/* Header with Title and Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <Paperclip className="w-3.5 h-3.5 text-[#A9BFA5]" />
            <label className="text-xs uppercase tracking-wider text-[#E8E9D8] font-medium">
              {label}
            </label>
            {attachments.length > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 bg-[#061816] text-[#A9BFA5] border border-[rgba(169,191,165,0.25)] rounded-[2px]">
                {attachments.length} attached
              </span>
            )}
          </div>
          {helperText && (
            <p className="text-[11px] text-[#A9BFA5]/70 font-light mt-0.5">
              {helperText}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setShowAssetDrawer(prev => !prev)}
            className={`px-2.5 py-1 text-[11px] uppercase tracking-wider border rounded-[2px] transition-colors cursor-pointer flex items-center space-x-1.5 ${
              showAssetDrawer 
                ? 'bg-[#0D2D2A] text-[#E8E9D8] border-[#A9BFA5]' 
                : 'text-[#A9BFA5]/80 border-[rgba(169,191,165,0.2)] hover:text-[#E8E9D8]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-[#A9BFA5]" />
            <span>{showAssetDrawer ? 'Hide Sample Assets' : 'Sample Studio Assets'}</span>
          </button>

          {attachments.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] text-red-400/80 hover:text-red-300 underline transition-colors cursor-pointer pl-1"
            >
              Clear All ({attachments.length})
            </button>
          )}
        </div>
      </div>

      {/* Sample Studio Assets Drawer */}
      {showAssetDrawer && (
        <div className="p-3 bg-[#061816] border border-[rgba(169,191,165,0.25)] rounded-[2px] space-y-2.5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono">
              Nexora Creative Lab Presets (Click to attach/detach)
            </span>
            <span className="text-[10px] text-[#A9BFA5]/50 font-mono">
              High-resolution editorial media
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {NEXORA_STUDIO_ASSETS.map((sample) => {
              const isSelected = attachments.some(a => a.url === sample.url || a.name === sample.name);
              return (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleAddSample(sample)}
                  className={`group relative text-left p-2 border rounded-[2px] transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected 
                      ? 'border-[#A9BFA5] bg-[#0D2D2A]' 
                      : 'border-[rgba(169,191,165,0.2)] bg-[#071C1A] hover:border-[#A9BFA5]/60'
                  }`}
                >
                  <div className="w-full h-16 bg-[#061816] overflow-hidden rounded-[1px] relative mb-1.5">
                    {sample.type === 'image' ? (
                      <img 
                        src={sample.url} 
                        alt={sample.name} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#A9BFA5]/60 bg-[#071C1A]">
                        <FileText className="w-6 h-6 text-[#A9BFA5]" />
                        <span className="text-[9px] uppercase tracking-wider mt-1 font-mono">PDF</span>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-emerald-600 text-white p-0.5 rounded-full shadow-sm">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[#E8E9D8] font-medium truncate">
                      {sample.name}
                    </p>
                    <p className="text-[9px] text-[#A9BFA5]/60 font-mono">
                      {sample.size}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-[2px] transition-all cursor-pointer ${
          compact ? 'p-3' : 'p-5 sm:p-6'
        } flex flex-col items-center justify-center text-center space-y-2 ${
          isDragging 
            ? 'border-[#A9BFA5] bg-[#0D2D2A]/60 scale-[1.005]' 
            : 'border-[rgba(169,191,165,0.25)] bg-[#061816]/60 hover:border-[#A9BFA5]/60 hover:bg-[#0D2D2A]/20'
        }`}
      >
        <input 
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          onChange={(e) => processFiles(e.target.files)}
          className="hidden"
        />

        <div className="w-9 h-9 rounded-full bg-[#0D2D2A] border border-[rgba(169,191,165,0.3)] flex items-center justify-center text-[#A9BFA5]">
          <UploadCloud className="w-4 h-4" />
        </div>

        <div>
          <p className="text-xs text-[#E8E9D8] font-medium">
            <span className="text-[#A9BFA5] underline underline-offset-2">Click to browse</span> or drag and drop media files
          </p>
          <p className="text-[10px] text-[#A9BFA5]/60 font-mono mt-0.5">
            PNG, JPG, WebP, SVG, MP4, PDF · Up to {maxAttachments} items
          </p>
        </div>
      </div>

      {/* Attached Media Cards Grid */}
      {attachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 pt-1">
          {attachments.map((att, idx) => (
            <div 
              key={att.id}
              className="group relative bg-[#061816] border border-[rgba(169,191,165,0.2)] hover:border-[#A9BFA5]/60 p-2 rounded-[2px] flex items-center space-x-3 transition-colors"
            >
              {/* Thumbnail / Icon */}
              <div className="w-12 h-12 bg-[#071C1A] border border-[rgba(169,191,165,0.15)] rounded-[1px] overflow-hidden shrink-0 flex items-center justify-center relative">
                {att.type === 'image' && att.url ? (
                  <img 
                    src={att.url} 
                    alt={att.name} 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover" 
                  />
                ) : att.type === 'video' ? (
                  <Film className="w-5 h-5 text-amber-400" />
                ) : (
                  <FileText className="w-5 h-5 text-[#A9BFA5]" />
                )}

                {/* Index tag */}
                <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-[8px] font-mono text-[#E8E9D8] px-1 rounded-[1px]">
                  #{idx + 1}
                </span>
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#E8E9D8] truncate font-medium" title={att.name}>
                  {att.name}
                </p>
                <div className="flex items-center space-x-2 text-[10px] font-mono text-[#A9BFA5]/70 mt-0.5">
                  <span className="uppercase text-[9px] px-1 py-0.2 bg-[#071C1A] border border-[rgba(169,191,165,0.15)] rounded-[1px]">
                    {att.type}
                  </span>
                  {att.size && <span>{att.size}</span>}
                </div>
              </div>

              {/* Actions: View & Remove */}
              <div className="flex items-center space-x-1 shrink-0">
                {att.type === 'image' && att.url && (
                  <button
                    type="button"
                    onClick={() => setPreviewItem(att)}
                    title="Enlarge preview"
                    className="p-1 text-[#A9BFA5]/60 hover:text-[#E8E9D8] hover:bg-[#071C1A] rounded-[2px] transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(att.id)}
                  title="Remove attachment"
                  className="p-1 text-[#A9BFA5]/60 hover:text-red-400 hover:bg-red-950/20 rounded-[2px] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {previewItem && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setPreviewItem(null)}
        >
          <div 
            className="relative max-w-2xl w-full bg-[#071C1A] border border-[rgba(169,191,165,0.3)] p-4 sm:p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[rgba(169,191,165,0.15)] pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-widest text-[#A9BFA5] font-mono block">
                  ATTACHMENT PREVIEW
                </span>
                <h4 className="text-sm text-[#E8E9D8] font-medium truncate mt-0.5">
                  {previewItem.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="text-[#A9BFA5] hover:text-[#E8E9D8] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full max-h-[60vh] overflow-hidden bg-[#061816] flex items-center justify-center border border-[rgba(169,191,165,0.15)] rounded-[2px]">
              {previewItem.type === 'image' ? (
                <img 
                  src={previewItem.url} 
                  alt={previewItem.name} 
                  referrerPolicy="no-referrer"
                  className="max-h-[60vh] w-auto object-contain" 
                />
              ) : (
                <div className="p-12 text-center text-[#A9BFA5]">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-70" />
                  <p className="text-xs font-mono">{previewItem.name}</p>
                  <p className="text-[10px] font-mono text-[#A9BFA5]/60 mt-1">{previewItem.size}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-[rgba(169,191,165,0.15)]">
              <span className="text-[#A9BFA5]/70">
                Format: <span className="text-[#E8E9D8] uppercase">{previewItem.type}</span> · {previewItem.size || 'Standard asset'}
              </span>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="px-4 py-1.5 bg-[#E8E9D8] text-[#071C1A] text-xs uppercase tracking-wider font-semibold rounded-[2px] hover:bg-white cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
