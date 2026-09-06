"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_RECORDING_MS } from "@/lib/ai/speech-limits";

export type RecorderState =
  | "unsupported"
  | "ready"
  | "listening"
  | "processing"
  | "completed"
  | "error";

/** Candidate containers, best first. Safari has no WebM, so MP4 is the fallback. */
const PREFERRED_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Microphone recording with explicit states.
 *
 * The permission prompt is only triggered when the teacher presses the button,
 * never on page load — a tool that asks for the microphone the moment it opens
 * teaches people to dismiss the prompt.
 *
 * The stream is stopped after every recording so the browser's recording
 * indicator goes off; leaving it open would keep a live mic in a classroom.
 */
export function useRecorder({
  onComplete,
}: {
  onComplete: (audio: Blob) => void | Promise<void>;
}) {
  const [state, setState] = useState<RecorderState>("ready");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setState("unsupported");
      setError(
        "This browser cannot record audio. Try Chrome on the tablet, and make sure the page is served over HTTPS.",
      );
    }
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
    timerRef.current = null;
    stopTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          // Sarvam's models are tuned for 16kHz; asking for it up front avoids
          // a resample and keeps the upload small on a slow connection.
          sampleRate: 16_000,
          channelCount: 1,
        },
      });
    } catch (cause) {
      setState("error");
      const name = cause instanceof Error ? cause.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access was blocked. Allow the microphone for this site in your browser settings, then try again."
          : name === "NotFoundError"
            ? "No microphone was found on this device."
            : "Could not start the microphone. Close other apps using it and try again.",
      );
      return;
    }

    streamRef.current = stream;

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      cleanup();
      setState("error");
      setError("This browser cannot record in a supported audio format.");
      return;
    }

    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onerror = () => {
      cleanup();
      setState("error");
      setError("Recording stopped unexpectedly. Try again.");
    };

    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      cleanup();
      setState("processing");
      void Promise.resolve(onComplete(blob)).catch(() => {
        setState("error");
      });
    };

    recorder.start();
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setState("listening");

    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 100);

    // Hard cap, so a button left pressed does not upload minutes of room noise.
    stopTimerRef.current = window.setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    }, MAX_RECORDING_MS);
  }, [cleanup, onComplete]);

  return {
    state,
    setState,
    error,
    setError,
    elapsedMs,
    start,
    stop,
    isRecording: state === "listening",
  };
}
