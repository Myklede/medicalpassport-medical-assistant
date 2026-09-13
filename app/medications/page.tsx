import type { Metadata } from 'next';
import { MedicationExchangeWorkspace } from './medication-exchange-workspace';

export const metadata: Metadata = {
  title: 'International Medication Match — MediPass',
  description:
    'Compare medication names by active ingredient, strength, dosage form, and Rx/OTC status across four countries.',
};

export default function MedicationExchangePage() {
  return <MedicationExchangeWorkspace />;
}
