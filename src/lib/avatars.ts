export const AVATAR_EMOJI: Record<string, string> = {
  bull: "🐂",
  bear: "🐻",
  fox: "🦊",
  owl: "🦉",
  whale: "🐋",
  lion: "🦁",
  eagle: "🦅",
  chart: "📈",
  diamond: "💎",
  rocket: "🚀",
};

export function getAvatarEmoji(avatar: string | null | undefined): string {
  if (!avatar) return "👤";
  return AVATAR_EMOJI[avatar] ?? "👤";
}
