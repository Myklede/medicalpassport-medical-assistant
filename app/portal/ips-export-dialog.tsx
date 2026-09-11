'use client';

import { Download, FileJson, Globe2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { Encounter, Patient, StorageStatus } from '@/lib/portal-types';
import { currentMedicines } from '@/lib/lab-interpretation';

export function IpsExportDialog({
  patient,
  encounters,
  storage,
}: {
  patient: Patient;
  encounters: Encounter[];
  storage: StorageStatus;
}) {
  const activeMedicines = currentMedicines(encounters).length;
  const parameters = new URLSearchParams({ patient_id: patient.id });
  const baseUrl = `/api/portal/ips?${parameters.toString()}`;
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <Globe2 /> Xuất IPS
      </DialogTrigger>
      <DialogContent className="mp-form-dialog mp-ips-dialog">
        <DialogHeader>
          <div className="mp-ips-dialog-icon">
            <Globe2 />
          </div>
          <DialogTitle>Hộ chiếu Y tế Quốc tế</DialogTitle>
          <DialogDescription>
            Xuất bản tóm tắt dựa trên HL7 FHIR International Patient Summary
            2.0.1 (FHIR R4).
          </DialogDescription>
        </DialogHeader>

        <div className="mp-ips-patient">
          <strong>{patient.display_name}</strong>
          <span>
            {patient.medical_record_number} · {encounters.length} lần khám ·{' '}
            {activeMedicines} thuốc đang dùng
          </span>
          <small>Nguồn tại thời điểm xuất: {storage.label}</small>
        </div>

        <div className="mp-ips-privacy" role="note">
          <ShieldAlert />
          <div>
            <strong>Tài liệu chứa dữ liệu sức khỏe định danh</strong>
            <p>
              Chỉ tải xuống khi thiết bị và người nhận phù hợp. MediPass không
              tự gửi tài liệu cho bên thứ ba.
            </p>
          </div>
        </div>

        <ul className="mp-ips-checks">
          <li>
            PDF dễ đọc có đính kèm chính FHIR Bundle JSON dùng để tạo tài liệu.
          </li>
          <li>
            Thuốc chỉ có INN/WHO ATC khi khớp chắc chắn với danh mục đã kiểm
            duyệt; mục chưa khớp giữ nguyên tên gốc.
          </li>
          <li>
            Bản xuất là bản sơ bộ, chưa được bác sĩ ký/xác nhận và không thay
            thế hồ sơ nguồn hay đơn thuốc.
          </li>
          <li>
            Dữ liệu chưa có được đánh dấu là không khả dụng/không rõ; danh sách
            trống không bị diễn giải thành “không có bệnh, dị ứng hay thuốc”.
          </li>
        </ul>

        <div className="mp-ips-actions">
          <a className="mp-ips-download primary" href={`${baseUrl}&format=pdf`}>
            <Download />
            <span>
              <strong>Tải PDF + FHIR đính kèm</strong>
              <small>Dành để đọc và xuất trình</small>
            </span>
          </a>
          <a className="mp-ips-download" href={`${baseUrl}&format=json`}>
            <FileJson />
            <span>
              <strong>Tải riêng FHIR JSON</strong>
              <small>Dành cho hệ thống lâm sàng</small>
            </span>
          </a>
        </div>

        <p className="mp-ips-disclaimer">
          Hãy nhờ bác sĩ hoặc pharmacist đối chiếu hồ sơ, bao bì/đơn gốc, dị ứng
          và tình trạng hiện tại trước khi dùng tài liệu cho cấp cứu, du lịch,
          mua hay đổi thuốc.
        </p>
      </DialogContent>
    </Dialog>
  );
}
