import MediPassBrand from '@/components/medipass-brand';
import { ArrowRight, Database, FileHeart, MessageSquare, ShieldCheck, Smartphone, Stethoscope } from 'lucide-react';
import Link from '@/components/app-link';

export default function Home() {
  return <main className="mp-lobby">
    <header className="mp-lobby-nav">
      <Link href="/" className="inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-blue-600"><MediPassBrand /></Link>
      <p><ShieldCheck />Demo riêng · dữ liệu giả lập</p>
    </header>

    <section className="mp-lobby-hero" data-annotate="lobby-hero" data-annotation-label="Trang sảnh MediPass">
      <p className="mp-lobby-kicker">HỘ CHIẾU Y TẾ DI ĐỘNG</p>
      <h1>Một hồ sơ.<br />Hai góc nhìn.</h1>
      <p className="mp-lobby-lead">Bác sĩ ghi nhận từng lần khám. Người bệnh xem lại cùng dữ liệu đó bằng ngôn ngữ dễ hiểu.</p>

      <div className="mp-lobby-choices">
        <Link href="/editor" className="mp-lobby-choice primary"><span><Stethoscope /></span><div><strong>Cổng bệnh viện</strong><small>Nhập và chỉnh sửa hồ sơ</small></div><ArrowRight /></Link>
        <Link href="/patient" className="mp-lobby-choice"><span><FileHeart /></span><div><strong>Góc nhìn bệnh nhân</strong><small>Xem lịch sử và chú giải</small></div><ArrowRight /></Link>
      </div>

      <div className="mp-lobby-links">
        <Link href="/mobile"><Smartphone />Thử giao diện điện thoại</Link>
        <Link href="/data"><Database />Dữ liệu & Supabase</Link>
        <Link href="/feedback"><MessageSquare />Yêu cầu chỉnh sửa</Link>
      </div>
    </section>

    <footer className="mp-lobby-footer"><span>Bản mô phỏng sản phẩm · không dùng để chẩn đoán</span><span>Buffalo, New York</span></footer>
  </main>;
}
