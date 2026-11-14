// Rep Legends mascot: the masked apple superhero (image supplied by the user).
// The previous hand-drawn SVG hero is kept in git history.
import heroUrl from '../assets/hero-apple.png';

export function Hero({ className }: { className?: string }) {
  return <img className={className} src={heroUrl} alt="Rep Legends hero" draggable={false} />;
}
