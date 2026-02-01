interface Props {
  icon: string
  name: string
  size?: number
  className?: string
}

export default function ModelIcon({ icon, name, size = 44, className = '' }: Props) {
  return (
    <img
      src={icon}
      alt={name}
      width={size}
      height={size}
      className={`model-icon-img ${className}`}
      draggable={false}
    />
  )
}