import { useEffect, useRef, useState } from 'react';
import { SavedVoiceStory, uploadVoiceStory } from './voiceApi';
import './VoiceRecorder.css';

const MAX_SECONDS = 300;

interface VoiceRecorderProps {
  /** Location the memory belongs to (matches the contribution flow). */
  locationId?: string;
  onSaved?: (voice: SavedVoiceStory) => void;
}

export function VoiceRecorder({ locationId, onSaved }: VoiceRecorderProps) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [savedVoice, setSavedVoice] = useState<SavedVoiceStory | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRecording) return;

    const timer = window.setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording && seconds >= MAX_SECONDS) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, seconds]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function startRecording() {
    setError(null);
    setSavedVoice(null);
    setSeconds(0);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('هذا المتصفح لا يدعم تسجيل الصوت.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferredMime = getSupportedMimeType();
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || preferredMime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });

        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setError('لم نتمكن من الوصول للمايكروفون. تأكد من إعطاء المتصفح صلاحية التسجيل.');
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }

    setIsRecording(false);
  }

  async function saveRecording() {
    if (!audioBlob || !consent) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadVoiceStory({
        audio: audioBlob,
        locationId,
        language: 'ar',
      });

      setSavedVoice(result);
      onSaved?.(result);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'حدث خطأ أثناء رفع التسجيل.',
      );
    } finally {
      setIsUploading(false);
    }
  }

  function resetRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setSavedVoice(null);
    setConsent(false);
    setSeconds(0);
    setError(null);
  }

  return (
    <section className="voice-card" dir="rtl">
      <div className="voice-card__header">
        <div>
          <span className="voice-card__eyebrow">حكاية بصوتك</span>
          <h2>احكي القصة كما تتذكرها</h2>
          <p>سجّل صوتك، وسنحوّله إلى نص ونرسله للمراجعة قبل أي نشر.</p>
        </div>
        <div className={`voice-dot ${isRecording ? 'voice-dot--active' : ''}`} />
      </div>

      {isRecording && (
        <div className="recording-state">
          <div className="recording-pulse" />
          <strong>جاري التسجيل</strong>
          <span>{formatTime(seconds)}</span>
        </div>
      )}

      <div className="voice-actions">
        {!isRecording && !audioBlob && (
          <button className="voice-button voice-button--primary" onClick={startRecording}>
            🎙️ ابدأ التسجيل
          </button>
        )}

        {isRecording && (
          <button className="voice-button voice-button--danger" onClick={stopRecording}>
            ■ إيقاف التسجيل
          </button>
        )}

        {!isRecording && audioBlob && (
          <>
            <button
              className="voice-button voice-button--primary"
              onClick={saveRecording}
              disabled={isUploading || !consent}
            >
              {isUploading ? 'جاري التحويل إلى نص…' : 'حفظ وتحويل إلى نص'}
            </button>
            <button className="voice-button voice-button--secondary" onClick={resetRecording}>
              تسجيل من جديد
            </button>
          </>
        )}
      </div>

      {audioBlob && !isRecording && !savedVoice && (
        <label className="voice-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
          />
          <span>
            أوافق على حفظ تسجيلي، ومعالجته بخدمة خارجية لتحويل الصوت إلى نص،
            ومراجعته من فريق حكاية قبل نشره.
          </span>
        </label>
      )}

      {audioUrl && !isRecording && (
        <div className="audio-preview">
          <span>التسجيل الأصلي</span>
          <audio controls src={audioUrl} />
        </div>
      )}

      {savedVoice && (
        <div className="transcript-card">
          <div className="transcript-card__title">
            <span>النص المستخرج</span>
            <span className="transcript-card__status">بانتظار المراجعة</span>
          </div>
          <p>{savedVoice.transcript}</p>
          <p className="voice-reference">
            رمز المتابعة: <strong dir="ltr">{savedVoice.referenceCode}</strong>
          </p>
        </div>
      )}

      {error && <p className="voice-error">{error}</p>}
    </section>
  );
}

function getSupportedMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}
