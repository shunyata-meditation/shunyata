const meditationEmojis: Record<string, string> = {
  mindfulness: '🌿',
  breathing: '🌬️',
  'body scan': '🪷',
  'loving kindness': '💛',
  walking: '🚶',
  other: '✨',
}

export function meditationEmoji(name: string) {
  return meditationEmojis[name.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')] ?? '🧘'
}
