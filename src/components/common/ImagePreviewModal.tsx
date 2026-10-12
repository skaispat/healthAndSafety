import React, { useEffect, useState } from 'react';
import { X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
  subtitle?: string;
  badge?: {
    text: string;
    bg?: string;
    color?: string;
  };
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Image Preview',
  subtitle,
  badge,
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isImgLoaded, setIsImgLoaded] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      setScale(1);
      setRotation(0);
      setIsImgLoaded(false);
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, imageUrl]);

  if (!isOpen || !imageUrl) return null;

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'photo'}.jpg`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      {/* Top Header Bar */}
      <div
        style={{
          width: '100%',
          maxWidth: '1000px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '10px 16px',
          background: 'rgba(30, 41, 59, 0.85)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          color: '#ffffff',
          flexShrink: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {badge && (
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: badge.bg || 'rgba(2, 132, 199, 0.2)',
                color: badge.color || '#38bdf8',
                border: '1px solid rgba(255,255,255,0.1)',
                whiteSpace: 'nowrap',
              }}
            >
              {badge.text}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                fontSize: '0.98rem',
                fontWeight: 700,
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: '#f8fafc',
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                style={{
                  fontSize: '0.76rem',
                  margin: '2px 0 0 0',
                  color: '#94a3b8',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '7px',
              color: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ZoomIn size={16} />
          </button>

          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '7px',
              color: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ZoomOut size={16} />
          </button>

          <button
            type="button"
            onClick={handleRotate}
            title="Rotate Clockwise"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '7px',
              color: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RotateCw size={16} />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            title="Download Image"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '7px',
              color: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Download size={16} />
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close Preview (Esc)"
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '8px',
              padding: '7px',
              color: '#fca5a5',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '16px 0',
          position: 'relative',
        }}
        onClick={(e) => {
          // If clicked outside the image itself, close modal
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {!isImgLoaded && (
          <div
            style={{
              position: 'absolute',
              color: '#94a3b8',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.2)',
                borderTopColor: '#38bdf8',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <span>Loading image...</span>
          </div>
        )}

        <img
          src={imageUrl}
          alt={title}
          onLoad={() => setIsImgLoaded(true)}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: '92vw',
            maxHeight: '78vh',
            objectFit: 'contain',
            borderRadius: '10px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65)',
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
            cursor: scale > 1 ? 'grab' : 'default',
            display: isImgLoaded ? 'block' : 'none',
          }}
        />
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: '6px 14px',
          background: 'rgba(15, 23, 42, 0.7)',
          borderRadius: '20px',
          fontSize: '0.74rem',
          color: '#94a3b8',
          letterSpacing: '0.3px',
          flexShrink: 0,
        }}
      >
        Press <span style={{ color: '#fff', fontWeight: 600 }}>Esc</span> or click background to close • Zoom: {Math.round(scale * 100)}%
      </div>
    </div>
  );
};
