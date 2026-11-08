import { useMemo, useState } from 'react';
import { formatMoney } from '../../currency';
import { FileSignature, Handshake, MapPin, PackagePlus, Truck, WalletCards } from 'lucide-react';
import { type Platform } from '../../terminology';
import type { TradeSupplyContract } from '../../slaveContractsEngine';
import { VenueToolbar } from '../venue';
import { t } from '../../i18n';

interface SupplyContractsPanelProps {
  contracts: TradeSupplyContract[];
  funds: number;
  onSign: (contractId: string) => void;
  onBuy: (contractId: string, quantity?: number) => void;
  platform: Platform;
}

type ContractFilter = 'all' | 'unsigned' | 'signed' | 'available' | 'sold_out';

const QUALITY_LABELS: Record<TradeSupplyContract['quality'], string> = {
  low: 'низкое',
  medium: 'среднее',
  high: 'высокое',
  legendary: 'легендарное'
};

const QUALITY_TONE: Record<TradeSupplyContract['quality'], string> = {
  low: 'text-slate-300 border-slate-700 bg-slate-800/70',
  medium: 'text-amber-200 border-amber-500/30 bg-amber-500/10',
  high: 'text-emerald-200 border-emerald-500/30 bg-emerald-500/10',
  legendary: 'text-yellow-200 border-yellow-500/30 bg-yellow-500/10'
};

const CONTROL_CLASS = 'min-h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 focus:border-sky-400 focus:outline-2 focus:outline-offset-1 focus:outline-sky-400';

function memberWord(quantity: number, platform: Platform): string {
  if (platform === 'tiktok') return 'специалиста';
  const mod10 = quantity % 10;
  const mod100 = quantity % 100;
  if (mod10 === 1 && mod100 !== 11) return 'человек';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'человека';
  return 'человек';
}

export function SupplyContractsPanel({ contracts, funds, onSign, onBuy, platform }: SupplyContractsPanelProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ContractFilter>('all');
  const active = (contracts || []).filter(contract =>
    contract
    && contract.status === 'active'
    && Number.isFinite(contract.pricePerHead)
    && Number.isFinite(contract.weeklyQuantity)
    && Number.isFinite(contract.purchasedThisWeek)
  );
  const needle = query.trim().toLocaleLowerCase('ru');

  const visibleContracts = useMemo(() => active.filter(contract => {
    const remainingLot = Math.max(0, contract.weeklyQuantity - contract.purchasedThisWeek);
    if (filter === 'unsigned' && contract.signed) return false;
    if (filter === 'signed' && !contract.signed) return false;
    if (filter === 'available' && (!contract.signed || remainingLot === 0)) return false;
    if (filter === 'sold_out' && remainingLot > 0) return false;
    if (!needle) return true;
    return [contract.title, contract.buyerName, contract.regionName, contract.description]
      .some(value => value.toLocaleLowerCase('ru').includes(needle));
  }), [active, filter, needle]);

  const hasFilters = query.trim() !== '' || filter !== 'all';
  const resetFilters = () => {
    setQuery('');
    setFilter('all');
  };
  const signedCount = active.filter(contract => contract.signed).length;

  if (active.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 px-4 py-8 text-center text-xs leading-relaxed text-slate-400">
        {t('contract.supply.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <VenueToolbar
        query={query}
        onQueryChange={setQuery}
        searchLabel={t('contract.supply.searchLabel')}
        placeholder={t('contract.supply.search')}
        summary={<span>{t('contract.supply.summary', { shown: visibleContracts.length, total: active.length, signed: signedCount })}</span>}
        onReset={resetFilters}
        hasActiveFilters={hasFilters}
      >
        <label htmlFor="supply-contract-filter" className="sr-only">{t('contract.supply.filterLabel')}</label>
        <select id="supply-contract-filter" value={filter} onChange={event => setFilter(event.target.value as ContractFilter)} className={CONTROL_CLASS}>
          <option value="all">{t('contract.supply.filter.all')}</option>
          <option value="unsigned">{t('contract.supply.filter.unsigned')}</option>
          <option value="signed">{t('contract.supply.filter.signed')}</option>
          <option value="available">{t('contract.supply.filter.available')}</option>
          <option value="sold_out">{t('contract.supply.filter.soldOut')}</option>
        </select>
      </VenueToolbar>

      {visibleContracts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950 px-4 py-8 text-center text-xs text-slate-400">
          {t('contract.supply.none')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {visibleContracts.map(contract => {
            const signed = contract.signed;
            const remainingLot = Math.max(0, contract.weeklyQuantity - contract.purchasedThisWeek);
            const lotSoldOut = remainingLot <= 0;
            const affordableCount = Math.min(remainingLot, Math.floor(funds / Math.max(1, contract.pricePerHead)));
            const canBuy = signed && affordableCount > 0;
            const lotCost = remainingLot * contract.pricePerHead;
            const cannotAfford = signed && !lotSoldOut && affordableCount <= 0;

            return (
              <article key={contract.id} className={`flex min-w-0 flex-col justify-between gap-3 rounded-lg border bg-slate-950 p-3 text-left ${signed ? 'border-emerald-500/25' : 'border-sky-500/30'}`}>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="line-clamp-2 text-xs font-bold leading-snug text-white" title={contract.title}>{contract.title}</h2>
                      <p className="mt-1 flex min-w-0 items-center gap-1 truncate text-[10px] text-sky-300" title={contract.buyerName}>
                        <Handshake aria-hidden="true" className="h-3 w-3 shrink-0" /> {contract.buyerName}
                      </p>
                    </div>
                    <span className="shrink-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-1 font-mono text-[9px] text-slate-300">{contract.weeksRemaining} нед.</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 truncate text-[9px] uppercase text-slate-500" title={contract.regionName}>
                    <MapPin aria-hidden="true" className="h-3 w-3 shrink-0" /> {contract.regionName} · с недели {contract.startWeek}
                  </p>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-slate-400" title={contract.description}>{contract.description}</p>

                  <p className={`mt-2 flex items-center gap-1 rounded-md border px-2 py-1.5 text-[10px] leading-relaxed ${signed ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200' : 'border-amber-500/20 bg-amber-500/5 text-amber-200'}`}>
                    <FileSignature aria-hidden="true" className="h-3 w-3 shrink-0" />
                    {signed ? t('contract.supply.signedState') : t('contract.supply.unsignedState')}
                  </p>

                  <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 border-y border-slate-800 py-2 text-[10px]">
                    <div className="flex min-w-0 justify-between gap-1"><dt className="truncate text-slate-500">Цена</dt><dd className="shrink-0 font-mono text-emerald-300">{formatMoney(contract.pricePerHead)}</dd></div>
                    <div className="flex min-w-0 justify-between gap-1"><dt className="truncate text-slate-500">Квота</dt><dd className="shrink-0 font-mono text-slate-200">{contract.weeklyQuantity}/нед.</dd></div>
                    <div className="flex min-w-0 justify-between gap-1"><dt className="truncate text-slate-500">Куплено</dt><dd className="shrink-0 font-mono text-slate-200">{contract.purchasedThisWeek}/{contract.weeklyQuantity}</dd></div>
                    <div className="flex min-w-0 justify-between gap-1"><dt className="truncate text-slate-500">Качество</dt><dd className={`truncate rounded border px-1 font-semibold ${QUALITY_TONE[contract.quality]}`}>{QUALITY_LABELS[contract.quality]}</dd></div>
                    <div className="flex min-w-0 justify-between gap-1"><dt className="truncate text-slate-500">Срок</dt><dd className="shrink-0 font-mono text-slate-200">{contract.weeksRemaining}/{contract.termWeeks}</dd></div>
                    <div className="flex min-w-0 justify-between gap-1"><dt className="truncate text-slate-500">Потрачено</dt><dd className="shrink-0 font-mono text-rose-300">{formatMoney(contract.totalSpent)}</dd></div>
                  </dl>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-900" role="progressbar" aria-label={t('contract.supply.progress', { title: contract.title })} aria-valuemin={0} aria-valuemax={Math.max(1, contract.termWeeks)} aria-valuenow={Math.max(0, contract.termWeeks - contract.weeksRemaining)}>
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, ((contract.termWeeks - contract.weeksRemaining) / Math.max(1, contract.termWeeks)) * 100)}%` }} />
                  </div>
                  {contract.lastRiskReason ? (
                    <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[10px] leading-relaxed text-amber-200 break-words" title={contract.lastRiskReason}>
                      {t('contract.supply.forecast')}: {contract.lastRiskReason}
                    </p>
                  ) : null}

                  <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                    {lotSoldOut ? <PackagePlus aria-hidden="true" className="h-3.5 w-3.5 text-emerald-300" /> : <WalletCards aria-hidden="true" className="h-3.5 w-3.5 text-sky-300" />}
                    {lotSoldOut ? t('contract.supply.quotaReset') : t('contract.supply.lotLine', { cost: formatMoney(lotCost), left: remainingLot })}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[9px] text-slate-500">
                    <Truck aria-hidden="true" className="h-3 w-3" /> {t('contract.supply.caravans', { n: contract.caravansDelivered })}
                  </p>
                </div>

                <div className="border-t border-slate-800 pt-2">
                  {!signed ? (
                    <button type="button" onClick={() => onSign(contract.id)} className="min-h-8 w-full rounded-md bg-sky-700 px-2 text-[10px] font-bold text-white transition hover:bg-sky-600 focus-visible:outline-2 focus-visible:outline-sky-300">{t('contract.supply.signAction')}</button>
                  ) : (
                    <>
                      <p className="mb-1.5 text-[9px] text-slate-500">
                        {cannotAfford ? <>{t('contract.supply.noMoneyShort')}: <strong className="text-red-300">{formatMoney(contract.pricePerHead)}</strong></> : <>Можно выкупить: <strong className={canBuy ? 'text-emerald-300' : 'text-slate-400'}>{affordableCount}</strong></>}
                      </p>
                       <button
                         type="button"
                         onClick={() => onBuy(contract.id)}
                         disabled={!canBuy}
                         className={`min-h-8 w-full rounded-md px-2 text-[10px] font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 ${canBuy ? 'bg-emerald-700 text-white hover:bg-emerald-600' : 'cursor-not-allowed bg-slate-800 text-slate-500'}`}
                       >
                         {lotSoldOut ? t('contract.supply.lotSold') : cannotAfford ? t('contract.supply.noMoneyShort') : t('contract.supply.buyAction', { qty: affordableCount, word: memberWord(affordableCount, platform) })}
                       </button>

                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
