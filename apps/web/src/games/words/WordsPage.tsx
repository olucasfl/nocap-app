import { Link } from '@tanstack/react-router';
import { BackButton } from '@/components/BackButton';
import './classic.css';

/** O grupo Word's (spec 032): os jogos de palavras. Só o Classic está jogável por enquanto. */
export function WordsPage() {
  return (
    <div className="app">
      <main className="screen cw">
        <header className="cw-top">
          <BackButton to="/" />
          <div className="cw-title">Word&apos;s</div>
          <span />
        </header>
        <div className="wp-list">
          <Link to="/words/classic" className="wp-card" data-sfx="start">
            <div className="wp-name">Classic Word&apos;s</div>
            <div className="mono wp-meta">Adivinhe a palavra de 5 letras · Daily, 1, 2 e 4 palavras</div>
          </Link>
          <div className="wp-card soon" aria-disabled="true">
            <div className="wp-name">Connect Word&apos;s</div>
            <div className="mono wp-meta">Em breve · agrupe 16 palavras em 4 grupos</div>
          </div>
          <div className="wp-card soon" aria-disabled="true">
            <div className="wp-name">Bee Word&apos;s</div>
            <div className="mono wp-meta">Em breve · forme palavras com 7 letras</div>
          </div>
        </div>
      </main>
    </div>
  );
}
