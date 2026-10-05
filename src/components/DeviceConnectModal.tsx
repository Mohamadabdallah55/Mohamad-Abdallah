import { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface DeviceConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onRoomChange: (newRoom: string) => void;
}

export function DeviceConnectModal({
  isOpen,
  onClose,
  roomId,
  onRoomChange,
}: DeviceConnectModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [inputRoom, setInputRoom] = useState<string>(roomId);

  const getHostUrl = () => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    url.searchParams.set('screen', 'host');
    url.searchParams.set('room', roomId);
    return url.toString();
  };

  const getAudienceUrl = () => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    url.searchParams.set('screen', 'audience');
    url.searchParams.set('room', roomId);
    return url.toString();
  };

  useEffect(() => {
    if (!isOpen) return;
    const hostUrl = getHostUrl();
    QRCode.toDataURL(hostUrl, {
      width: 260,
      margin: 2,
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code error', err));
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRoom.trim()) {
      onRoomChange(inputRoom.trim().toUpperCase());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-3xl border-2 border-amber-400 bg-slate-900 p-5 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📱 ➔ 📺</span>
            <div>
              <h3 className="font-display font-extrabold text-lg md:text-xl text-gold-gradient">
                طريقة التحكم من جهازين منفصلين
              </h3>
              <p className="text-xs text-amber-300/80">
                (جوال للتحكم + شاشة تلفزيون أو كمبيوتر للعرض)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700"
          >
            ✕ إغلاق
          </button>
        </div>

        {/* Room Code Selection */}
        <div className="rounded-2xl border border-amber-500/30 bg-slate-950 p-3.5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-300">رمز الغرفة المشتركة (Room Code):</span>
            <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-xs font-black text-amber-300">
              {roomId}
            </span>
          </div>

          <form onSubmit={handleApplyRoom} className="flex gap-2">
            <input
              type="text"
              value={inputRoom}
              onChange={(e) => setInputRoom(e.target.value.toUpperCase())}
              placeholder="اكتب رمز الغرفة..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono uppercase text-white"
            />
            <button
              type="submit"
              className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
            >
              تغيير
            </button>
          </form>
        </div>

        {/* Option 1: QR Code for Host on Phone */}
        <div className="flex flex-col items-center rounded-2xl border border-blue-500/40 bg-blue-950/20 p-4 mb-4 text-center">
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300 mb-2">
            الخيار الأول (الأسهل والأسرع بالجوال)
          </span>
          <p className="text-xs text-slate-300 mb-3">
            وجّه كاميرا هاتفك المحمول نحو الباركود لفتح <strong>شاشة التحكم (المقدم)</strong> في جوالك فوراً:
          </p>

          {qrDataUrl ? (
            <div className="rounded-2xl border-4 border-white bg-white p-2 shadow-lg">
              <img
                src={qrDataUrl}
                alt="QR Code to control from phone"
                className="h-44 w-44 md:h-52 md:w-52"
              />
            </div>
          ) : (
            <div className="h-44 w-44 animate-pulse bg-slate-800 rounded-xl" />
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(getHostUrl())}
              className="rounded-xl border border-blue-400 bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-500 active:scale-95 transition-all shadow"
            >
              {copied ? '✓ تم نسخ رابط الجوال!' : '📋 أو اضغط هنا لنسخ رابط الجوال'}
            </button>
          </div>
        </div>

        {/* Option 2: Screen link for TV */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3.5 mb-3 text-xs">
          <span className="font-bold text-amber-300 block mb-1">
            📺 لجعل جهاز التلفزيون أو لابتوب الجمهور يعرض اللعبة:
          </span>
          <p className="text-slate-400 mb-2">
            افتح هذا الرابط على متصفح التلفزيون أو اللابتوب المتصل بالشاشة الكبيرة:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={getAudienceUrl()}
              className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-slate-300 truncate"
            />
            <button
              onClick={() => copyToClipboard(getAudienceUrl())}
              className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 font-bold text-slate-200 hover:bg-slate-700"
            >
              نسخ
            </button>
          </div>
        </div>

        {/* Summary note */}
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] text-amber-200/90 leading-relaxed">
          ✨ <strong>كيف يعمل التزامن؟</strong> السيرفر يربط أي عدد من الأجهزة بنفس رمز الغرفة (<span className="font-mono font-bold text-white">{roomId}</span>). عندما تكبس على أي زر في جوالك، تظهر الإجابة أو الـ ❌ أو الأصوات فوراً على التلفزيون بدون أي أسلاك!
        </div>
      </div>
    </div>
  );
}
