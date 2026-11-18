import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Copy, Download, FilePlus2, FileText, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { Character } from '../../gameEngine';
import {
  DECREE_KIND_LABELS,
  DECREE_RANK_LABELS,
  deriveDecreeKeyPair,
  formatDecreeText,
  groupFingerprint,
  nextDecreeNumber,
  passphraseIssue,
  signDecree,
  verifyDecree,
  type DecreeKeyPair,
  type DecreeKind,
  type DecreeRank,
  type DecreeState,
  type DecreeVerdict,
  type SignedDecree,
  type SignedFields
} from '../../decreesEngine';

interface DecreesTabProps {
  week: number;
  /** Дата кампании в формате «19.03.1845» — ставится в документ по умолчанию. */
  date: string;
  campaignName: string;
  roster: Character[];
  decrees: DecreeState;
  /** Добавляет подписанный документ в кампанию (сохранение + журнал событий). */
  onSign: (document: SignedDecree) => void;
}

type Verdicts = Record<string, DecreeVerdict | 'checking'>;

const inputClass =
  'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400';
const labelClass = 'block text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1';

function findCeo(roster: Character[]): Character | undefined {
  return roster.find(character => character.role === 'Chief Executive Officer');
}

export function DecreesTab({ week, date, campaignName, roster, decrees, onSign }: DecreesTabProps) {
  const ceo = useMemo(() => findCeo(roster), [roster]);
  const signerName = (ceo?.name ?? 'Елена Вэнс (CEO)').replace(/\s*\(CEO\)\s*$/i, '').trim();

  const [kind, setKind] = useState<DecreeKind>('decree');
  const [rank, setRank] = useState<DecreeRank>(3);
  // Номер и дата — производные от кампании: их можно поправить вручную, но
  // при смене типа, недели или дня черновик снова берёт значения по умолчанию.
  const [numberOverride, setNumberOverride] = useState<{ key: string; value: number } | null>(null);
  const [dateOverride, setDateOverride] = useState<{ key: string; value: string } | null>(null);
  const draftKey = `${kind}|${week}|${date}`;
  const autoNumber = nextDecreeNumber(decrees.documents, kind, week);
  const number = numberOverride?.key === draftKey ? numberOverride.value : autoNumber;
  const docDate = dateOverride?.key === draftKey ? dateOverride.value : date;
  const [addressee, setAddressee] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [signerRole, setSignerRole] = useState('Генеральный директор синдиката');
  const [passphrase, setPassphrase] = useState('');
  const [keyPair, setKeyPair] = useState<DecreeKeyPair | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [signBusy, setSignBusy] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Verdicts>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const checkedRef = useRef(new Set<string>());



  // Переключение типа документа ставит уровень по умолчанию: указ — 3, приказ — 4.
  const changeKind = (nextKind: DecreeKind) => {
    setKind(nextKind);
    setRank(nextKind === 'decree' ? 3 : 4);
  };

  // Проверка подписей один раз на документ — при первом показе списка.
  useEffect(() => {
    let cancelled = false;
    for (const document of decrees.documents) {
      if (checkedRef.current.has(document.id)) continue;
      checkedRef.current.add(document.id);
      setVerdicts(previous => ({ ...previous, [document.id]: 'checking' }));
      verifyDecree(document, document.signature).then(verdict => {
        if (cancelled) return;
        setVerdicts(previous => ({ ...previous, [document.id]: verdict }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [decrees.documents]);

  const passphraseProblem = passphrase.trim() ? passphraseIssue(passphrase) : null;
  const keyFingerprint = keyPair ? base64Short(keyPair.publicKeyBase64) : null;

  const prepareKey = async () => {
    setKeyError(null);
    setKeyBusy(true);
    try {
      setKeyPair(await deriveDecreeKeyPair(passphrase));
    } catch (error) {
      setKeyPair(null);
      setKeyError(error instanceof Error ? error.message : 'Не удалось вывести ключ.');
    } finally {
      setKeyBusy(false);
    }
  };

  const sign = async () => {
    setSignError(null);
    if (!title.trim()) {
      setSignError('У документа должен быть заголовок.');
      return;
    }
    if (!body.trim()) {
      setSignError('Текст документа пуст — подписывать нечего.');
      return;
    }
    if (!addressee.trim()) {
      setSignError('Укажите адресата.');
      return;
    }
    if (!keyPair) {
      setSignError('Сначала загрузите ключ из пары слов.');
      return;
    }
    setSignBusy(true);
    try {
      const fields: SignedFields = {
        kind,
        number,
        week,
        date: docDate,
        addressee,
        title,
        body,
        signerName,
        signerRole,
        rank
      };
      const document = await signDecree(fields, keyPair);
      const verdict = await verifyDecree(document, document.signature);
      setVerdicts(previous => ({ ...previous, [document.id]: verdict }));
      checkedRef.current.add(document.id);
      if (verdict.status !== 'valid') throw new Error('Подпись не прошла самопроверку — документ не сохранён.');
      onSign(document);
      setNumberOverride(null);
      setDateOverride(null);
      setExpandedId(document.id);
      setTitle('');
      setBody('');
      setNotice(`${DECREE_KIND_LABELS[kind]} № ${number}/${week} подписан. Отпечаток: ${groupFingerprint(document.signature.fingerprint)}`);
    } catch (error) {
      setSignError(error instanceof Error ? error.message : 'Не удалось подписать документ.');
    } finally {
      setSignBusy(false);
    }
  };

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(message);
    } catch {
      setNotice('Копирование недоступно в этом окне — текст можно выделить вручную.');
    }
  };

  const print = async (document: SignedDecree) => {
    // jsPDF грузится лениво: вкладка не тянет ~200 КБ на старте приложения.
    const [{ jsPDF }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 56;
    const width = pdf.internal.pageSize.getWidth() - margin * 2;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(`${DECREE_KIND_LABELS[document.kind].toUpperCase()} № ${document.number}/${document.week}`, margin, 70);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text([campaignName, `Дата: ${document.date}`, `Кому: ${document.addressee}`, `Уровень: ${DECREE_RANK_LABELS[document.rank]}`], margin, 92);
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(pdf.splitTextToSize(document.title, width), margin, 136);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(pdf.splitTextToSize(document.body, width), margin, 158);
    const bodyBottom = 158 + pdf.splitTextToSize(document.body, width).length * 12 + 24;
    pdf.setFontSize(8);
    pdf.text(
      pdf.splitTextToSize(`Подписант: ${document.signerName} — ${document.signerRole}`, width),
      margin,
      bodyBottom
    );
    // jspdf-autotable расширяет прототип jsPDF — вызывается как метод документа.
    (pdf as unknown as { autoTable: (options: Record<string, unknown>) => void }).autoTable({
      startY: bodyBottom + 16,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 4, overflow: 'linebreak' },
      head: [['Электронная подпись Ed25519', '']],
      body: [
        ['Открытый ключ', document.signature.publicKey],
        ['Отпечаток', groupFingerprint(document.signature.fingerprint)],
        ['Подписано', document.signature.signedAt],
        ['Подпись', document.signature.signature]
      ],
      columnStyles: { 0: { cellWidth: 90, fontStyle: 'bold' } }
    });
    const fileName = `${document.kind === 'decree' ? 'ukaz' : 'prikaz'}_${document.number}_${document.week}.pdf`;
    pdf.save(fileName);
  };

  const documents = useMemo(() => [...decrees.documents].reverse(), [decrees.documents]);

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-800 pb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" /> Указы и приказы
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Документы синдиката подписываются электронной подписью Ed25519 прямо в браузере.
          Ключ выводится из вашей пары слов и живёт только в этой вкладке — в сохранение
          кампании попадают документ, открытый ключ, подпись и отпечаток.
        </p>
      </header>

      {notice && (
        <div className="flex items-start gap-2 bg-emerald-950/40 border border-emerald-800/60 rounded-xl px-4 py-3 text-sm text-emerald-200">
          <BadgeCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1 break-words">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-xs text-emerald-300/70 hover:text-emerald-200">закрыть</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
        {/* ------------------------------------------------------------ форма */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['decree', 'order'] as DecreeKind[]).map(value => (
              <button
                key={value}
                onClick={() => changeKind(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${kind === value ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
              >
                {DECREE_KIND_LABELS[value]}
              </button>
            ))}
            <span className="ml-auto font-mono text-[10px] text-slate-500">неделя {week} · {campaignName}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelClass} htmlFor="decree-number">Номер</label>
              <input
                id="decree-number"
                type="number"
                min={1}
                value={number}
                onChange={event => setNumberOverride({ key: draftKey, value: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="decree-date">Дата</label>
              <input
                id="decree-date"
                value={docDate}
                onChange={event => setDateOverride({ key: draftKey, value: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="decree-rank">Уровень</label>
              <select
                id="decree-rank"
                value={rank}
                onChange={event => setRank(Number(event.target.value) as DecreeRank)}
                className={inputClass}
              >
                {([4, 3, 2, 1] as DecreeRank[]).map(value => (
                  <option key={value} value={value}>{DECREE_RANK_LABELS[value]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="decree-addressee">Адресат</label>
            <input
              id="decree-addressee"
              value={addressee}
              onChange={event => setAddressee(event.target.value)}
              placeholder="Например: директору по логистике Д. Новаку"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="decree-title">Заголовок</label>
            <input
              id="decree-title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="О порядке отгрузки партии с мезонина"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="decree-body">Текст</label>
            <textarea
              id="decree-body"
              value={body}
              onChange={event => setBody(event.target.value)}
              rows={7}
              placeholder="Повелеваю: …"
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="decree-signer">Подписант</label>
              <input id="decree-signer" value={signerName} readOnly className={`${inputClass} text-slate-400`} />
            </div>
            <div>
              <label className={labelClass} htmlFor="decree-signer-role">Должность</label>
              <input
                id="decree-signer-role"
                value={signerRole}
                onChange={event => setSignerRole(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {signError && (
            <p className="text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2">{signError}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={sign}
              disabled={signBusy || !keyPair}
              className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2.5 rounded-lg transition"
            >
              <FilePlus2 className="w-4 h-4" /> {signBusy ? 'Подписываем…' : 'Подписать ЭП'}
            </button>
            <button
              onClick={() => copy(
                [
                  DECREE_KIND_LABELS[kind].toUpperCase() + ` № ${number}/${week}`,
                  `Дата: ${docDate}`,
                  `Кому: ${addressee}`,
                  title,
                  body,
                  `${signerName} — ${signerRole}`
                ].join('\n'),
                'Текст без подписи скопирован.'
              )}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2.5 rounded-lg transition"
            >
              <Copy className="w-4 h-4" /> Копировать черновик
            </button>
          </div>
        </section>

        {/* ------------------------------------------------------------- ключ */}
        <aside className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" /> Ключ подписи
          </h3>
          <p className="text-xs text-slate-400">
            Пара слов из {8}+ слов. Из неё PBKDF2-SHA256 выводит семя Ed25519; ключ
            хранится только в памяти вкладки и исчезает при перезагрузке.
          </p>
          <label className={labelClass} htmlFor="decree-passphrase">Пара слов</label>
          <input
            id="decree-passphrase"
            type="password"
            autoComplete="off"
            value={passphrase}
            onChange={event => {
              setPassphrase(event.target.value);
              setKeyPair(null);
            }}
            placeholder="восемь слов через пробел"
            className={inputClass}
          />
          {passphraseProblem && <p className="text-[11px] text-amber-300">{passphraseProblem}</p>}
          {keyError && <p className="text-[11px] text-red-300">{keyError}</p>}
          <button
            onClick={prepareKey}
            disabled={keyBusy || !passphrase.trim()}
            className="w-full inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 text-xs font-bold px-3 py-2.5 rounded-lg transition"
          >
            <ShieldCheck className="w-4 h-4" /> {keyBusy ? 'Выводим ключ…' : 'Загрузить ключ'}
          </button>
          {keyPair && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Открытый ключ Ed25519</p>
              <p className="font-mono text-[11px] text-emerald-300 break-all">{keyPair.publicKeyBase64}</p>
              <p className="font-mono text-[10px] text-slate-500">
                {keyFingerprint} · ключ в памяти
              </p>
            </div>
          )}
          <p className="text-[11px] text-slate-500">
            Любой другой человек может пересчитать подпись из открытого ключа и текста
            документа, но не может подписать новый документ без вашей пары слов.
          </p>
        </aside>
      </div>

      {/* ---------------------------------------------------------- реестр */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Реестр документов</h3>
          <span className="font-mono text-[10px] text-slate-400 border border-slate-700 bg-slate-950 rounded-md px-2 py-1">
            {documents.length} докум.
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-sm text-slate-400">
            Подписанных документов пока нет.
          </div>
        ) : (
          documents.map(document => {
            const verdict = verdicts[document.id];
            const open = expandedId === document.id;
            const valid = verdict !== undefined && verdict !== 'checking' && verdict.status === 'valid';
            const failure = verdict && verdict !== 'checking' && verdict.status === 'invalid' ? verdict : null;
            return (
              <article key={document.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <button
                  onClick={() => setExpandedId(open ? null : document.id)}
                  aria-expanded={open}
                  className="w-full text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400">
                      {DECREE_KIND_LABELS[document.kind]} № {document.number}/{document.week}
                    </span>
                    <span className="text-[10px] text-slate-500">· {document.date}</span>
                    <span className="text-[10px] text-slate-500">· {DECREE_RANK_LABELS[document.rank]}</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold">
                      {verdict === 'checking' && <span className="text-slate-400">проверка…</span>}
                      {valid && <span className="text-emerald-400 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> подпись действительна</span>}
                      {failure && (
                        <span className="text-red-400 inline-flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> подпись недействительна</span>
                      )}
                    </span>
                  </div>
                  <h4 className="mt-1 font-bold text-white text-sm">{document.title}</h4>
                  <p className="text-xs text-slate-400">Кому: {document.addressee}</p>
                </button>

                {open && (
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{document.body}</p>
                    <p className="text-xs text-slate-400">Подписант: {document.signerName} — {document.signerRole}</p>
                    {failure && (
                      <p className="text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg px-3 py-2">
                        {failure.reason}
                      </p>
                    )}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Электронная подпись</p>
                      <p className="font-mono text-[11px] text-emerald-300">Отпечаток: {groupFingerprint(document.signature.fingerprint)}</p>
                      <p className="font-mono text-[10px] text-slate-400 break-all">Ключ: {document.signature.publicKey}</p>
                      <p className="font-mono text-[10px] text-slate-400 break-all">Подпись: {document.signature.signature}</p>
                      <p className="font-mono text-[10px] text-slate-500">Подписано: {document.signature.signedAt}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => copy(formatDecreeText(document), 'Документ с подписью скопирован в буфер.')}
                        className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg transition"
                      >
                        <Copy className="w-3.5 h-3.5" /> Копировать с подписью
                      </button>
                      <button
                        onClick={() => { void print(document); }}
                        className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3 py-2 rounded-lg transition"
                      >
                        <Download className="w-3.5 h-3.5" /> Скачать PDF
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}

/** Короткая форма открытого ключа для плашки «ключ в памяти». */
function base64Short(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}
