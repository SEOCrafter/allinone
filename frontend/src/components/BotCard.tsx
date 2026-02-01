import type { Model } from '../data/models'

interface Props {
  model: Model
  onClick: () => void
}

export default function BotCard({ model, onClick }: Props) {
  const formatUsers = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`
    return n.toString()
  }

  return (
    <div className="bot-card" onClick={onClick}>
      <div className="bot-card-icon">
        <img src={model.icon} alt={model.name} draggable={false} />
      </div>
      {model.shortName && (
        <div className="bot-card-name">{model.shortName}</div>
      )}
      <div className="bot-card-desc">{model.description}</div>
      <div className="bot-card-stats">
        <div className="bot-card-stat">
          <svg viewBox="0 0 24 24" fill="#facc15" width="14" height="14">
            <circle cx="12" cy="12" r="10"/>
          </svg>
          <span>{model.cost}</span>
        </div>
        <div className="bot-card-stat">
          <svg viewBox="0 0 24 24" fill="#facc15" width="14" height="14">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <span>{model.rating.toFixed(2)}</span>
        </div>
        <div className="bot-card-stat">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M12 10C14.21 10 16 8.21 16 6C16 3.79 14.21 2 12 2C9.79 2 8 3.79 8 6C8 8.21 9.79 10 12 10Z"/>
            <path d="M20 17.5C20 20 20 22 12 22C4 22 4 20 4 17.5C4 15 7.58 13 12 13C16.42 13 20 15 20 17.5Z"/>
          </svg>
          <span>{formatUsers(model.users)}</span>
        </div>
      </div>
    </div>
  )
}