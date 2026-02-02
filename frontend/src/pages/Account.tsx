import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'


type Tab = 'overview' | 'profile' | 'payments' | 'generations' | 'referrals'

interface UserProfile {
  id: string
  email: string
  name: string | null
  phone: string | null
  telegram_id: number | null
  credits_balance: number
  role: string
  created_at: string
}

interface GenerationItem {
  id: string
  type: string
  provider: string
  model: string
  prompt: string | null
  response: string | null
  result_url: string | null
  result_urls: string[] | null
  public_url: string | null
  status: string
  tokens_input: number | null
  tokens_output: number | null
  credits_spent: number
  created_at: string
}

interface PaymentItem {
  id: string
  amount: number
  currency: string
  credits: number
  status: string
  created_at: string
  completed_at: string | null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  const normalized = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z'
  const d = new Date(normalized)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

const NAV: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'Обзор', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
  { key: 'profile', label: 'Профиль', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { key: 'payments', label: 'Платежи', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
  { key: 'generations', label: 'Генерации', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
  { key: 'referrals', label: 'Рефералы', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> },
]

const TYPE_ICON: Record<string, string> = { chat: '💬', image: '🖼️', video: '🎬', audio: '🎵' }
const GEN_FILTERS = [
  { key: '', label: 'Все' },
  { key: 'chat', label: 'Текст' },
  { key: 'image', label: 'Изображения' },
  { key: 'video', label: 'Видео' },
]

export default function Account() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [recentGens, setRecentGens] = useState<GenerationItem[]>([])
  const [generations, setGenerations] = useState<GenerationItem[]>([])
  const [genPage, setGenPage] = useState(1)
  const [genPages, setGenPages] = useState(0)
  const [genFilter, setGenFilter] = useState('')
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [spendings, setSpendings] = useState<GenerationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [refCopied, setRefCopied] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    loadProfile()
    loadRecent()
  }, [user])

  useEffect(() => {
    if (tab === 'generations') loadGenerations()
    if (tab === 'payments') { loadPayments(); loadSpendings() }
  }, [tab, genPage, genFilter])

  const loadProfile = async () => {
    try {
      const res: any = await api.request('/api/v1/user/me')
      if (res.user) setProfile(res.user)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const loadRecent = async () => {
    try {
      const res: any = await api.request('/api/v1/user/history?limit=3')
      if (res.data) setRecentGens(res.data)
    } catch (e) {}
  }

  const loadGenerations = async () => {
    try {
      const p = new URLSearchParams({ page: String(genPage), limit: '20' })
      if (genFilter) p.set('type', genFilter)
      const res: any = await api.request(`/api/v1/user/history?${p}`)
      if (res.data) { setGenerations(res.data); setGenPages(res.pagination?.pages || 0) }
    } catch (e) {}
  }

  const loadPayments = async () => {
    try {
      const res: any = await api.request('/api/v1/payments/history')
      if (res.transactions) setPayments(res.transactions)
    } catch (e) {}
  }

  const loadSpendings = async () => {
    try {
      const res: any = await api.request('/api/v1/user/history')
      if (res.data) setSpendings(res.data)
    } catch (e) {}
  }

  const handleSave = async (field: string) => {
    if (!editValue.trim()) return
    setSaving(true)
    try {
      const body: any = {}
      body[field] = editValue.trim()
      const res: any = await api.request('/api/v1/user/me', { method: 'PATCH', body })
      if (res.user) setProfile(res.user)
      setEditing(null)
    } catch (e: any) { alert(e.message || 'Ошибка') }
    finally { setSaving(false) }
  }

  const startEdit = (field: string, val: string) => { setEditing(field); setEditValue(val || '') }

  const thumbUrl = (g: GenerationItem) => g.public_url || g.result_url || (g.result_urls && g.result_urls[0]) || null

  const handleLogout = () => { logout(); navigate('/login') }

  if (loading) return <div className="account-page"><div className="account-empty"><div className="spinner" /></div></div>

  const renderField = (label: string, field: string, value: string | null | undefined, placeholder: string) => (
    <div className="profile-field">
      <div>
        <div className="profile-field-label">{label}</div>
        {editing === field ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="profile-edit-input" value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave(field)} autoFocus />
            <button className="profile-save-btn" onClick={() => handleSave(field)} disabled={saving}>
              {saving ? '...' : 'Сохранить'}
            </button>
            <button className="profile-cancel-btn" onClick={() => setEditing(null)}>Отмена</button>
          </div>
        ) : (
          <div className={value ? 'profile-field-value' : 'profile-field-empty'}>{value || placeholder}</div>
        )}
      </div>
      {editing !== field && (
        <button className="profile-edit-btn" onClick={() => startEdit(field, value || '')}>Изменить</button>
      )}
    </div>
  )

  const renderOverview = () => (
    <>
      <div className="account-greeting">Здравствуйте, {profile?.name || profile?.email?.split('@')[0]}!</div>
      <div className="account-email">Вы вошли как: {profile?.email}</div>
      <div className="account-balance-card">
        <div>
          <div className="account-balance-label">Баланс токенов</div>
          <div className="account-balance-value">{(profile?.credits_balance || 0).toFixed(0)}</div>
        </div>
        <button className="account-balance-btn" onClick={() => navigate('/tarifs')}>Пополнить</button>
      </div>
      <div className="account-recent-title">
        <span>Недавние генерации</span>
        <span className="account-recent-link" onClick={() => setTab('generations')}>Все генерации →</span>
      </div>
      {recentGens.length === 0 ? (
        <div className="account-empty" style={{ padding: '40px 20px' }}>
          <div className="account-empty-icon">⚡</div>
          <div>Пока нет генераций</div>
        </div>
      ) : (
        <div className="account-recent-grid">
          {recentGens.map(g => (
            <div key={g.id} className="account-recent-card" onClick={() => setTab('generations')}>
              <div className="account-recent-model">{TYPE_ICON[g.type] || '⚡'} {g.model}</div>
              <div className="account-recent-prompt">{g.prompt || '—'}</div>
              <div className="account-recent-meta">
                <span>{fmtDate(g.created_at)}</span>
                <span className="account-recent-cost">{g.credits_spent.toFixed(0)} токенов</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )

  const renderProfile = () => (
    <>
      <div className="account-content-title">Профиль</div>
      <div className="account-content-desc">Управляйте персональными данными: редактируйте имя, электронную почту и номер телефона.</div>
      <div className="profile-fields">
        {renderField('ИМЯ', 'name', profile?.name, 'Не указано')}
        {renderField('ЭЛЕКТРОННАЯ ПОЧТА', 'email', profile?.email, 'Не указана')}
        {renderField('ТЕЛЕФОН', 'phone', profile?.phone, 'Не указан')}
        <div className="profile-field">
          <div>
            <div className="profile-field-label">TELEGRAM</div>
            <div className={profile?.telegram_id ? 'profile-field-value' : 'profile-field-empty'}>
              {profile?.telegram_id ? `ID: ${profile.telegram_id}` : 'Не подключён'}
            </div>
          </div>
          {!profile?.telegram_id && (
            <button className="profile-telegram-btn"
              onClick={() => window.open('https://t.me/umnik_ai_bot?start=auth', '_blank')}>
              <img src="/icons/telegram.svg" alt="" width={16} height={16} />
              Подключить
            </button>
          )}
        </div>
      </div>
    </>
  )

  const renderPayments = () => (
    <>
      <div className="payments-header">
        <div className="account-content-title">Платежи</div>
        <button className="payments-topup-btn" onClick={() => navigate('/tarifs')}>Пополнить баланс</button>
      </div>

      <div className="payments-section-title">✓ История пополнений</div>
      {payments.length === 0 ? (
        <div className="account-empty" style={{ padding: '30px' }}><div>Пока нет платежей</div></div>
      ) : (
        <div className="payments-list">
          {payments.map(p => (
            <div key={p.id} className="payment-row">
              <div className="payment-info">
                <div className="payment-id">#{p.id.slice(0, 8)}</div>
                <div className="payment-date">{fmtDateTime(p.completed_at || p.created_at)}</div>
              </div>
              <span className={`payment-status ${p.status === 'completed' ? 'completed' : p.status === 'pending' ? 'pending' : 'failed'}`}>
                {p.status === 'completed' ? 'Оплачено' : p.status === 'pending' ? 'В ожидании' : 'Ошибка'}
              </span>
              <div className="payment-amount">+{p.credits.toFixed(0)} токенов</div>
            </div>
          ))}
        </div>
      )}

      <div className="payments-section-title" style={{ marginTop: 32 }}>⚡ Списания</div>
      {spendings.length === 0 ? (
        <div className="account-empty" style={{ padding: '30px' }}><div>Пока нет списаний</div></div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12 }}>
          {spendings.filter(s => s.credits_spent > 0).map(s => (
            <div key={s.id} className="spending-row">
              <span className="spending-date">{fmtDateTime(s.created_at)}</span>
              <span className="spending-model">{s.model}</span>
              <span className="spending-cost">−{s.credits_spent.toFixed(0)} токенов</span>
              <span className="spending-link" onClick={() => setTab('generations')}>Результат →</span>
            </div>
          ))}
        </div>
      )}
    </>
  )

  const renderGenerations = () => (
    <>
      <div className="account-content-title">Генерации</div>
      <div className="account-content-desc">Просматривайте историю генераций и отслеживайте их статус.</div>

      <div className="generations-filters">
        {GEN_FILTERS.map(f => (
          <button key={f.key} className={`gen-filter-btn ${genFilter === f.key ? 'active' : ''}`}
            onClick={() => { setGenFilter(f.key); setGenPage(1) }}>{f.label}</button>
        ))}
      </div>

      {generations.length === 0 ? (
        <div className="account-empty"><div className="account-empty-icon">⚡</div><div>Нет генераций</div></div>
      ) : (
        <div className="generations-list">
          {generations.map(g => {
            const thumb = thumbUrl(g)
            const isMedia = g.type === 'image' || g.type === 'video'
            return (
              <div key={g.id} className="generation-row">
                <div className="generation-thumb">
                  {isMedia && thumb ? <img src={thumb} alt="" /> : <span>{TYPE_ICON[g.type] || '⚡'}</span>}
                </div>
                <div className="generation-info">
                  <div className="generation-model">{g.provider} / {g.model}</div>
                  <div className="generation-prompt">
                    {g.type === 'chat' ? (g.prompt || '—') : (g.prompt || 'Без промпта')}
                  </div>
                </div>
                <div className="generation-meta">
                  <div className="generation-cost">{g.credits_spent.toFixed(0)} токенов</div>
                  <div className="generation-date">{fmtDateTime(g.created_at)}</div>
                </div>
                {isMedia && thumb && (
                  <a className="generation-download" href={thumb} target="_blank" rel="noreferrer" title="Скачать">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      {genPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={genPage <= 1} onClick={() => setGenPage(genPage - 1)}>←</button>
          {Array.from({ length: Math.min(genPages, 7) }, (_, i) => i + 1).map(p => (
            <button key={p} className={`page-btn ${genPage === p ? 'active' : ''}`} onClick={() => setGenPage(p)}>{p}</button>
          ))}
          <button className="page-btn" disabled={genPage >= genPages} onClick={() => setGenPage(genPage + 1)}>→</button>
        </div>
      )}
    </>
  )

  const refCode = profile?.id?.slice(0, 8).toUpperCase() || 'XXXXXXXX'
  const refLink = `https://umnik.ai/?ref=${refCode}`

  const renderReferrals = () => (
    <>
      <div className="account-content-title">Реферальная программа</div>
      <div className="account-content-desc">Приглашайте друзей и получайте бонусы за каждую их покупку!</div>

      <div className="referral-stats">
        <div className="referral-stat-card">
          <div className="referral-stat-label">Доступно</div>
          <div className="referral-stat-value">0 токенов</div>
        </div>
        <div className="referral-stat-card">
          <div className="referral-stat-label">В ожидании</div>
          <div className="referral-stat-value yellow">0 токенов</div>
          <div className="referral-stat-sub">Подтверждение через 5 дней</div>
        </div>
        <div className="referral-stat-card">
          <div className="referral-stat-label">Приглашено</div>
          <div className="referral-stat-value">0</div>
          <div className="referral-stat-sub">Рефералов</div>
        </div>
        <div className="referral-stat-card">
          <div className="referral-stat-label">Заработано</div>
          <div className="referral-stat-value green">0 токенов</div>
          <div className="referral-stat-sub">За всё время</div>
        </div>
      </div>

      <div className="referral-link-card">
        <div className="referral-link-title">Ваша реферальная ссылка</div>
        <div className="referral-link-input-group">
          <input className="referral-link-input" value={refLink} readOnly />
          <button className="referral-copy-btn" onClick={() => { navigator.clipboard.writeText(refLink); setRefCopied(true); setTimeout(() => setRefCopied(false), 2000) }}>
            {refCopied ? 'Скопировано!' : 'Копировать'}
          </button>
        </div>
        <div className="referral-code">Ваш код: {refCode}</div>
      </div>

      <div className="referral-how-card">
        <div className="referral-how-title">Как это работает?</div>
        <div className="referral-steps">
          <div className="referral-step">
            <div className="referral-step-num">1</div>
            <div>
              <div className="referral-step-title">Поделитесь ссылкой</div>
              <div className="referral-step-desc">Отправьте реферальную ссылку друзьям</div>
            </div>
          </div>
          <div className="referral-step">
            <div className="referral-step-num">2</div>
            <div>
              <div className="referral-step-title">Друг регистрируется</div>
              <div className="referral-step-desc">Друг регистрируется и пополняет баланс</div>
            </div>
          </div>
          <div className="referral-step">
            <div className="referral-step-num">3</div>
            <div>
              <div className="referral-step-title">Получите бонус</div>
              <div className="referral-step-desc">Вознаграждение за покупки рефералов</div>
            </div>
          </div>
        </div>
      </div>

      <div className="referral-history-card">
        <div className="referral-history-title">История начислений</div>
        <div className="referral-empty">
          <div className="referral-empty-icon">📋</div>
          <div>Пока нет начислений</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Начните приглашать друзей</div>
        </div>
      </div>
    </>
  )

  const content: Record<Tab, () => React.ReactNode> = {
    overview: renderOverview,
    profile: renderProfile,
    payments: renderPayments,
    generations: renderGenerations,
    referrals: renderReferrals,
  }

  return (
    <div className="account-page">
      <div className="account-sidebar">
        <div className="account-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M13.8 12H3"/></svg>
          Аккаунт
        </div>
        <nav className="account-nav">
          {NAV.map(n => (
            <button key={n.key} className={`account-nav-item ${tab === n.key ? 'active' : ''}`}
              onClick={() => setTab(n.key)}>
              {n.icon}
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <button className="account-logout-btn" onClick={handleLogout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Выйти
        </button>
      </div>
      <div className="account-content">
        {content[tab]()}
      </div>
    </div>
  )
}