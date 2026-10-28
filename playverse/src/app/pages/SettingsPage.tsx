import { useState } from 'react';
import { useI18n, LOCALES, LOCALE_INFO } from '../../i18n';
import { updateSettings, useSettings, type MotionPreference, type ThemePreference } from '../../services/settings';
import { AVATARS, MAX_NAME_LENGTH, updateProfile, useProfile } from '../../services/profile';
import { supportsVibration } from '../../services/feedback';
import { resetAllProgress } from '../../services/reset';
import { isPersistent } from '../../services/storage/storage';
import { SegmentedControl, Switch } from '../../components/Controls';
import { ConfirmDialog } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Flag } from '../../components/brand/Flag';
import { Logo } from '../../components/brand/Logo';
import { toast } from '../../components/Toast';
import { PageTopBar } from './shared';
import { isIos, isStandalone, useInstallPrompt } from '../pwa';


export function SettingsPage() {
  const { m, locale, setLocale } = useI18n();
  const s = m.common.settings;
  const settings = useSettings();
  const profile = useProfile();
  const [confirmReset, setConfirmReset] = useState(false);
  const { canInstall, install } = useInstallPrompt();
  const standalone = isStandalone();

  return (
    <div className="page settings">
      <PageTopBar title={s.title} back />

      <section className="panel" aria-labelledby="profile-title">
        <h2 id="profile-title" className="section-title">
          <Icon name="user" size={18} /> {s.profile}
        </h2>
        <label className="field">
          <span className="field__label">{s.playerName}</span>
          <input
            className="input"
            value={profile.name}
            maxLength={MAX_NAME_LENGTH}
            placeholder={s.defaultPlayerName}
            autoComplete="nickname"
            onChange={(e) => updateProfile({ name: e.target.value })}
          />
          <span className="field__hint">{s.playerNameHint}</span>
        </label>
        <fieldset className="field">
          <legend className="field__label">{s.avatar}</legend>
          <div className="avatar-picker">
            {AVATARS.map((a) => (
              <label key={a.id} className={profile.avatar === a.id ? 'avatar-option is-selected' : 'avatar-option'}>
                <input type="radio" name="avatar" value={a.id} checked={profile.avatar === a.id} onChange={() => updateProfile({ avatar: a.id })} className="visually-hidden" />
                <span aria-hidden="true">{a.emoji}</span>
                <span className="visually-hidden">{m.common.avatars[a.id]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="panel" aria-labelledby="lang-title">
        <h2 id="lang-title" className="section-title">
          <Icon name="globe" size={18} /> {s.language}
        </h2>
        <div className="lang-options" role="radiogroup" aria-labelledby="lang-title">
          {LOCALES.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={locale === l} className={locale === l ? 'lang-option is-selected' : 'lang-option'} onClick={() => setLocale(l)} lang={LOCALE_INFO[l].intl}>
              <Flag locale={l} size={28} />
              <span>{LOCALE_INFO[l].label}</span>
              {locale === l && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
        <p className="field__hint">{s.languageHint}</p>
      </section>

      <section className="panel" aria-labelledby="appearance-title">
        <h2 id="appearance-title" className="section-title">
          <Icon name="sparkle" size={18} /> {s.appearance}
        </h2>
        <SegmentedControl<ThemePreference>
          label={s.theme.label}
          showLabel
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { value: 'dark', label: s.theme.dark },
            { value: 'light', label: s.theme.light },
            { value: 'system', label: s.theme.system },
          ]}
        />
        <SegmentedControl<MotionPreference>
          label={s.motion.label}
          showLabel
          value={settings.motion}
          onChange={(motion) => updateSettings({ motion })}
          options={[
            { value: 'full', label: s.motion.full },
            { value: 'reduce', label: s.motion.reduce },
            { value: 'system', label: s.motion.system },
          ]}
        />
      </section>

      <section className="panel" aria-labelledby="feedback-title">
        <h2 id="feedback-title" className="section-title">
          <Icon name="volume" size={18} /> {s.feedback}
        </h2>
        <Switch checked={settings.sound} onChange={(sound) => updateSettings({ sound })} label={s.sound} icon={<Icon name={settings.sound ? 'volume' : 'volumeOff'} size={18} />} />
        <Switch
          checked={settings.haptics && supportsVibration()}
          disabled={!supportsVibration()}
          onChange={(haptics) => updateSettings({ haptics })}
          label={s.haptics}
          description={supportsVibration() ? undefined : s.hapticsUnsupported}
          icon={<Icon name="vibrate" size={18} />}
        />
      </section>

      <section className="panel" aria-labelledby="data-title">
        <h2 id="data-title" className="section-title">
          <Icon name="layers" size={18} /> {s.data.title}
        </h2>
        {!isPersistent() && (
          <p className="notice notice--warning" role="note">
            {s.data.memoryOnly}
          </p>
        )}
        <Button variant="danger" icon="trash" onClick={() => setConfirmReset(true)}>
          {s.data.resetAll}
        </Button>
      </section>

      <section className="panel about" aria-labelledby="about-title">
        <h2 id="about-title" className="section-title">
          <Icon name="info" size={18} /> {s.about.title}
        </h2>
        <Logo className="about__logo" />
        <div className="install-box">
          {standalone ? (
            <p className="muted small">{m.common.pwa.installed}</p>
          ) : canInstall ? (
            <>
              <p className="small">{m.common.pwa.installHint}</p>
              <Button variant="gold" icon="arrowDown" onClick={() => void install()}>
                {m.common.pwa.install}
              </Button>
            </>
          ) : isIos() ? (
            <p className="small">{m.common.pwa.iosHint}</p>
          ) : null}
        </div>
        <p className="muted small center">{s.about.version(__APP_VERSION__)}</p>
        <p>{s.about.privacy}</p>
        <p>{s.about.offline}</p>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title={s.data.resetAllTitle}
        body={s.data.resetAllBody}
        confirmLabel={s.data.resetAll}
        tone="danger"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          resetAllProgress();
          setConfirmReset(false);
          toast(s.data.resetDone, { tone: 'success' });
        }}
      />
    </div>
  );
}
