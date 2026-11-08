import { Users } from 'lucide-react';
import type { Employee, EmployeeCandidate } from '../../expansionTypes';
import { EmployeeRoster } from './EmployeeRoster';
import { formatMoney } from '../../currency';

export interface FacilitiesStaffTabProps {
  funds: number;
  employees: Employee[];
  candidates: EmployeeCandidate[];
  /** Staff positions the company can fill; grows by purchase. */
  hiringSlots: number;
  onHireEmployee: (candidateId: string) => void;
  onDismissEmployee: (employeeId: string) => void;
  onRefreshCandidates: () => void;
  onBuyHiringSlot: () => void;
}

export function FacilitiesStaffTab({
  funds, employees, candidates, hiringSlots,
  onHireEmployee, onDismissEmployee, onRefreshCandidates, onBuyHiringSlot
}: FacilitiesStaffTabProps) {
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <Users className="mt-1 h-5 w-5 text-amber-300" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-white">Отдел кадров</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">Управляйте сотрудниками компании: наймите кандидатов, купите дополнительные места в штате, назначайте на посты и увольняйте.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-300">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span>{formatMoney(funds)} в казне</span>
        </div>
      </header>

      <EmployeeRoster
        employees={employees}
        candidates={candidates}
        buildings={[]}
        hiringSlots={hiringSlots}
        funds={funds}
        onDismiss={onDismissEmployee}
        onHire={onHireEmployee}
        onRefreshCandidates={onRefreshCandidates}
        onBuyHiringSlot={onBuyHiringSlot}
      />
    </div>
  );
}
