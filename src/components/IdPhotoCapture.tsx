"use client";

import { useEffect, useRef, useState } from "react";
import { btnPrimary, btnSecondary } from "@/components/ui";

const MAX_SIDE = 1280;
const CAMERA_HELP =
  "Allow camera access for this site in your browser settings, then try again. If it still fails, use another officer's phone.";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

// Takes the ID photo for a manual entry. Live camera only, with no gallery or
// file upload, so an old saved photo can't be reused.
export function IdPhotoCapture({ onChange }: { onChange: (photo: Blob | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewRef = useRef<string | null>(null);
  const closedRef = useRef(false);
  const [live, setLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }

  function clearPreview() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
  }

  // Leaving the form must turn the camera off and free the preview.
  useEffect(() => {
    closedRef.current = false;
    return () => {
      closedRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  // The video element only exists once the camera is live.
  useEffect(() => {
    const video = videoRef.current;
    if (!live || !video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    video.play().catch(() => {});
  }, [live]);

  async function startCamera() {
    setError(null);
    clearPreview();
    onChange(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(`This browser can't open the camera. ${CAMERA_HELP}`);
      return;
    }
    setStarting(true);
    const constraints = { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } } };
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        // The scanner may still be releasing the camera; denied access won't change.
        if (err instanceof DOMException && err.name === "NotAllowedError") throw err;
        await wait(700);
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      // The form was closed while the camera was still opening.
      if (closedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setLive(true);
    } catch {
      setError(`Couldn't open the camera. ${CAMERA_HELP}`);
    } finally {
      setStarting(false);
    }
  }

  async function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError("The camera isn't ready yet. Wait a moment and try again.");
      return;
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    let blob = await toJpeg(canvas, 0.72);
    if (blob && blob.size > 900 * 1024) blob = await toJpeg(canvas, 0.5);
    if (!blob) {
      setError("The photo couldn't be saved. Try again.");
      return;
    }
    stopCamera();
    clearPreview();
    previewRef.current = URL.createObjectURL(blob);
    setPreview(previewRef.current);
    onChange(blob);
  }

  return (
    <div>
      <p className="text-sm font-medium text-slate-700">Photo of the student&apos;s ID</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Required. Fit the whole ID in the frame and make sure the name can be read. Admins check it against this
        entry.
      </p>

      {live && (
        <div className="relative mt-2 overflow-hidden rounded-lg bg-black">
          <video ref={videoRef} autoPlay muted playsInline className="max-h-72 w-full object-contain" />
          <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-gold-400" aria-hidden="true" />
        </div>
      )}

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview of the photo just taken
        <img src={preview} alt="ID photo just taken" className="mt-2 max-h-72 w-full rounded-lg bg-black object-contain" />
      )}

      <div className="mt-2">
        {live ? (
          <button type="button" onClick={takePhoto} className={`${btnPrimary} w-full`}>
            Take photo
          </button>
        ) : (
          <button type="button" onClick={startCamera} disabled={starting} className={`${btnSecondary} w-full`}>
            {starting ? "Opening camera..." : preview ? "Retake photo" : "Open camera"}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
