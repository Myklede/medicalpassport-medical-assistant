import MediPassBrand from '@/components/medipass-brand';
import { ArrowRight, Database, FileHeart, MessageSquare, ShieldCheck, Smartphone, Stethoscope } from 'lucide-react';
import Link from '@/components/app-link';

export default function Home() {
  return <main className="mp-lobby">
    <header className="mp-lobby-nav">
      <Link href="/" className="inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600"><MediPassBrand /></Link>
      <p><ShieldCheck />Private demo · synthetic data</p>
    </header>

    <section className="mp-lobby-hero" data-annotate="lobby-hero" data-annotation-label="MediPass lobby">
      <p className="mp-lobby-kicker">PORTABLE MEDICAL PASSPORT</p>
      <h1>One record.<br />Two perspectives.</h1>
      <p className="mp-lobby-lead">Clinicians document each visit. Patients review the same information in plain language.</p>

      <div className="mp-lobby-choices">
        <Link href="/editor" className="mp-lobby-choice primary"><span><Stethoscope /></span><div><strong>Clinical portal</strong><small>Create and edit records</small></div><ArrowRight /></Link>
        <Link href="/patient" className="mp-lobby-choice"><span><FileHeart /></span><div><strong>Patient view</strong><small>Review history and explanations</small></div><ArrowRight /></Link>
      </div>

      <div className="mp-lobby-links">
        <Link href="/mobile"><Smartphone />Preview mobile layout</Link>
        <Link href="/data"><Database />Data & Supabase</Link>
        <Link href="/feedback"><MessageSquare />Change requests</Link>
      </div>
    </section>

    <footer className="mp-lobby-footer"><span>Product prototype · not for diagnosis</span><span>Buffalo, New York</span></footer>
  </main>;
}
