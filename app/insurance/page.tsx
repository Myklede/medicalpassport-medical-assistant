import type { Metadata } from 'next';

import { InsuranceWorkspace } from './insurance-workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kiểm tra chính sách bảo hiểm — MediPass',
  description:
    'Lưu và tái sử dụng SBC để tạo ước tính quyền lợi có điều kiện và dẫn chiếu nguồn.',
};

export default function InsurancePage() {
  return <InsuranceWorkspace />;
}
