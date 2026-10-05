import React, { useState, useEffect } from 'react';
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
  const [copiedHost, setCopiedHost] = useState<boolean>(false);
  const [copiedAudience, setCopiedAudience] = useState<boolean>(false);
  const [inputRoom, setInputRoom] = useState<string>(roomId);
  
  // Custom domain support
  const [customDomain, setCustomDomain] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const saved = localStorage.getItem('feud_custom_domain');
    if (saved) return saved;

    // Try detecting parent origin if inside iframe
    try {
      if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
        const ancestor = window.location.ancestorOrigins[0];
        if (ancestor && !ancestor.includes('aistudio') && !ancestor.includes('google.com')) {
          return ancestor;
        }
      }
    } catch {
      // ignore
    }

    return window.location.origin;
  });

  const [isEditingDomain, setIsEditingDomain] = useState<boolean>(false);
  const [domainInput, setDomainInput] = useState<string>(customDomain);

  // Helper to get sanitized base URL
  const getBaseUrl = (): string => {
    let base = customDomain.trim();
    if (!base) {
      base = typeof window !== 'undefined' ? window.location.origin : '';
    }
    if (base && !base.startsWith('http://') && !base.startsWith('https://')) {
      base = `https://${base}`;
    }
    return base.replace(/\/+$/, '');
  };

  const getHostUrl = () => {
    const base = getBaseUrl();
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    const cleanPath = pathname === '/' ? '' : pathname;
    return `${base}${cleanPath}?screen=host&room=${encodeURIComponent(roomId)}`;
  };

  const getAudienceUrl = () => {
    const base = getBaseUrl();
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    const cleanPath = pathname === '/' ? '' : pathname;
    return `${base}${cleanPath}?screen=audience&room=${encodeURIComponent(roomId)}`;
  };

  // Generate QR code whenever isOpen, roomId, or customDomain changes
  useEffect(() => {
    if (!isOpen) return;
    const hostUrl = getHostUrl();
    QRCode.toDataURL(hostUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#020617',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR code error', err));
  }, [isOpen, roomId, customDomain]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, type: 'host' | 'audience') => {
    navigator.clipboard.writeText(text);
    if (type === 'host') {
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 2000);
    } else {
      setCopiedAudience(true);
      setTimeout(() => setCopiedAudience(false), 2000);
    }
  };

  const handleApplyRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputRoom.trim()) {
      onRoomChange(inputRoom.trim().toUpperCase());
    }
  };

  const handleSaveDomain = (e: React.FormEvent) => {
    e.preventDefault();
    let sanitized = domainInput.trim();
    if (sanitized && !sanitized.startsWith('http://') && !sanitized.startsWith('https://')) {
      sanitized = `https://${sanitized}`;
    }
    sanitized = sanitized.replace(/\/+$/, '');
    setCustomDomain(sanitized);
    localStorage.setItem('feud_custom_domain', sanitized);
    setIsEditingDomain(false);
  };

  const handleResetToCurrentOrigin = () => {
    if (typeof window !== 'undefined') {
      const orig = window.location.origin;
      setCustomDomain(orig);
      setDomainInput(orig);
      localStorage.removeItem('feud_custom_domain');
      setIsEditingDomain(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 md:p-4 backdrop-blur-md overflow-y-auto">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-y-auto rounded-3xl border-2 border-amber-400 bg-slate-900 p-4 md:p-6 shadow-2xl text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📱 ➔ 📺</span>
            <div>
              <h3 className="font-display font-extrabold text-lg md:text-xl text-gold-gradient">
                ربط الهاتف بشاشة العرض
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

        {/* Custom Domain Configuration Box */}
        <div className="rounded-2xl border border-blue-500/40 bg-blue-950/30 p-3 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-blue-200 flex items-center gap-1">
              <span>🌐</span>
              <span>دومين الموقع للباركود (Custom Domain):</span>
            </span>
            {!isEditingDomain ? (
              <button
                type="button"
                onClick={() => {
                  setDomainInput(customDomain);
                  setIsEditingDomain(true);
                }}
                className="text-[11px] font-bold text-amber-400 hover:underline"
              >
                تغيير الدومين ✏️
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingDomain(false)}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                إلغاء
              </button>
            )}
          </div>

          {!isEditingDomain ? (
            <div className="flex items-center justify-between rounded-xl bg-slate-950 px-3 py-1.5 text-xs font-mono text-emerald-400 border border-slate-800">
              <span className="truncate">{getBaseUrl()}</span>
              <span className="shrink-0 text-[10px] text-slate-400 mr-2">مفعّل للباركود ✓</span>
            </div>
          ) : (
            <form onSubmit={handleSaveDomain} className="space-y-2 mt-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="مثال: https://yourdomain.com"
                  className="flex-1 rounded-xl border border-blue-500/50 bg-slate-950 px-3 py-1.5 text-xs font-mono text-white placeholder-slate-500"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                >
                  حفظ الدومين ✓
                </button>
              </div>
              <button
                type="button"
                onClick={handleResetToCurrentOrigin}
                className="text-[10px] text-slate-400 hover:text-amber-300 underline block"
              >
                استعادة رابط المتصفح الحالي تلقائياً
              </button>
            </form>
          )}
        </div>

        {/* Room Code Selection */}
        <div className="rounded-2xl border border-amber-500/30 bg-slate-950 p-3 mb-3">
          <div className="flex items-center justify-between mb-1.5">
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

        {/* QR Code for Host on Phone */}
        <div className="flex flex-col items-center rounded-2xl border border-blue-500/40 bg-blue-950/20 p-4 mb-3 text-center">
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-bold text-blue-300 mb-2">
            الباركود السريع (امسحه بكاميرا هاتفك)
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

          {/* Direct Host URL display & Copy */}
          <div className="mt-3 w-full">
            <div className="mb-2 flex items-center gap-1.5 rounded-xl bg-slate-950 p-1.5 border border-slate-800">
              <input
                type="text"
                readOnly
                value={getHostUrl()}
                className="flex-1 bg-transparent px-2 font-mono text-[11px] text-amber-300 truncate"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(getHostUrl(), 'host')}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-500 active:scale-95 transition-all shadow"
              >
                {copiedHost ? '✓ تم النسخ' : 'نسخ الرابط'}
              </button>
            </div>
          </div>
        </div>

        {/* Option 2: Screen link for TV */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3 mb-3 text-xs">
          <span className="font-bold text-amber-300 block mb-1">
            📺 رابط شاشة التلفزيون (Audience Screen):
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={getAudienceUrl()}
              className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] text-slate-300 truncate"
            />
            <button
              type="button"
              onClick={() => copyToClipboard(getAudienceUrl(), 'audience')}
              className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 font-bold text-slate-200 hover:bg-slate-700"
            >
              {copiedAudience ? '✓ تم' : 'نسخ'}
            </button>
          </div>
        </div>

        {/* Summary note */}
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-200/90 leading-relaxed">
          ✨ <strong>ملاحظة هامة:</strong> إذا ربطت دومين خاص بموقعك، يمكنك كتابته في خانة <strong>دومين الموقع</strong> في الأعلى وسيقوم الباركود فوراً بتوليد الرابط الخاص بدومينك لفتحه على الجوال بدون أي مشاكل!
        </div>
      </div>
    </div>
  );
}
