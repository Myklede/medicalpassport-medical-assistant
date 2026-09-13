'use client';

import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  LockKeyhole,
  Play,
  ShieldCheck,
  Square,
  VideoOff,
} from 'lucide-react';
import Link from '@/components/app-link';
import MediPassBrand from '@/components/medipass-brand';
import { useEffect, useRef, useState } from 'react';

import { therapyPoseStatus } from '@/lib/vision/therapy-pose';

export function TherapyWorkspace() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [exercise, setExercise] = useState('sit-to-stand');
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  async function startCamera() {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setCameraError('Camera access was not granted. You can return here after changing browser permissions.');
      setCameraOn(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/patient" className="grid size-11 place-items-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary" aria-label="Back to MediPass">
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/" className="flex min-h-11 items-center rounded-xl focus-visible:outline-2 focus-visible:outline-primary" aria-label="MediPass home"><MediPassBrand compact subtitle="MOTION LAB" /></Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
          <section>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
              <Activity className="size-3.5" /> Privacy-first scaffold
            </span>
            <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Prepare the camera workflow before claiming movement accuracy.</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
              The live preview stays on this device. A future pose adapter can calculate joint angles, repetitions, and exercise-specific deviations without saving raw video by default.
            </p>

            <div className="mt-7 overflow-hidden rounded-3xl border border-border bg-[#0F172A] text-white shadow-xl shadow-slate-950/10">
              <div className="relative aspect-video">
                <video ref={videoRef} muted playsInline className={`size-full object-cover ${cameraOn ? 'block' : 'hidden'}`} />
                {!cameraOn && (
                  <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_center,#1e293b_0%,#020617_70%)] p-6 text-center">
                    <div>
                      <VideoOff className="mx-auto size-10 text-slate-400" />
                      <p className="mt-4 text-sm font-semibold text-slate-200">Camera is off</p>
                      <p className="mt-1 text-xs text-slate-400">No video is being recorded or uploaded.</p>
                    </div>
                  </div>
                )}
                <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur">
                  {cameraOn ? 'LIVE · on device' : 'OFFLINE'}
                </div>
                <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/80 p-3 backdrop-blur">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{exercise === 'sit-to-stand' ? 'Sit to stand' : exercise === 'knee-extension' ? 'Seated knee extension' : 'Shoulder abduction'}</p>
                    <p className="text-xs text-slate-400">Pose model not connected</p>
                  </div>
                  {cameraOn ? (
                    <button type="button" onClick={stopCamera} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-white"><Square className="size-3.5 fill-current" /> Stop</button>
                  ) : (
                    <button type="button" onClick={() => void startCamera()} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-white"><Play className="size-4 fill-current" /> Preview camera</button>
                  )}
                </div>
              </div>
            </div>
            {cameraError && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{cameraError}</p>}
          </section>

          <aside className="space-y-4">
            <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <label htmlFor="exercise" className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">Exercise protocol</label>
              <select id="exercise" value={exercise} onChange={(event) => setExercise(event.target.value)} className="mt-3 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                <option value="sit-to-stand">Sit to stand</option>
                <option value="knee-extension">Seated knee extension</option>
                <option value="shoulder-abduction">Shoulder abduction</option>
              </select>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                <Metric label="Repetitions" value="—" />
                <Metric label="Range of motion" value="—" />
                <Metric label="Form deviations" value="—" />
                <Metric label="Session status" value="Not started" />
              </dl>
            </article>

            <article className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="flex items-center gap-2"><CircleHelp className="size-4" /><h2 className="text-sm font-semibold">Honest model state</h2></div>
              <p className="mt-3 text-sm leading-6 opacity-90">{therapyPoseStatus.message}</p>
              <p className="mt-3 text-xs leading-5 opacity-80">The interface intentionally shows no score or correction until a validated pose model and exercise rules are connected.</p>
            </article>

            <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-blue-700 dark:text-blue-300" /><h2 className="text-sm font-semibold">Integration boundary</h2></div>
              <ul className="mt-4 space-y-3 text-sm leading-5 text-muted-foreground">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> Browser camera with no audio</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> Typed pose-frame and session-result contract</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" /> Raw video remains unsaved by default</li>
              </ul>
            </article>
          </aside>
        </div>

        <footer className="mt-7 flex flex-col items-center justify-between gap-2 border-t border-border py-5 text-xs text-muted-foreground sm:flex-row">
          <p>Research scaffold · clinician-defined exercise rules required before a real pilot.</p>
          <p className="flex items-center gap-1.5"><LockKeyhole className="size-3.5" /> Local preview only · no video upload</p>
        </footer>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/60 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}
