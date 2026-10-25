import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Segmented, SettingRow, Switch } from '../components/controls'
import { clearAllData } from '../db/db'
import { useT } from '../i18n'
import { exportBackup, importBackup } from '../lib/backup'
import { notificationsSupported, requestNotificationPermission } from '../lib/reminder'
import { updateSettings, useSettings, type Language, type ThemeSetting } from '../lib/settings'
import { playSound } from '../lib/sound'

/** Aba Configurações: aparência, sons, notificações, dados e informações do app. */
export default function SettingsPage() {
  const t = useT()
  const settings = useSettings()
  const fileInput = useRef<HTMLInputElement>(null)
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    notificationsSupported() ? Notification.permission : 'unsupported',
  )

  async function handleImport(file: File | undefined) {
    if (!file) return
    try {
      const result = await importBackup(await file.text())
      playSound('complete')
      alert(t.settings.importSuccess(result.decks, result.cards))
    } catch {
      alert(t.settings.importInvalid)
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function handleClear() {
    if (!window.confirm(t.settings.clearConfirm1)) return
    if (!window.confirm(t.settings.clearConfirm2)) return
    await clearAllData()
  }

  function handleSound(enabled: boolean) {
    updateSettings({ sound: enabled })
    if (enabled) playSound('good', true)
  }

  async function handleReminder(enabled: boolean) {
    if (enabled) {
      const granted = await requestNotificationPermission()
      setPermission(notificationsSupported() ? Notification.permission : 'unsupported')
      if (!granted) return
    }
    updateSettings({ reminder: { ...settings.reminder, enabled } })
  }

  const themeOptions: { value: ThemeSetting; label: string }[] = [
    { value: 'dark', label: t.settings.themes.dark },
    { value: 'light', label: t.settings.themes.light },
    { value: 'system', label: t.settings.themes.system },
  ]
  // Nomes dos idiomas no idioma escolhido (ex.: em português aparece "Inglês", não "English")
  const languageOptions = (Object.keys(t.settings.languages) as Language[]).map((value) => ({
    value,
    label: t.settings.languages[value],
  }))

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-[26px] font-semibold tracking-tight">{t.settings.title}</h1>

      <section>
        <p className="label mb-2">{t.settings.appearance}</p>
        <div className="space-y-5 border-t border-line pt-4">
          <div className="space-y-2">
            <div>
              <p className="font-medium">{t.settings.theme}</p>
              <p className="mt-0.5 text-[13px] text-muted">{t.settings.themeDesc}</p>
            </div>
            <Segmented
              label={t.settings.theme}
              value={settings.theme}
              options={themeOptions}
              onChange={(theme) => updateSettings({ theme })}
            />
          </div>
          <div className="space-y-2 border-b border-line pb-5">
            <div>
              <p className="font-medium">{t.settings.language}</p>
              <p className="mt-0.5 text-[13px] text-muted">{t.settings.languageDesc}</p>
            </div>
            <Segmented
              label={t.settings.language}
              value={settings.language}
              options={languageOptions}
              onChange={(language) => updateSettings({ language })}
            />
          </div>
        </div>
      </section>

      <section>
        <p className="label mb-2">{t.settings.sounds}</p>
        <ul className="border-t border-line">
          <SettingRow id="setting-sound" title={t.settings.soundToggle} description={t.settings.soundDesc}>
            <Switch checked={settings.sound} onChange={handleSound} labelledBy="setting-sound" />
          </SettingRow>
        </ul>
      </section>

      <section>
        <p className="label mb-2">{t.settings.fun}</p>
        <ul className="border-t border-line">
          <SettingRow id="setting-hero" title={t.settings.heroToggle} description={t.settings.heroDesc}>
            <Switch
              checked={settings.heroMode}
              onChange={(heroMode) => updateSettings({ heroMode })}
              labelledBy="setting-hero"
            />
          </SettingRow>
        </ul>
      </section>

      <section>
        <p className="label mb-2">{t.settings.notifications}</p>
        <ul className="border-t border-line">
          <SettingRow id="setting-reminder" title={t.settings.reminderToggle} description={t.settings.reminderDesc}>
            <Switch
              checked={settings.reminder.enabled && permission === 'granted'}
              onChange={handleReminder}
              labelledBy="setting-reminder"
            />
          </SettingRow>
          {settings.reminder.enabled && permission === 'granted' && (
            <SettingRow id="setting-reminder-time" title={t.settings.reminderTime}>
              <input
                type="time"
                aria-labelledby="setting-reminder-time"
                value={settings.reminder.time}
                onChange={(e) =>
                  e.target.value && updateSettings({ reminder: { ...settings.reminder, time: e.target.value } })
                }
                className="field h-11 w-32 font-mono"
              />
            </SettingRow>
          )}
        </ul>
        {permission === 'denied' && <p className="mt-3 text-[13px] leading-snug text-again">{t.settings.permissionDenied}</p>}
        {permission === 'unsupported' && <p className="mt-3 text-[13px] leading-snug text-muted">{t.settings.unsupported}</p>}
        <p className="mt-3 text-[13px] leading-snug text-muted">{t.settings.reminderNote}</p>
      </section>

      <section>
        <p className="label mb-2">{t.settings.data}</p>
        <ul className="border-t border-line">
          <SettingRow title={t.settings.exportTitle} description={t.settings.exportDesc}>
            <button className="btn btn-ghost shrink-0" onClick={() => exportBackup()}>
              {t.settings.export}
            </button>
          </SettingRow>
          <SettingRow title={t.settings.importTitle} description={t.settings.importDesc}>
            <button className="btn btn-ghost shrink-0" onClick={() => fileInput.current?.click()}>
              {t.settings.import}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleImport(e.target.files?.[0])}
            />
          </SettingRow>
          <SettingRow title={t.settings.clearTitle} description={t.settings.clearDesc}>
            <button className="btn shrink-0 border border-border text-again hover:bg-surface" onClick={handleClear}>
              {t.settings.clear}
            </button>
          </SettingRow>
        </ul>
        <p className="mt-3 text-[13px] leading-snug text-muted">{t.settings.localNote}</p>
      </section>

      <section>
        <p className="label mb-2">{t.settings.help}</p>
        <ul className="border-t border-line">
          <SettingRow title={t.settings.feedbackTitle} description={t.settings.feedbackDesc}>
            <Link to="/configuracoes/feedback" className="btn btn-ghost shrink-0">
              {t.settings.feedbackOpen}
            </Link>
          </SettingRow>
        </ul>
      </section>

      <section>
        <p className="label mb-2">{t.settings.about}</p>
        <p className="border-t border-line pt-4 text-[13px] leading-relaxed text-muted">
          {t.settings.aboutText}
          <br />
          <a
            href="https://github.com/chagaszx/pocards"
            target="_blank"
            rel="noreferrer"
            className="text-fg underline underline-offset-4"
          >
            {t.settings.github}
          </a>
        </p>
      </section>
    </div>
  )
}
