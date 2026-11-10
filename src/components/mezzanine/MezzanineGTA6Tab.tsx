/**
 * GTA-6 tab inside the Mezzanine hub.
 *
 * Embeds the local GTA-6 server (http://127.0.0.1:3000) in an iframe so the
 * player can launch the game directly from the «Мезонин» tab without leaving
 * the Emporium app.
 */
import { useEffect, useState } from 'react';
import { Monitor, AlertCircle, Play, RefreshCw } from 'lucide-react';

export function MezzanineGTA6Tab() {
  const [status, setStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const check = async () => {
      try {
        const res = await fetch('http://127.0.0.1:3000', {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store'
        });
        if (!cancelled) setStatus(res.ok ? 'online' : 'offline');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <Monitor className="w-6 h-6 text-pink-500" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-1">
              GTA-6
              <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                status === 'online' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30'
                : status === 'offline' ? 'bg-red-900/50 text-red-400 border border-red-500/30'
                : 'bg-slate-800 text-slate-500 border border-slate-700'
              }`}>
                {status === 'online' ? 'ONLINE' : status === 'offline' ? 'ОФЛАЙН' : 'ПРОВЕРКА…'}
              </span>
            </h2>
            <p className="text-sm text-slate-400">
              Локальный игровой сервер GTA-6 — {status === 'online'
                ? 'доступен по адресу http://127.0.0.1:3000'
                : status === 'offline'
                  ? 'сервер не отвечает. Запустите run-gta6.ps1 из папки E:\\GTA6'
                  : 'проверка состояния сервера…'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              window.open('http://127.0.0.1:3000', '_blank');
            }}
            disabled={status !== 'online'}
            className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition ${
              status === 'online'
                ? 'bg-pink-600 hover:bg-pink-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed hover:bg-slate-800'
            }`}
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            Запустить GTA-6
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3 py-2 rounded text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Обновить статус
          </button>
        </div>
        {status === 'offline' && (
          <div className="mt-3 text-xs text-slate-500">
            Сервер разворачивается в папке E:\\GTA6. Запустите <code className="text-pink-400">run-gta6.ps1</code>, чтобы игра стала доступна во вкладке.
          </div>
        )}
      </div>

      <div className="flex-1 relative bg-black rounded-xl border border-slate-800 overflow-hidden shadow-lg">
        {status === 'online' ? (
          <iframe
            src="http://127.0.0.1:3000"
            className="absolute inset-0 w-full h-full border-0"
            title="GTA-6 local server"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
            <AlertCircle className="w-10 h-10 mb-2" aria-hidden="true" />
            <p className="text-sm font-medium">GTA-6 сервер недоступен</p>
            <p className="text-xs mt-1 text-slate-500">Запустите run-gta6.ps1 (E:\\GTA6) и обновите страницу.</p>
          </div>
        )}
      </div>
    </div>
  );
}
