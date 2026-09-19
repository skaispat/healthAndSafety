import React, { useRef, useState, useEffect } from 'react';
import { Camera, ImagePlus, X, AlertCircle, Eye, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Cloud } from 'lucide-react';
import { DataService } from '../../services/dataService';

export interface UploadedPhoto {
  url: string;
  file_name: string;
  isCloud?: boolean;
}

interface PhotoUploaderProps {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  maxPhotos?: number;
  maxSizeBytes?: number; // default 10MB
  compact?: boolean;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  photos,
  onChange,
  maxPhotos = 10,
  maxSizeBytes = 10 * 1024 * 1024,
  compact = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewIndex(null);
      if (previewIndex !== null) {
        if (e.key === 'ArrowLeft') handlePrevPreview();
        if (e.key === 'ArrowRight') handleNextPreview();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewIndex, photos.length]);

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setWarningMsg(null);

    const validExtensions = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const filesToUpload: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (photos.length + filesToUpload.length >= maxPhotos) {
        setErrorMsg(`Maximum limit of ${maxPhotos} photos reached.`);
        break;
      }

      if (!validExtensions.includes(file.type.toLowerCase())) {
        setErrorMsg(`"${file.name}" is not a valid format. Only JPG, PNG, and WebP are allowed.`);
        continue;
      }

      if (file.size > maxSizeBytes) {
        setErrorMsg(`"${file.name}" exceeds maximum allowed size of 10MB.`);
        continue;
      }

      filesToUpload.push(file);
    }

    if (filesToUpload.length === 0) return;

    setUploadingCount(filesToUpload.length);

    try {
      const uploadPromises = filesToUpload.map(async (file) => {
        const res = await DataService.uploadObservationPhoto(file);
        if (res.error) {
          setWarningMsg(
            `Bucket note: Upload to 'observation' bucket reported: "${res.error}". Image attached with local preview.`
          );
        }
        return {
          url: res.url,
          file_name: res.file_name,
          isCloud: res.isCloud,
        };
      });

      const uploadedResults = await Promise.all(uploadPromises);
      const validResults = uploadedResults.filter((p) => Boolean(p.url));
      onChange([...photos, ...validResults]);
    } catch (err: any) {
      console.error('Error uploading photos:', err);
      setErrorMsg(err.message || 'Error processing photos.');
    } finally {
      setUploadingCount(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const handleRemove = (index: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = photos.filter((_, i) => i !== index);
    onChange(updated);
    if (previewIndex !== null) {
      if (previewIndex >= updated.length) {
        setPreviewIndex(updated.length > 0 ? updated.length - 1 : null);
      }
    }
  };

  const handlePrevPreview = () => {
    if (previewIndex !== null && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  };

  const handleNextPreview = () => {
    if (previewIndex !== null && previewIndex < photos.length - 1) {
      setPreviewIndex(previewIndex + 1);
    }
  };

  const isAtLimit = photos.length >= maxPhotos;

  return (
    <div>
      {/* Upload Controls & Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: compact ? '8px' : '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAtLimit || uploadingCount > 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ImagePlus size={15} />
            <span>{compact ? (photos.length > 0 ? `Add (${photos.length}/${maxPhotos})` : 'Add Photo') : `Add Photos (${photos.length}/${maxPhotos})`}</span>
          </button>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isAtLimit || uploadingCount > 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Take photo"
          >
            <Camera size={15} />
            <span>Take Photo</span>
          </button>
        </div>

        {uploadingCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--brand-primary)', fontWeight: 600 }}>
            <Loader2 size={15} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
            <span>{compact ? 'Uploading...' : `Uploading to 'observation' bucket (${uploadingCount} files)...`}</span>
          </div>
        )}
      </div>

      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/jpg"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Alerts / Error feedback */}
      {errorMsg && (
        <div style={{ color: 'var(--hazard-high)', background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {warningMsg && (
        <div style={{ color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 12px', borderRadius: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{warningMsg}</span>
        </div>
      )}

      {/* Grid of uploaded thumbnails with interactive preview */}
      {photos.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? 'repeat(auto-fill, minmax(72px, 1fr))' : 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: compact ? '8px' : '12px',
            marginBottom: '10px',
          }}
        >
          {photos.map((photo, index) => (
            <div
              key={index}
              onClick={() => setPreviewIndex(index)}
              style={{
                position: 'relative',
                aspectRatio: '1 / 1',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1.5px solid var(--border-subtle)',
                background: '#f8fafc',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
              title="Click to preview full image"
            >
              <img
                src={photo.url}
                alt={photo.file_name || `Observation Photo ${index + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* Status Badge */}
              {photo.isCloud ? (
                <div
                  style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '4px',
                    background: 'rgba(15, 23, 42, 0.75)',
                    color: '#10b981',
                    borderRadius: '4px',
                    padding: '2px 4px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                  title="Stored in observation bucket"
                >
                  <Cloud size={10} />
                  <span>Cloud</span>
                </div>
              ) : null}

              {/* Hover overlay hint */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.25)',
                  opacity: 0,
                  transition: 'opacity 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                <Eye size={20} />
              </div>

              {/* Remove Button */}
              <button
                type="button"
                onClick={(e) => handleRemove(index, e)}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: 'rgba(220, 38, 38, 0.9)',
                  color: '#ffffff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 2,
                }}
                title="Remove photo"
              >
                <X size={12} />
              </button>
            </div>
          ))}

          {/* Add more slot if under limit */}
          {!isAtLimit && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: '8px',
                border: '2px dashed var(--border-subtle)',
                background: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                gap: '4px',
                color: 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--brand-primary)';
                e.currentTarget.style.background = '#fef2f2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <ImagePlus size={22} color="var(--brand-primary)" />
              <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>Add More</span>
            </div>
          )}
        </div>
      )}

      {/* Empty Dropzone */}
      {!compact && photos.length === 0 && (
        <div
          className="photo-uploader-zone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('dragover');
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('dragover');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('dragover');
            processFiles(e.dataTransfer.files);
          }}
        >
          <ImagePlus size={36} color="var(--brand-primary)" style={{ margin: '0 auto 8px auto' }} />
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Click or drag & drop inspection photos here
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Supports multiple JPG, PNG, and WebP.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHOTO PREVIEW LIGHTBOX MODAL BEFORE SUBMISSION                            */}
      {/* ========================================================================= */}
      {previewIndex !== null && photos[previewIndex] && (
        <div
          onClick={() => setPreviewIndex(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#ffffff',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '12px 18px',
                background: '#ffffff',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                  Photo {previewIndex + 1} of {photos.length}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {photos[previewIndex].file_name || 'Observation Image'}
                </span>
                {photos[previewIndex].isCloud && (
                  <span style={{ fontSize: '0.7rem', color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    Cloud Bucket
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ color: '#dc2626', borderColor: '#fecaca' }}
                  onClick={() => handleRemove(previewIndex)}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setPreviewIndex(null)}
                  style={{ padding: '6px', borderRadius: '6px' }}
                  aria-label="Close preview"
                >
                  <X size={20} color="var(--text-secondary)" />
                </button>
              </div>
            </div>

            {/* Modal Image Body with Next / Prev */}
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
                overflow: 'hidden',
                minWidth: '320px',
                minHeight: '260px',
              }}
            >
              <img
                src={photos[previewIndex].url}
                alt={photos[previewIndex].file_name || 'Preview'}
                style={{
                  maxWidth: '85vw',
                  maxHeight: '75vh',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />

              {/* Prev Button */}
              {previewIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrevPreview}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.85)',
                    color: '#0f172a',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                  }}
                  title="Previous photo (Left Arrow)"
                >
                  <ChevronLeft size={22} />
                </button>
              )}

              {/* Next Button */}
              {previewIndex < photos.length - 1 && (
                <button
                  type="button"
                  onClick={handleNextPreview}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.85)',
                    color: '#0f172a',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                  }}
                  title="Next photo (Right Arrow)"
                >
                  <ChevronRight size={22} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
