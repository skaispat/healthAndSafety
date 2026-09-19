import React, { useState } from 'react';
import { Maximize2, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoGalleryProps {
  photos?: { photo_url: string; file_name?: string }[];
  emptyMessage?: string;
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos = [],
  emptyMessage = 'No photos attached',
}) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (!photos || photos.length === 0) {
    return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emptyMessage}</span>;
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeIdx !== null) {
      setActiveIdx((activeIdx + 1) % photos.length);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeIdx !== null) {
      setActiveIdx((activeIdx - 1 + photos.length) % photos.length);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {photos.map((p, idx) => (
          <div
            key={idx}
            onClick={() => setActiveIdx(idx)}
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '8px',
              overflow: 'hidden',
              cursor: 'pointer',
              border: '1px solid var(--border-subtle)',
              position: 'relative',
              background: '#000',
            }}
            title="Click to expand"
          >
            <img
              src={p.photo_url}
              alt={p.file_name || `Photo ${idx + 1}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
            >
              <Maximize2 size={16} color="#fff" />
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {activeIdx !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.92)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setActiveIdx(null)}
        >
          <button
            onClick={() => setActiveIdx(null)}
            className="btn-ghost"
            style={{
              position: 'absolute',
              top: '20px',
              right: '24px',
              color: '#fff',
              fontSize: '24px',
              padding: '8px',
            }}
          >
            <X size={28} />
          </button>

          {photos.length > 1 && (
            <button
              onClick={handlePrev}
              className="btn-ghost"
              style={{
                position: 'absolute',
                left: '20px',
                color: '#fff',
                padding: '12px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
              }}
            >
              <ChevronLeft size={32} />
            </button>
          )}

          <div
            style={{ maxWidth: '90vw', maxHeight: '85vh', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[activeIdx].photo_url}
              alt="Expanded view"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
              }}
            />
            <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '12px' }}>
              {photos[activeIdx].file_name || `Photo ${activeIdx + 1} of ${photos.length}`}
            </div>
          </div>

          {photos.length > 1 && (
            <button
              onClick={handleNext}
              className="btn-ghost"
              style={{
                position: 'absolute',
                right: '20px',
                color: '#fff',
                padding: '12px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
              }}
            >
              <ChevronRight size={32} />
            </button>
          )}
        </div>
      )}
    </>
  );
};
