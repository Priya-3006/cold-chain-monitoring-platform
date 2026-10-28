import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Upload, Check, RefreshCw, MapPin } from 'lucide-react';
import { uploadApi } from '../api/client.js';

export default function PhotoCaptureModal({
  isOpen,
  onClose,
  onPhotoUploaded,
  title = 'Capture Physical Verification Photo',
  fileType = 'PHOTO_DOOR',
  defaultGps = { lat: 13.0567, lng: 80.2520 }
}) {
  const [photoData, setPhotoData] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(defaultGps);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setPhotoData(null);
      return;
    }

    // Try to get geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6))
          });
        },
        () => {
          // Use default simulated GPS
        }
      );
    }
  }, [isOpen]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Camera access denied or unavailable, please use file upload');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhotoData(dataUrl);
    stopCamera();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoData(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitProof = async () => {
    if (!photoData) return;
    try {
      setIsUploading(true);
      const res = await uploadApi.uploadProofPhoto({
        base64Data: photoData,
        fileType,
        latitude: gpsCoords.lat,
        longitude: gpsCoords.lng
      });
      onPhotoUploaded(res.proofFile);
      onClose();
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-sky-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* Viewport: Captured image or Camera stream */}
          <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">
            {photoData ? (
              <img src={photoData} alt="Captured proof" className="w-full h-full object-cover" />
            ) : isCameraActive ? (
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-6 text-slate-400">
                <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Camera preview will appear here</p>
              </div>
            )}

            {/* GPS Metadata Overlay Badge */}
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-[10px] text-white flex items-center gap-1 font-mono">
              <MapPin className="w-3 h-3 text-sky-400" />
              <span>{gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}</span>
              <span className="text-slate-400">•</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-2">
            {!photoData && !isCameraActive && (
              <button
                type="button"
                onClick={startCamera}
                className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Camera className="w-4 h-4" />
                Start Camera
              </button>
            )}

            {isCameraActive && !photoData && (
              <button
                type="button"
                onClick={captureFrame}
                className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Check className="w-4 h-4" />
                Capture Snapshot
              </button>
            )}

            {photoData && (
              <button
                type="button"
                onClick={() => setPhotoData(null)}
                className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retake Photo
              </button>
            )}

            {/* File Upload Option */}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                id="photo-file-input"
                className="hidden"
              />
              <label
                htmlFor="photo-file-input"
                className="w-full py-2 px-4 border border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                Choose photo from files
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-white dark:bg-slate-900">
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            disabled={!photoData || isUploading}
            onClick={handleSubmitProof}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-colors flex items-center gap-2"
          >
            {isUploading ? 'Uploading...' : 'Save & Submit Proof'}
          </button>
        </div>
      </div>
    </div>
  );
}
