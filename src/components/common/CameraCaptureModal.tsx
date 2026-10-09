import React, { useRef, useState, useEffect } from 'react';
import { X, SwitchCamera, Camera, AlertCircle, RefreshCw } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => Promise<void> | void;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Take Photo',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(true);

  // Stop camera tracks cleanly
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Start camera stream
  const startCamera = async (mode: 'environment' | 'user') => {
    stopStream();
    setErrorMsg(null);
    setIsStarting(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('Live camera streaming is not supported on this browser. Use native camera instead.');
      setIsStarting(false);
      return;
    }

    try {
      // Check available video devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      } catch (_) {}

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('getUserMedia error:', err);
      // Fallback try with generic video constraint
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (fallbackErr: any) {
        setErrorMsg(
          err.name === 'NotAllowedError'
            ? 'Camera access permission was denied. Please allow camera access in your browser settings.'
            : 'Could not connect to camera hardware. Tap below to use device camera.'
        );
      }
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopStream();
    }

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode]);

  // Flip camera toggle
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Shutter capture
  const handleCapture = async () => {
    if (!videoRef.current || isCapturing) return;

    const video = videoRef.current;
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    if (width === 0 || height === 0) return;

    setIsCapturing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // If front camera, mirror image back to normal
      if (facingMode === 'user') {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, width, height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            setIsCapturing(false);
            return;
          }

          const fileName = `capture_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
          const file = new File([blob], fileName, { type: 'image/jpeg' });

          try {
            await onCapture(file);
          } finally {
            setIsCapturing(false);
            onClose();
          }
        },
        'image/jpeg',
        0.92
      );
    } catch (err) {
      console.error('Error capturing photo:', err);
      setIsCapturing(false);
    }
  };

  // Fallback native input handler
  const handleFallbackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onCapture(e.target.files[0]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
          zIndex: 10,
        }}
      >
        <span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.02em' }}>
          {title}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Flip Camera Button */}
          <button
            type="button"
            onClick={handleFlipCamera}
            disabled={isStarting || isCapturing}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
            title={`Flip Camera (${facingMode === 'environment' ? 'Switch to Front' : 'Switch to Back'})`}
          >
            <SwitchCamera size={20} />
          </button>

          {/* Close Modal Button */}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
            }}
            title="Close Camera"
          >
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Camera Live Viewport */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: '#090d16',
        }}
      >
        {/* Error overlay or permission warning */}
        {errorMsg ? (
          <div
            style={{
              padding: '24px',
              maxWidth: '360px',
              textAlign: 'center',
              color: '#ffffff',
              background: 'rgba(30, 41, 59, 0.95)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <AlertCircle size={36} color="#f87171" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '16px', color: '#cbd5e1' }}>
              {errorMsg}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => fallbackInputRef.current?.click()}
              >
                <Camera size={16} />
                Open Device Camera
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => startCamera(facingMode)}
              >
                <RefreshCw size={14} /> Retry Live Camera
              </button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            }}
          />
        )}

        {/* Shutter capture flash effect */}
        {isCapturing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#ffffff',
              opacity: 0.8,
              transition: 'opacity 0.1s ease',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Camera mode badge */}
        {!errorMsg && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: '16px',
              background: 'rgba(0, 0, 0, 0.55)',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: '12px',
              backdropFilter: 'blur(4px)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {facingMode === 'environment' ? 'Back Camera' : 'Front Camera'}
          </div>
        )}
      </div>

      {/* Bottom Controls / Shutter Bar */}
      <div
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 10,
        }}
      >
        {/* Secondary Flip Button for convenient bottom thumb tap */}
        <button
          type="button"
          onClick={handleFlipCamera}
          disabled={Boolean(errorMsg) || isCapturing}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            borderRadius: '50%',
            width: '46px',
            height: '46px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Flip Camera"
        >
          <SwitchCamera size={22} />
        </button>

        {/* Central Shutter Button */}
        <button
          type="button"
          onClick={handleCapture}
          disabled={Boolean(errorMsg) || isCapturing || isStarting}
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'transparent',
            border: '4px solid #ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '4px',
            boxShadow: '0 0 15px rgba(0, 0, 0, 0.5)',
            transition: 'transform 0.1s ease',
          }}
          title="Capture Photo"
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: isCapturing ? '#dc2626' : '#ffffff',
              transition: 'background-color 0.1s ease',
            }}
          />
        </button>

        {/* Fallback Device Camera Input trigger */}
        <button
          type="button"
          onClick={() => fallbackInputRef.current?.click()}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            borderRadius: '50%',
            width: '46px',
            height: '46px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Device Native Camera"
        >
          <Camera size={22} />
        </button>
      </div>

      {/* Hidden native input for fallback */}
      <input
        ref={fallbackInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFallbackFile}
      />
    </div>
  );
};
