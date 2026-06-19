interface Props {
  size?: number;
}

export default function Logo({ size = 48 }: Props) {
  return <img src="/logo.png" width={size} height={size} alt="Song Duel" />;
}
