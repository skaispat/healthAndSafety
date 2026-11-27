import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2, X } from 'lucide-react';
import { FINE_IMAGE_ACCEPT, isHeicFile, normalizeFineImage, validateFineImage } from '../../services/fineService';

interface Props {
  image: File | null;
  onChange: (file: File | null) => void;
  error?: string;
  onError: (message: string | undefined) => void;
  disabled?: boolean;
  /** Lets the parent block submit while a HEIC photo is being converted. */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * Evidence photo picker (camera or gallery) with preview.
 * HEIC/HEIF photos are converted to JPEG on pick so they preview in every browser
 * and upload as a format WhatsApp accepts.
 */
export const FineEvidenceImageField: React.FC<Props> = ({ image, onChange, error, onError, disabled, onBusyChange }) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const pickSeq = useRef(0);

  // Preview object URL lifecycle (no memory leaks)
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const setBusy = (busy: boolean) => {
    setConverting(busy);
    onBusyChange?.(busy);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file) return;

    const err = validateFineImage(file);
    if (err) {
      onError(err);
      return;
    }
    onError(undefined);

    if (!isHeicFile(file)) {
      onChange(file);
      return;
    }

    const seq = ++pickSeq.current;
    setBusy(true);
    try {
      const jpeg = await normalizeFineImage(file);
      if (seq === pickSeq.current) onChange(jpeg);
    } catch (convErr: any) {
      if (seq === pickSeq.current) onError(convErr?.message || 'Could not read this HEIC photo.');
    } finally {
      if (seq === pickSeq.current) setBusy(false);
    }
  };

  const busy = disabled || converting;

  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <span className="form-label">
        Evidence Image <span className="required">*</span>
      </span>

      {converting ? (
        <div className="fine-image-converting" role="status">
          <Loader2 size={18} className="spin" /> Converting HEIC photo...
        </div>
      ) : preview ? (
        <div className="fine-image-preview">
          <img src={preview} alt="Fine evidence preview" />
          {!disabled && (
            <button type="button" className="fine-image-remove" onClick={() => onChange(null)} aria-label="Remove image">
              <X size={16} />
            </button>
          )}
        </div>
      ) : (
        <div className="fine-image-actions">
          <button type="button" className="btn btn-outline" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Camera size={16} /> Take Photo
          </button>
          <button type="button" className="btn btn-outline" onClick={() => galleryRef.current?.click()} disabled={busy}>
            <ImagePlus size={16} /> Choose Image
          </button>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      <input ref={galleryRef} type="file" accept={FINE_IMAGE_ACCEPT} hidden onChange={handleFile} />

      {error ? (
        <span className="fine-field-error">{error}</span>
      ) : (
        <span className="form-hint">JPG, PNG, WebP or HEIC · max 10 MB</span>
      )}
    </div>
  );
};
