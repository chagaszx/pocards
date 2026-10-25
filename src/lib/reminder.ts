import { useEffect } from 'react'
import { db } from '../db/db'
import { getT } from '../i18n'
import { dayKey } from './date'
import { useSettings } from './settings'
import { getStudyDays } from './streak'

const LAST_SENT_KEY = 'pocards-reminder-last'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** Pede permissão para notificar. Devolve true se foi concedida. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

async function checkAndNotify(time: string): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return

  const now = new Date()
  const [hour, minute] = time.split(':').map(Number)
  if (now.getHours() * 60 + now.getMinutes() < hour * 60 + minute) return

  const today = dayKey(now)
  try {
    if (localStorage.getItem(LAST_SENT_KEY) === today) return
  } catch {
    // sem armazenamento: segue
  }

  const studyDays = await getStudyDays()
  if (studyDays.has(today)) return
  const due = await db.cards.where('due').belowOrEqual(Date.now()).count()
  if (due === 0) return

  try {
    localStorage.setItem(LAST_SENT_KEY, today)
  } catch {
    // sem armazenamento: segue
  }

  const t = getT()
  const options: NotificationOptions = { body: t.reminder.body(due), icon: '/pwa-192.png', tag: 'pocards-reminder' }
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration) await registration.showNotification(t.reminder.title, options)
  else new Notification(t.reminder.title, options)
}

/**
 * Lembrete diário enquanto o app está aberto (no navegador).
 * No app de celular (Fase 5) isso vira uma notificação agendada de verdade.
 */
export function useDailyReminder(): void {
  const { reminder } = useSettings()

  useEffect(() => {
    if (!reminder.enabled) return
    const run = () => void checkAndNotify(reminder.time).catch(() => undefined)
    run()
    const id = window.setInterval(run, 60_000)
    return () => window.clearInterval(id)
  }, [reminder.enabled, reminder.time])
}
