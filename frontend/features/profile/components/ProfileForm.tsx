"use client";

import { useState } from "react";
import { AtSign, Calendar, CalendarClock, Compass, MessageCircle, Plus, Target, User, Users, X } from "lucide-react";
import { useProfileStore } from "../store/profileStore";
import type { Profile, ProfileUpdateInput, SocialAccount } from "../services/profile-api";
import { FORMATS, NICHES, PLATFORMS, TIMEZONES } from "@/shared/constants";
import Alert from "@/shared/components/ui/Alert";
import Button from "@/shared/components/ui/Button";
import Field, { FIELD_ICON_CLASS, FIELD_LABEL_CLASS, inputClass } from "@/shared/components/ui/Field";

const NICHE_LABELS: Record<string, string> = {
  tecnologia: "Tecnología",
  fitness: "Fitness",
  finanzas: "Finanzas",
  educacion: "Educación",
  lifestyle: "Lifestyle",
  negocios: "Negocios",
};

const FORMAT_LABELS: Record<string, string> = {
  short_video: "Video corto",
  carousel: "Carrusel",
  story: "Historia",
  long_video: "Video largo",
  post: "Publicación",
};

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};

const REQUIRED_MESSAGE = "Este campo es obligatorio.";

// Campos que el backend trata como obligatorios para un "perfil completo"
// (ver ProfileOnboardingInput en profile-api.ts: sin `?`, a diferencia de
// bio/sub_niche/current_frequency/desired_frequency/timezone). Vaciarlos no
// debe convertirse en `null` en silencio — bloquea el submit.
type RequiredKey = "niche" | "primary_goal" | "tone" | "target_audience";
const REQUIRED_KEYS: RequiredKey[] = ["niche", "primary_goal", "tone", "target_audience"];
type RequiredFieldErrors = Partial<Record<RequiredKey, string>>;

// Campos editables del formulario (todos strings vacíos en vez de null
// para controlar los inputs; se re-mapean a null al armar el diff).
interface EditableFields {
  display_name: string;
  bio: string;
  niche: string;
  sub_niche: string;
  primary_goal: string;
  tone: string;
  target_audience: string;
  current_frequency: string;
  desired_frequency: string;
  preferred_formats: string[];
  timezone: string;
  social_accounts: SocialAccount[];
}

function toEditable(profile: Profile | null): EditableFields {
  return {
    display_name: profile?.display_name ?? "",
    bio: profile?.bio ?? "",
    niche: profile?.niche ?? "",
    sub_niche: profile?.sub_niche ?? "",
    primary_goal: profile?.primary_goal ?? "",
    tone: profile?.tone ?? "",
    target_audience: profile?.target_audience ?? "",
    current_frequency: profile?.current_frequency ?? "",
    desired_frequency: profile?.desired_frequency ?? "",
    preferred_formats: profile?.preferred_formats ?? [],
    timezone: profile?.timezone ?? "",
    social_accounts: profile?.social_accounts ?? [],
  };
}

// Diff entre el estado original (baseline) y el editado: solo incluye
// las claves que realmente cambiaron, para no resobrescribir campos
// que el usuario no tocó (consistente con el contrato de PUT parcial
// del backend — spec: "Partial update preserves other fields").
//
// Precondición: los 4 campos obligatorios (REQUIRED_KEYS) ya fueron
// validados como no vacíos por el llamador (handleSubmit) — acá nunca
// se los mapea a null.
function diffEditable(
  baseline: EditableFields,
  edited: EditableFields,
): ProfileUpdateInput {
  const out: ProfileUpdateInput = {};

  (Object.keys(edited) as (keyof EditableFields)[]).forEach((key) => {
    const before = baseline[key];
    const after = edited[key];

    if (key === "preferred_formats") {
      const beforeArr = before as string[];
      const afterArr = after as string[];
      if (JSON.stringify(beforeArr) !== JSON.stringify(afterArr)) {
        out.preferred_formats = afterArr;
      }
      return;
    }

    if (key === "social_accounts") {
      const beforeArr = before as SocialAccount[];
      const afterArr = after as SocialAccount[];
      if (JSON.stringify(beforeArr) !== JSON.stringify(afterArr)) {
        out.social_accounts = afterArr;
      }
      return;
    }

    if (before === after) return;
    const value = after as string;
    (out as Record<string, unknown>)[key] = value.trim() === "" ? null : value;
  });

  return out;
}

export default function ProfileForm() {
  const profile = useProfileStore((s) => s.profile);
  const error = useProfileStore((s) => s.error);
  const isLoading = useProfileStore((s) => s.isLoading);
  const saveSuccess = useProfileStore((s) => s.saveSuccess);
  const save = useProfileStore((s) => s.save);
  const clearSaveSuccess = useProfileStore((s) => s.clearSaveSuccess);

  // Sincroniza baseline/edited con el perfil del store cuando cambia de
  // identidad (p. ej. tras `load()`). Ajuste de estado durante el
  // render, no dentro de un efecto (react-hooks/set-state-in-effect).
  const [formState, setFormState] = useState(() => ({
    syncedProfile: profile,
    baseline: toEditable(profile),
    edited: toEditable(profile),
  }));
  if (formState.syncedProfile !== profile) {
    setFormState({
      syncedProfile: profile,
      baseline: toEditable(profile),
      edited: toEditable(profile),
    });
  }

  const [fieldErrors, setFieldErrors] = useState<RequiredFieldErrors>({});

  // Revelado progresivo (mismo patrón que Step4Formats.tsx en onboarding):
  // el selector de plataforma + usuario arranca oculto para no apilar dos
  // decisiones de +4 opciones sobre el resto del formulario.
  const [newPlatform, setNewPlatform] = useState<string>(PLATFORMS[0]);
  const [newHandle, setNewHandle] = useState("");
  const [isAddingAccount, setIsAddingAccount] = useState(false);

  function updateField<K extends keyof EditableFields>(
    key: K,
    value: EditableFields[K],
  ): void {
    setFormState((prev) => ({ ...prev, edited: { ...prev.edited, [key]: value } }));
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key as RequiredKey];
      return next;
    });
    clearSaveSuccess();
  }

  function toggleFormat(format: string): void {
    setFormState((prev) => {
      const current = prev.edited.preferred_formats;
      const next = current.includes(format)
        ? current.filter((f) => f !== format)
        : [...current, format];
      return { ...prev, edited: { ...prev.edited, preferred_formats: next } };
    });
    clearSaveSuccess();
  }

  function addSocialAccount(): void {
    if (!newHandle.trim()) return;
    setFormState((prev) => ({
      ...prev,
      edited: {
        ...prev.edited,
        social_accounts: [
          ...prev.edited.social_accounts,
          { platform: newPlatform, handle: newHandle.trim(), url: null, follower_count: null },
        ],
      },
    }));
    setNewHandle("");
    clearSaveSuccess();
  }

  function removeSocialAccount(index: number): void {
    setFormState((prev) => ({
      ...prev,
      edited: {
        ...prev.edited,
        social_accounts: prev.edited.social_accounts.filter((_, i) => i !== index),
      },
    }));
    clearSaveSuccess();
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    const { edited } = formState;
    const errors: RequiredFieldErrors = {};
    REQUIRED_KEYS.forEach((key) => {
      if (edited[key].trim() === "") errors[key] = REQUIRED_MESSAGE;
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    const partial = diffEditable(formState.baseline, formState.edited);
    if (Object.keys(partial).length === 0) return;
    try {
      await save(partial);
    } catch {
      // El error queda reflejado por el store (se muestra abajo).
    }
  }

  const { edited } = formState;

  // La zona detectada por el navegador y la que el creador ya tiene
  // guardada se anteponen a la lista curada cuando no figuran en ella, así
  // un creador fuera de la lista sigue viendo (y conservando) su zona real
  // en vez de perderla en silencio (design.md §7.2/D11). La guardada es
  // imprescindible aparte de la detectada: si difieren (otro dispositivo,
  // VPN, viaje) y solo se antepone la detectada, el <select> se queda sin
  // <option> para el valor guardado y cae a "Sin especificar", que es
  // exactamente la pérdida silenciosa que la lista curada debía evitar.
  // Calculado por render, no se muta la constante.
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOptions = [
    ...new Set(
      [detectedTimezone, edited.timezone].filter(
        (tz): tz is string =>
          typeof tz === "string" &&
          tz.length > 0 &&
          !TIMEZONES.includes(tz as (typeof TIMEZONES)[number]),
      ),
    ),
    ...TIMEZONES,
  ];

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
      {error ? (
        <Alert tone="danger">{error}</Alert>
      ) : saveSuccess ? (
        <Alert tone="success">Perfil actualizado.</Alert>
      ) : null}

      <Field
        id="display_name"
        label="Nombre"
        type="text"
        value={edited.display_name}
        onChange={(e) => updateField("display_name", e.target.value)}
        icon={<User aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
      />

      <div className="space-y-1.5">
        <label htmlFor="bio" className={FIELD_LABEL_CLASS}>
          Biografía
        </label>
        <textarea
          id="bio"
          value={edited.bio}
          onChange={(e) => updateField("bio", e.target.value)}
          rows={3}
          className={inputClass(false, false)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="niche" className={FIELD_LABEL_CLASS}>
          Nicho
        </label>
        <select
          id="niche"
          value={edited.niche}
          onChange={(e) => updateField("niche", e.target.value)}
          aria-invalid={fieldErrors.niche ? true : undefined}
          aria-describedby={fieldErrors.niche ? "niche-message" : undefined}
          className={inputClass(Boolean(fieldErrors.niche), false)}
        >
          <option value="">Selecciona un nicho</option>
          {NICHES.map((n) => (
            <option key={n} value={n}>
              {NICHE_LABELS[n] ?? n}
            </option>
          ))}
        </select>
        {fieldErrors.niche ? (
          <p id="niche-message" role="alert" className="ml-1 text-xs font-light text-danger">
            {fieldErrors.niche}
          </p>
        ) : null}
      </div>

      <Field
        id="sub_niche"
        label="Sub-nicho"
        type="text"
        value={edited.sub_niche}
        onChange={(e) => updateField("sub_niche", e.target.value)}
        icon={<Compass aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
      />

      <Field
        id="primary_goal"
        label="Objetivo principal"
        type="text"
        value={edited.primary_goal}
        onChange={(e) => updateField("primary_goal", e.target.value)}
        error={fieldErrors.primary_goal}
        icon={<Target aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
      />

      <Field
        id="tone"
        label="Tono"
        type="text"
        value={edited.tone}
        onChange={(e) => updateField("tone", e.target.value)}
        error={fieldErrors.tone}
        icon={<MessageCircle aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
      />

      <Field
        id="target_audience"
        label="Audiencia objetivo"
        type="text"
        value={edited.target_audience}
        onChange={(e) => updateField("target_audience", e.target.value)}
        error={fieldErrors.target_audience}
        icon={<Users aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="current_frequency"
          label="Frecuencia actual"
          type="text"
          value={edited.current_frequency}
          onChange={(e) => updateField("current_frequency", e.target.value)}
          placeholder="Ej. 3 por semana"
          icon={<Calendar aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
        />
        <Field
          id="desired_frequency"
          label="Frecuencia deseada"
          type="text"
          value={edited.desired_frequency}
          onChange={(e) => updateField("desired_frequency", e.target.value)}
          placeholder="Ej. 5 por semana"
          icon={<CalendarClock aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className={FIELD_LABEL_CLASS}>Formatos preferidos</legend>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((format) => {
            const id = `preferred-format-${format}`;
            return (
              <label
                key={format}
                htmlFor={id}
                className="flex items-center gap-2 rounded-full border border-glass-edge bg-surface-container-lowest/20 px-3 py-1.5 text-sm text-on-surface"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={edited.preferred_formats.includes(format)}
                  onChange={() => toggleFormat(format)}
                  className="h-4 w-4 accent-primary"
                />
                {FORMAT_LABELS[format] ?? format}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={FIELD_LABEL_CLASS}>Redes sociales</legend>

        {edited.social_accounts.length > 0 ? (
          <ul className="space-y-2">
            {edited.social_accounts.map((account, index) => (
              <li
                key={`${account.platform}-${account.handle}-${index}`}
                className="flex items-center justify-between rounded-xl border border-glass-edge bg-surface-container-lowest/30 px-3 py-2 text-sm text-on-surface"
              >
                <span>
                  {PLATFORM_LABELS[account.platform] ?? account.platform}: @{account.handle}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeSocialAccount(index)}
                  aria-label={`Eliminar red social ${account.platform} ${account.handle}`}
                  className="!w-auto !rounded-sm !p-1.5 !text-danger"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        {isAddingAccount ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="social-platform" className={FIELD_LABEL_CLASS}>
                Plataforma
              </label>
              <select
                id="social-platform"
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                className={inputClass(false, false)}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {PLATFORM_LABELS[p] ?? p}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <Field
                id="social-handle"
                label="Usuario"
                type="text"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder="@usuario"
                icon={<AtSign aria-hidden="true" size={18} strokeWidth={1.5} className={FIELD_ICON_CLASS} />}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={addSocialAccount}
              className="!w-auto inline-flex items-center justify-center gap-2 !py-2.5 px-4"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Agregar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setIsAddingAccount(true)}
            className="!w-auto inline-flex items-center justify-center gap-2 !py-2.5 px-4"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar red social
          </Button>
        )}
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="timezone" className={FIELD_LABEL_CLASS}>
          Zona horaria
        </label>
        <select
          id="timezone"
          value={edited.timezone}
          onChange={(e) => updateField("timezone", e.target.value)}
          className={inputClass(false, false)}
        >
          <option value="">Sin especificar</option>
          {timezoneOptions.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
