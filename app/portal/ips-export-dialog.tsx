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
        <Globe2 /> Export IPS
      </DialogTrigger>
      <DialogContent className="mp-form-dialog mp-ips-dialog">
        <DialogHeader>
          <div className="mp-ips-dialog-icon">
            <Globe2 />
          </div>
          <DialogTitle>International Patient Summary</DialogTitle>
          <DialogDescription>
            Export an HL7 FHIR International Patient Summary
            2.0.1 (FHIR R4).
          </DialogDescription>
        </DialogHeader>

        <div className="mp-ips-patient">
          <strong>{patient.display_name}</strong>
          <span>
            {patient.medical_record_number} · {encounters.length} visits ·{' '}
            {activeMedicines} current medications
          </span>
          <small>Source at export time: {storage.label}</small>
        </div>

        <div className="mp-ips-privacy" role="note">
          <ShieldAlert />
          <div>
            <strong>This document contains identifiable health information</strong>
            <p>
              Download only to an appropriate device and share only with an intended recipient. MediPass does not
              send the document to third parties automatically.
            </p>
          </div>
        </div>

        <ul className="mp-ips-checks">
          <li>
            The readable PDF includes the same FHIR Bundle JSON used to generate the document.
          </li>
          <li>
            Medications include INN/WHO ATC coding only when confidently matched to the reviewed catalog;
            unmatched entries keep their original name.
          </li>
          <li>
            This export is preliminary, has not been signed or attested by a clinician, and does not replace
            the source record or a prescription.
          </li>
          <li>
            Missing data is marked unavailable or unknown; an empty list is not interpreted as confirmation
            that the patient has no conditions, allergies, or medications.
          </li>
        </ul>

        <div className="mp-ips-actions">
          <a className="mp-ips-download primary" href={`${baseUrl}&format=pdf`}>
            <Download />
            <span>
              <strong>Download PDF + attached FHIR</strong>
              <small>For reading and presentation</small>
            </span>
          </a>
          <a className="mp-ips-download" href={`${baseUrl}&format=json`}>
            <FileJson />
            <span>
              <strong>Download FHIR JSON</strong>
              <small>For clinical systems</small>
            </span>
          </a>
        </div>

        <p className="mp-ips-disclaimer">
          Ask a clinician or pharmacist to compare this export with the source record, original packaging or
          prescription, allergies, and current condition before using it for emergency care, travel, or medication decisions.
        </p>
      </DialogContent>
    </Dialog>
  );
}
