import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  ShieldCheck, 
  PauseCircle
} from 'lucide-react';
import { Badge } from './ui/badge';
import type { ExecutionStatus, VerificationStatus, LifecycleStatus } from '../types';

interface NexoraStatusBadgeProps {
  status: ExecutionStatus | VerificationStatus | LifecycleStatus | string;
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export const NexoraStatusBadge: React.FC<NexoraStatusBadgeProps> = ({
  status,
  label,
  className,
  showIcon = true,
}) => {
  const norm = (status || '').toUpperCase().trim();

  switch (norm) {
    case 'COMPLETED':
    case 'VERIFIED':
    case 'APPROVED':
    case 'COMMITTED':
    case 'ON_TRACK':
    case 'MATCHED':
      return (
        <Badge variant="success" className={className}>
          {showIcon && <CheckCircle2 className="h-3 w-3 text-[#34C759]" />}
          <span>{label || norm.replace('_', ' ')}</span>
        </Badge>
      );

    case 'IN_PROGRESS':
    case 'AUTO_LINKED':
    case 'PROPOSED':
      return (
        <Badge variant="cyan" className={className}>
          {showIcon && <Clock className="h-3 w-3 text-sky-600" />}
          <span>{label || norm.replace('_', ' ')}</span>
        </Badge>
      );

    case 'REVIEW_REQUIRED':
    case 'AT_RISK':
    case 'DELAYED':
    case 'OVERDUE':
    case 'PENDING':
      return (
        <Badge variant="warning" className={className}>
          {showIcon && <AlertTriangle className="h-3 w-3 text-[#FF9500]" />}
          <span>{label || norm.replace('_', ' ')}</span>
        </Badge>
      );

    case 'BLOCKED':
    case 'REJECTED':
    case 'TAMPER_DETECTED':
    case 'ERROR':
    case 'INVALID':
      return (
        <Badge variant="destructive" className={className}>
          {showIcon && <XCircle className="h-3 w-3 text-[#FF3B30]" />}
          <span>{label || norm.replace('_', ' ')}</span>
        </Badge>
      );

    case 'TRUST_PLANE_VALIDATED':
    case 'CRYPTOGRAPHICALLY_VERIFIED':
      return (
        <Badge variant="bronze" className={className}>
          {showIcon && <ShieldCheck className="h-3 w-3 text-[#C38B4B]" />}
          <span>{label || norm.replace('_', ' ')}</span>
        </Badge>
      );

    case 'NOT_STARTED':
    default:
      return (
        <Badge variant="secondary" className={className}>
          {showIcon && <PauseCircle className="h-3 w-3 text-slate-400" />}
          <span>{label || (norm ? norm.replace('_', ' ') : 'NOT STARTED')}</span>
        </Badge>
      );
  }
};
