import type { Metadata } from 'next';
import { MedicationExchangeWorkspace } from './medication-exchange-workspace';

export const metadata: Metadata = {
  title: 'Đối chiếu thuốc quốc tế — MediPass',
  description:
    'Demo đối chiếu tên thuốc theo hoạt chất, hàm lượng, dạng dùng và phân loại Rx/OTC giữa bốn quốc gia.',
};

export default function MedicationExchangePage() {
  return <MedicationExchangeWorkspace />;
}
