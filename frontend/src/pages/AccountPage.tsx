import React, { useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BookHeart, Camera, Cloud, Footprints, KeyRound, Loader2, ShieldCheck, UserPlus } from "lucide-react";
import { PageTransition } from "../components/motion";
import { useInterfaceLanguage } from "../context/LanguageContext";
import { AccountError, useAuth } from "../context/AuthContext";
import { journeyTotals } from "../services/accountSync";
import { PhoneField } from "../components/PhoneField";
import { DEFAULT_COUNTRY_CODE, normalizePhone } from "../utils/phone";

const fieldClass =
  "w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-amber transition-colors";
const labelClass =
  "text-xs font-mono uppercase tracking-widest text-brand-muted block mb-1.5";

/**
 * Sign in or create an account with a phone number, the usual identifier in
 * Palestine. An email can be added at sign-up for contact only; it is never a
 * way to log in. `?mode=login` opens the sign-in tab and `?next=/path` returns
 * there afterwards. Guests are never forced here.
 */
export const AccountPage: React.FC = () => {
  const { isArabic } = useInterfaceLanguage();
  const { status, accountsAvailable, signUp, logIn } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signup" | "login">(params.get("mode") === "login" ? "login" : "signup");
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totals = journeyTotals();
  const carried = totals.places + totals.quizzes + totals.narrations + totals.photos + totals.stories;
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/me";

  if (status === "signed-in") return <Navigate to={next} replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!normalizePhone(countryCode, phone)) {
      setError(isArabic ? "تحقق من رقم الهاتف ورمز الدولة." : "Check the phone number and country code.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") await signUp(name, countryCode, phone, password, email);
      else await logIn(countryCode, phone, password);
      navigate(next, { replace: true });
    } catch (caught) {
      const status = caught instanceof AccountError ? caught.status : undefined;
      setError(
        status === 401
          ? (isArabic ? "رقم الهاتف أو كلمة المرور غير صحيحة." : "The phone number or password is incorrect.")
          : status === 409
            ? caught instanceof Error && /email/i.test(caught.message)
              ? (isArabic ? "هذا البريد مستخدم في حساب آخر. اتركه فارغاً أو استخدم بريداً آخر." : "This email is already on another account. Leave it empty or use another one.")
              : (isArabic ? "يوجد حساب بهذا الرقم. سجّل الدخول بدلاً من ذلك." : "An account with this phone number already exists. Log in instead.")
            : status === 429
              ? (isArabic ? "محاولات كثيرة غير ناجحة. انتظر بضع دقائق ثم حاول مجدداً." : "Too many failed attempts. Wait a few minutes and try again.")
              : status === 400 && caught instanceof Error
                ? caught.message
                : (isArabic ? "تعذّر الاتصال بخدمة الحسابات الآن." : "The account service could not be reached right now."),
      );
    } finally {
      setBusy(false);
    }
  };

  const perks = [
    { icon: Cloud, ar: "رحلتك محفوظة في حسابك وتتابعك من أي جهاز.", en: "Your journey is kept in your account and follows you to any device." },
    { icon: Camera, ar: "صور ألبومك محفوظة بأمان بدل أن تبقى في متصفح واحد.", en: "Your album photos are stored safely instead of in one browser." },
    { icon: BookHeart, ar: "الحكايات والرحلات التي تحفظها تبقى في جواز سفرك.", en: "Stories and journeys you keep stay in your passport." },
    { icon: ShieldCheck, ar: "تابع حالة الذكريات التي شاركتها دون رمز مرجعي.", en: "Follow the review of memories you share — no reference code needed." },
  ];

  return (
    <PageTransition>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-start">
        <section className="rounded-3xl border border-brand-border bg-brand-surface p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex rounded-full bg-brand-bg p-1 text-xs font-bold" role="tablist">
            {(["signup", "login"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mode === tab}
                onClick={() => { setMode(tab); setError(null); }}
                className={`flex-1 rounded-full px-4 py-2 transition-colors ${mode === tab ? "bg-brand-olive text-white" : "text-brand-muted hover:text-brand-olive"}`}
              >
                {tab === "signup" ? (isArabic ? "إنشاء حساب" : "Create account") : (isArabic ? "تسجيل الدخول" : "Log in")}
              </button>
            ))}
          </div>

          <div>
            <h1 className="font-serif font-black text-3xl text-brand-olive">
              {mode === "signup"
                ? (isArabic ? "احفظ حكايتك" : "Keep your story")
                : (isArabic ? "أهلاً بعودتك" : "Welcome back")}
            </h1>
            <p className="text-sm text-brand-muted mt-2 leading-relaxed">
              {mode === "signup"
                ? (isArabic ? "حساب مجاني يحفظ تقدّمك وصورك وحكاياتك. لا شيء يُنشر دون إذنك." : "A free account that keeps your progress, photos and stories. Nothing is published without you.")
                : (isArabic ? "سجّل الدخول لتكمل رحلتك من حيث توقفت." : "Log in to pick up your journey where you left it.")}
            </p>
          </div>

          {!accountsAvailable && (
            <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              {isArabic ? "خدمة الحسابات غير متاحة الآن. يمكنك المتابعة كضيف، وستبقى رحلتك على هذا الجهاز." : "Accounts are unavailable right now. You can carry on as a guest; your journey stays on this device."}
            </p>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className={labelClass} htmlFor="account-name">{isArabic ? "الاسم" : "Name"}</label>
                <input id="account-name" className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} autoComplete="name" />
              </div>
            )}
            <PhoneField
              id="account-phone"
              label={isArabic ? "رقم الهاتف" : "Phone number"}
              countryCode={countryCode}
              number={phone}
              onCountryCode={setCountryCode}
              onNumber={setPhone}
              preview={mode === "signup"}
            />
            {mode === "signup" && (
              <div>
                <label className={labelClass} htmlFor="account-email">{isArabic ? "البريد الإلكتروني (اختياري)" : "Email (optional)"}</label>
                <input id="account-email" type="email" dir="ltr" className={fieldClass} value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} autoComplete="email" />
                <p className="text-xs text-brand-muted mt-1.5">{isArabic ? "لا يُستخدم لتسجيل الدخول؛ فقط للتواصل معك." : "Not used to log in — only so we can reach you."}</p>
              </div>
            )}
            <div>
              <label className={labelClass} htmlFor="account-password">{isArabic ? "كلمة المرور" : "Password"}</label>
              <input id="account-password" type="password" dir="ltr" className={fieldClass} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "signup" ? 8 : 1} maxLength={200} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
              {mode === "signup" && <p className="text-xs text-brand-muted mt-1.5">{isArabic ? "ثمانية أحرف على الأقل." : "At least 8 characters."}</p>}
            </div>

            {error && <p role="alert" className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

            <button type="submit" disabled={busy || !accountsAvailable} className="w-full rounded-full bg-brand-amber px-6 py-3 text-sm font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "signup" ? <UserPlus className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
              {mode === "signup" ? (isArabic ? "إنشاء الحساب" : "Create account") : (isArabic ? "دخول" : "Log in")}
            </button>
          </form>

          <Link to="/me" className="block text-center text-xs font-bold text-brand-olive hover:text-brand-amber">
            {isArabic ? "المتابعة كضيف ←" : "Continue as a guest →"}
          </Link>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl bg-brand-olive text-white p-6 space-y-3">
            <p className="font-serif font-black text-2xl">{isArabic ? "جواز سفر ضيف" : "Guest passport"}</p>
            <p className="text-sm text-white/80 leading-relaxed">
              {carried > 0
                ? (isArabic
                    ? `على هذا الجهاز ${totals.places} أماكن و${totals.quizzes} اختبارات و${totals.photos} صور و${totals.stories} حكايات. ستنتقل كلها إلى حسابك.`
                    : `This device holds ${totals.places} places, ${totals.quizzes} quizzes, ${totals.photos} photos and ${totals.stories} stories. All of it comes with you.`)
                : (isArabic ? "ابدأ الاستكشاف كضيف متى شئت، وكل ما تجمعه سينتقل إلى حسابك لاحقاً." : "Explore as a guest whenever you like; everything you collect moves into your account later.")}
            </p>
            <p className="text-xs text-white/60 inline-flex items-center gap-1.5"><Footprints className="w-3.5 h-3.5" />{isArabic ? "كضيف، تبقى رحلتك في هذا المتصفح فقط." : "As a guest, your journey stays in this browser only."}</p>
          </div>
          <ul className="rounded-3xl border border-brand-border bg-brand-surface p-6 space-y-4">
            {perks.map(({ icon: Icon, ar, en }) => (
              <li key={en} className="flex gap-3 text-sm text-brand-text leading-relaxed">
                <Icon className="w-5 h-5 shrink-0 text-brand-amber mt-0.5" />
                {isArabic ? ar : en}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </PageTransition>
  );
};
