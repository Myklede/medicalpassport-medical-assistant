import MediPassBadge from '@/components/medipass-badge';

export interface MediPassBrandProps {
  className?: string;
  compact?: boolean;
  subtitle?: string;
}

/** Shared, noninteractive wordmark. Wrap in the route's existing navigation link. */
export function MediPassBrand({ className = '', compact = false, subtitle }: MediPassBrandProps) {
  const caption = subtitle ?? (compact ? '' : 'CONNECTED CARE');

  return <span className={`mp-brand inline-flex max-w-full items-center gap-3 text-inherit ${className}`} data-testid="medipass-brand">
    <MediPassBadge className={compact ? 'size-9 shrink-0' : 'size-10 shrink-0'} />
    <span className="block min-w-0">
      <span className={`block font-semibold leading-tight tracking-tight ${compact ? 'text-[17px]' : 'text-xl'}`}>MediPass</span>
      {caption && <span className="mt-0.5 block text-[10px] font-medium leading-relaxed tracking-[0.16em] opacity-65">{caption}</span>}
    </span>
  </span>;
}

export default MediPassBrand;
