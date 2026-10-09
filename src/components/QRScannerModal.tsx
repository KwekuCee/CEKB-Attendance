import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import { Member, AttendanceRecord, ViewType } from '../types';
import { useToast } from '../context/ToastContext';
import { Button } from './Button';


interface QRScannerModalProps {
  members: Member[];
  attendance?: AttendanceRecord[];
  serviceTypes?: Array<{ id: string; name: string; active: boolean }>;
  user?: {
    name: string;
    role: 'Superadmin' | 'Church Admin';
    church: string;
  };
  onConfirmAttendance: (record: AttendanceRecord) => void;
  onClose: () => void;
  onLogout?: () => void;
  onNavigate: (view: ViewType) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  members,
  attendance = [],
  serviceTypes = [],
  user,
  onConfirmAttendance,
  onClose,
  onLogout,
  onNavigate
}) => {
  const toast = useToast();
  const [scannerState, setScannerState] = useState<'scanning' | 'success' | 'duplicate' | 'error'>('scanning');
  const [lookupQuery, setLookupQuery] = useState('');
  const isChurchAdmin = user?.role === 'Church Admin';
  const scopedMembers = (members || []).filter(m =>
    m && (!isChurchAdmin || (m.church || '').toLowerCase() === (user?.church || '').toLowerCase())
  );

  const activeServiceNames = (serviceTypes || []).filter(s => s.active).map(s => s.name);
  const serviceOptions = activeServiceNames.length > 0 ? activeServiceNames : ['Sunday Service'];

  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [serviceType, setServiceType] = useState(serviceOptions[0]);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [useRealCamera, setUseRealCamera] = useState(true);
  const [cameraError, setCameraError] = useState('');
  // Kiosk mode: a device left at the entrance keeps scanning on its own.
  const [kiosk, setKiosk] = useState(() => localStorage.getItem('cekb_kiosk') === '1');
  useEffect(() => { localStorage.setItem('cekb_kiosk', kiosk ? '1' : '0'); }, [kiosk]);
  const beep = (ok: boolean) => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = ok ? 880 : 300;
      gain.gain.value = 0.15;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + (ok ? 0.18 : 0.4));
      if (navigator.vibrate) navigator.vibrate(ok ? 80 : [60, 60, 60]);
    } catch { /* sound not available */ }
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanLockRef = useRef(false);
  const handleCodeRef = useRef<(value: string) => void>(() => { });

  useEffect(() => {
    if (!serviceOptions.includes(serviceType)) {
      setServiceType(serviceOptions[0]);
    }
  }, [serviceOptions.join('|')]);

  const bgImageUrl = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAiyCmtx-XHebXJST5E1hExdoWCfkgB34IaY-mKBw36293DZ6MIwhbnexnGkUqdlqAaNKZudX4bT2zO3x95HvA-lTaU15gsuAMZV2jZZsFMFrfQui0ziSX_Xq-qFRxnT-29EqDgNZ-a99tcqQH2nGsrH--n68U7Ndv-C3YH7gI22HeUbpQeFNlmO6MqYpPNO377VPx8sE_d-iyvVmQqOkQ4R_Yh8tljgZHrf6dVgucORLA2AJzEiJby7c5Jl8SG4n76cJ_XEGpCt7o';

  // Camera stream on/off
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    if (useRealCamera) {
      navigator.mediaDevices?.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      })
        .then((stream) => {
          activeStream = stream;
          setCameraError('');
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => { });
          }
        })
        .catch(() => {
          setCameraError('Camera is blocked or unavailable. Allow camera access, or find the member by name below.');
          setUseRealCamera(false);
        });
    }
    return () => {
      const stream = activeStream || (videoRef.current?.srcObject as MediaStream | null);
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [useRealCamera]);


  const today = new Date().toISOString().slice(0, 10);

  const alreadyRecorded = (member: Member, service: string) =>
    (attendance || []).some(a =>
      a && a.memberId === member.id && a.serviceType === service && (a.date || '').slice(0, 10) === today
    );

  const recordAttendance = (member: Member, service: string) => {
    const record: AttendanceRecord = {
      id: `att-${Date.now()}`,
      memberId: member.id,
      memberName: member.fullName,
      memberRole: member.role,
      serviceType: service,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toISOString().slice(0, 10),
      verifiedBy: user?.name ? `${user.name} (QR Scanner)` : 'QR Scanner Station 1',
      status: 'Confirmed',
      church: member.church || 'Unassigned',
      checkInMethod: 'QR Scan',
      leaderName: member.invitedBy,
    };
    onConfirmAttendance(record);
    toast.showCheckIn(member.fullName, service);
  };

  const handleSimulateScan = (memberId: string) => {
    const wanted = (memberId || '').trim().toLowerCase();
    const matches = (m: Member) => (m.id || '').trim().toLowerCase() === wanted;
    const found = scopedMembers.find(matches) || members.find(matches);
    if (found) {
      setSelectedMember(found);
      if (isChurchAdmin && (found.church || '').toLowerCase() !== (user?.church || '').toLowerCase()) {
        setScannerState('error');
        toast.showError('Wrong church', `${found.fullName} belongs to ${found.church}.`);
        return;
      }
      if (alreadyRecorded(found, serviceType)) {
        setScannerState('duplicate');
        beep(false);
        if (kiosk) window.setTimeout(handleScanNext, 2500);
        return;
      }
      setScannerState('success');
      beep(true);
      // Attendance is logged the instant a valid pass is scanned
      recordAttendance(found, serviceType);
      if (kiosk) window.setTimeout(handleScanNext, 2500);
    } else {
      setScannerState('error');
      toast.showError('Invalid QR Code', `Member ID ${memberId} was not found in directory.`);
    }
  };

  // Reads the member ID out of a scanned pass. The passes this app creates hold
  // a small block of details; plain member IDs and short links also work.
  const extractMemberId = (raw: string): string | null => {
    const value = (raw || '').trim();
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') {
        const id = parsed.id || parsed.memberId || parsed.member_id;
        if (id) return String(id).trim();
      }
    } catch {
      // not a details block — fall through
    }
    const urlMatch = value.match(/[?&](?:id|member|memberId)=([^&\s]+)/i);
    if (urlMatch) return decodeURIComponent(urlMatch[1]).trim();
    const idMatch = value.match(/\b([A-Za-z]{2,4}-\d{2,6})\b/);
    if (idMatch) return idMatch[1];
    if (value.length <= 40 && !value.includes('\n')) return value;
    return null;
  };

  const handleScannedValue = useCallback((raw: string) => {
    const memberId = extractMemberId(raw);
    if (!memberId) {
      setScannerState('error');
      toast.showError('Pass not readable', 'That code does not hold a member ID.');
      return;
    }
    handleSimulateScan(memberId);
  }, [members, attendance, serviceType, user?.church]);

  handleCodeRef.current = handleScannedValue;

  // Continuously look for a pass in the camera picture while scanning
  useEffect(() => {
    if (!useRealCamera || scannerState !== 'scanning') return;
    let frame = 0;
    scanLockRef.current = false;

    const tick = () => {
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !scanLockRef.current) {
        const canvas = canvasRef.current || (canvasRef.current = document.createElement('canvas'));
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            try {
              const attempts: Array<{ x: number; y: number; w: number; h: number }> = [
                { x: 0, y: 0, w, h },
                // A tighter middle crop helps when the pass fills only part of the picture
                { x: Math.round(w * 0.15), y: Math.round(h * 0.15), w: Math.round(w * 0.7), h: Math.round(h * 0.7) },
                { x: Math.round(w * 0.3), y: Math.round(h * 0.3), w: Math.round(w * 0.4), h: Math.round(h * 0.4) }
              ];
              for (const area of attempts) {
                if (area.w < 40 || area.h < 40) continue;
                const image = ctx.getImageData(area.x, area.y, area.w, area.h);
                const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
                if (result && result.data) {
                  scanLockRef.current = true;
                  handleCodeRef.current(result.data);
                  return;
                }
              }
            } catch {
              // ignore a bad frame and try the next one
            }
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [useRealCamera, scannerState]);

  // Fallback: read a saved picture of the pass (screenshot or download)
  const handleImageFile = async (file: File | null) => {
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement('canvas');
      const scale = Math.min(1400 / Math.max(img.width, img.height), 1);
      canvas.width = Math.round(img.width * (scale || 1));
      canvas.height = Math.round(img.height * (scale || 1));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
      if (result?.data) {
        handleScannedValue(result.data);
      } else {
        setScannerState('error');
        toast.showError('Pass not readable', 'We could not read a code in that picture. Try a clearer, closer photo.');
      }
    } catch {
      setScannerState('error');
      toast.showError('Pass not readable', 'That file could not be opened.');
    }
  };

  const handleScanNext = () => {
    scanLockRef.current = false;
    setScannerState('scanning');
  };





  return (
    <div className="scanner-screen fixed inset-0 z-50 bg-slate-950 flex flex-col font-body select-none overflow-hidden">

      {/* Viewfinder Background */}
      <div className="scanner-camera absolute inset-0 w-full h-full object-cover">
        {useRealCamera ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full bg-cover bg-center opacity-40"
            style={{ backgroundImage: `url(${bgImageUrl})` }}
          />
        )}
      </div>

      {/* Darkened Overlay Grid with Scanner Corner Guides */}
      <div className="scanner-layout absolute inset-0 flex flex-col z-10 pointer-events-none">
        <div className="scanner-top-mask flex-1 bg-slate-950/70 backdrop-blur-xs" />

        <div className="scanner-viewfinder flex h-64 md:h-80">
          <div className="flex-1 bg-slate-950/70 backdrop-blur-xs" />

          {/* Target Scanning Box */}
          <div className="w-64 md:w-80 relative flex items-center justify-center">
            {/* Corner Guides */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-xl shadow-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-xl shadow-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-xl shadow-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-xl shadow-lg" />

            {/* Scan Line Laser */}
            <div className="absolute left-0 w-full h-[3px] bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 shadow-[0_0_15px_#f59e0b] animate-scanline z-20" />
          </div>

          <div className="flex-1 bg-slate-950/70 backdrop-blur-xs" />
        </div>

        <div className="scanner-lower flex-1 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center pt-6">
          <span className="text-xs font-bold text-amber-300 bg-slate-900/90 px-4 py-1.5 rounded-full border border-amber-500/30 shadow-lg">
            Hold the pass inside the frame — it records on its own
          </span>

          {/* Service picker + manual lookup */}
          <div className="scanner-controls mt-4 pointer-events-auto w-full px-4 max-w-md space-y-2">
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700 text-white text-xs font-semibold rounded-xl px-3 py-2 outline-none"
            >
              {serviceOptions.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <input
              type="text"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              placeholder="Or find a member by name or ID"
              className="w-full bg-slate-900/80 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none placeholder:text-slate-400"
            />

            {lookupQuery.trim() && (
              <div className="max-h-40 overflow-y-auto bg-slate-900/90 border border-slate-700 rounded-xl divide-y divide-slate-800">
                {scopedMembers
                  .filter(m =>
                    (m.fullName || '').toLowerCase().includes(lookupQuery.trim().toLowerCase()) ||
                    (m.id || '').toLowerCase().includes(lookupQuery.trim().toLowerCase())
                  )
                  .slice(0, 12)
                  .map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setLookupQuery(''); handleSimulateScan(m.id); }}
                      className="w-full text-left px-3 py-2 text-xs text-white hover:bg-slate-800"
                    >
                      {m.fullName} <span className="text-slate-400">• {m.id} • {m.church}</span>
                    </button>
                  ))}
                {scopedMembers.filter(m =>
                  (m.fullName || '').toLowerCase().includes(lookupQuery.trim().toLowerCase()) ||
                  (m.id || '').toLowerCase().includes(lookupQuery.trim().toLowerCase())
                ).length === 0 && (
                  <p className="px-3 py-3 text-xs text-slate-400">No member found.</p>
                )}
              </div>
            )}

            {cameraError && (
              <p className="text-xs font-semibold text-amber-300 bg-slate-900/80 border border-amber-500/30 rounded-xl px-3 py-2">
                {cameraError}
              </p>
            )}

            <label className="block w-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl border border-white/10 cursor-pointer text-center">
              Upload a picture of the pass
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { handleImageFile(e.target.files?.[0] || null); e.target.value = ''; }}
              />
            </label>

            <button
              onClick={() => setUseRealCamera(!useRealCamera)}
              className="w-full text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-xl border border-white/10"
            >
              {useRealCamera ? 'Turn camera off' : 'Turn camera on'}
            </button>

            <button
              onClick={() => setKiosk(k => !k)}
              aria-pressed={kiosk}
              className={`w-full text-xs font-bold px-3 py-2 rounded-xl border ${kiosk ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-white/10 hover:bg-white/20 text-white border-white/10'}`}
            >
              {kiosk ? 'Entrance mode ON — scans continue automatically' : 'Entrance mode: keep scanning automatically'}
            </button>
          </div>
        </div>
      </div>

      {/* Top Overlay Bar */}
      <header className="absolute top-0 left-0 w-full z-30 px-4 pt-6 pb-4 flex justify-between items-center bg-gradient-to-b from-slate-950/90 to-transparent">
        {onLogout ? (
          <Button variant="inverse" onClick={onLogout} className="scanner-logout" aria-label="Log out">
            <span className="material-symbols-outlined">logout</span> Log out
          </Button>
        ) : (
          <Button variant="inverse" onClick={onClose} aria-label="Close Scanner" className="scanner-close">
            <span className="material-symbols-outlined">close</span>
          </Button>
        )}

        <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold text-slate-200 ">
            {user?.church || 'Check-in station'}
          </span>
        </div>

        <button
          onClick={() => setFlashlightOn(!flashlightOn)}
          aria-label="Toggle Flashlight"
          className={`w-10 h-10 flex items-center justify-center rounded-full backdrop-blur-md border text-white active:scale-95 transition-transform cursor-pointer ${flashlightOn ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-400/20' : 'bg-slate-900/80 border-slate-700'
            }`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {flashlightOn ? 'flashlight_off' : 'flashlight_on'}
          </span>
        </button>
      </header>

      {/* Bottom Action Sheet Overlay */}
      <div className="absolute bottom-0 w-full z-30 flex flex-col justify-end pointer-events-none">

        {/* Success Overlay */}
        {scannerState === 'success' && selectedMember && (
          <div className="bg-white rounded-t-3xl w-full shadow-sm transition-transform duration-300 pointer-events-auto border-t border-slate-200 max-w-lg mx-auto animate-in slide-in-from-bottom duration-200">

            <div className="w-full flex justify-center py-3">
              <div className="w-12 h-1.5 rounded-full bg-slate-200" />
            </div>

            <div className="px-6 pb-8 pt-1 flex flex-col gap-4">

              {/* Status Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 icon-fill text-[24px]">
                    check_circle
                  </span>
                  <span className="font-headline font-bold text-sm text-emerald-800">
                    Attendance Recorded
                  </span>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold border border-emerald-200">
                  LOGGED
                </span>
              </div>


              {/* Member Card */}
              <div className="flex items-center gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="w-12 h-12 rounded-2xl bg-blue-700 text-white flex items-center justify-center font-display text-lg font-extrabold shrink-0 shadow-sm">
                  {selectedMember.initials || selectedMember.fullName?.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'MB'}
                </div>
                <div className="flex-1">
                  <h2 className="font-headline text-lg text-slate-900 font-bold leading-tight">
                    {selectedMember.fullName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ID: {selectedMember.id} • {selectedMember.role} • {selectedMember.church}
                  </p>
                </div>
              </div>

              {/* Service Type Selector (applies to next scan) */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="modalServiceType" className="text-xs font-bold text-slate-500 ">
                  Target Service — logged as {serviceType}
                </label>
                <select
                  id="modalServiceType"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-body text-xs font-semibold text-slate-900 outline-none focus:border-blue-600 cursor-pointer"
                >
                  {serviceOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Action Button */}
              <button
                onClick={handleScanNext}
                className="w-full mt-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                <span>Scan Next Member</span>
              </button>


            </div>
          </div>
        )}

        {/* Already recorded Overlay */}
        {scannerState === 'duplicate' && selectedMember && (
          <div className="bg-white rounded-t-3xl w-full shadow-sm pointer-events-auto border-t border-slate-200 max-w-lg mx-auto animate-in slide-in-from-bottom duration-200">
            <div className="w-full flex justify-center py-3">
              <div className="w-12 h-1.5 rounded-full bg-slate-200" />
            </div>
            <div className="px-6 pb-8 pt-1 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 icon-fill text-[24px]">info</span>
                <span className="font-headline font-bold text-sm text-amber-800">Already recorded today</span>
              </div>
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-xs text-slate-700">
                <p className="font-bold text-slate-900 mb-1">{selectedMember.fullName}</p>
                <p>{selectedMember.fullName} is already marked present for {serviceType} today, so nothing was added.</p>
              </div>
              <button
                onClick={handleScanNext}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3.5 rounded-xl cursor-pointer"
              >
                Scan next member
              </button>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {scannerState === 'error' && (
          <div className="bg-white rounded-t-3xl w-full shadow-sm transition-transform duration-300 pointer-events-auto border-t border-slate-200 max-w-lg mx-auto animate-in slide-in-from-bottom duration-200">

            <div className="w-full flex justify-center py-3">
              <div className="w-12 h-1.5 rounded-full bg-slate-200" />
            </div>

            <div className="px-6 pb-8 pt-1 flex flex-col gap-4">

              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 icon-fill text-[24px]">
                  error
                </span>
                <span className="font-headline font-bold text-sm text-rose-700">
                  Scan Failed
                </span>
              </div>

              <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200">
                <h2 className="font-headline text-base font-bold text-slate-900 mb-1">
                  Unrecognized QR Code
                </h2>
                <p className="font-body text-xs text-slate-600">
                  The scanned code is not present in the CEKB active directory. Register as a new member or use manual lookup.
                </p>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onNavigate('register');
                }}
                className="w-full bg-slate-900 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                <span>Register Member Manually</span>
              </button>

              <button
                onClick={handleScanNext}
                className="w-full text-slate-600 font-bold text-xs py-2 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Retry Scanner
              </button>

            </div>
          </div>
        )}

      </div>

    </div>
  );
};
