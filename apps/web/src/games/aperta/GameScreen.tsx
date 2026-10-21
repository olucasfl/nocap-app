import {
  GRIMOIRES,
  choiceLockRemaining,
  formatDecimal,
  formatNumber,
  fragmentsAvailable,
} from '@nocap/games';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { apertaSfx, apertaVibrate } from '@/lib/aperta-audio';
import { LOW_END } from './perf';
import { cuesFor, playCue, type CueInput } from './cues';
import { AstroMedal } from './AstroMedal';
import { BigButton } from './BigButton';
import { ChoiceModal } from './ChoiceModal';
import { AchievementsPage } from './AchievementsPage';
import { achievementCounts } from './achievements-logic';
import { CollapseModal } from './CollapseModal';
import { eventView, gaiaPreviews, missionView, newInSpaceView, regionMenuItems } from './content-logic';
import { FieldObjects, SignalChip } from './FieldObjects';
import { GamePage, PageIcon, PAGE_TITLE } from './GamePage';
import { GrimoiresPage } from './GrimoiresPage';
import { RegionBackdrop } from './regions';
import { RegionMenu } from './RegionMenu';
import { EventChip, EventFx, MissionChip, NewInSpace } from './StatusStrips';
import { SpaceArtSprite } from './SpaceArtSprite';
import { SpaceObject, type SpaceObjectKind } from './SpaceObject';
import { FirstGrimoireModal, TutorialOverlay } from './Tutorial';
import { TreePage } from './TreePage';
import { UpgradesPage } from './UpgradesPage';
import type { GameController, GameEvent } from './game-controller';
import {
  NOTICE_MS,
  affordableCount,
  collapseView,
  astroFor,
  comboView,
  createHoldLimiter,
  energyView,
  capturedTitle,
  floatText,
  objectArt,
  objectSlot,
  rewardText,
  signalView,
  togglePage,
  type PageName,
} from './game-logic';
import { tutorialPageAllowed, tutorialView } from './tutorial-logic';
import { useGameSnapshot } from './useApertaGame';
import './art.css';
import './game.css';
import './content.css';
import './polish.css';

interface Props {
  controller: GameController;
  /** Volta ao título (o controlador já salvou). */
  onExit: () => void;
}

interface Burst {
  id: number;
  gain: number;
  /** Gira as faíscas para dois toques seguidos não saírem iguais. */
  turn: number;
  drift: number;
}

interface Notice {
  id: number;
  title: string;
  text: string;
  astro?: ReturnType<typeof astroFor>;
  /** Aviso de captura: mostra o objeto no lugar do astro. */
  object?: SpaceObjectKind;
}

/** Efeito de uma captura: anel e texto saindo de onde o objeto estava. */
interface Capture {
  id: number;
  x: number;
  y: number;
  kind: SpaceObjectKind;
  text: string;
}

const BURST_MS = 900;
const CAPTURE_MS = 1000;
const MAX_BURSTS = 5;
const SPARKS = 8;
const SPARK_ANGLES = Array.from({ length: LOW_END ? 4 : SPARKS }, (_, i) => (360 / (LOW_END ? 4 : SPARKS)) * i);

function pageNotice(page: PageName, affordable: number, albumCount: number, collapses: number, achievements: { earned: number; total: number }): string {
  switch (page) {
    case 'upgrades':
      return affordable > 0
        ? `Você pode comprar ${affordable} ${affordable === 1 ? 'melhoria' : 'melhorias'} agora.`
        : 'Junte mais poeira estelar para comprar melhorias.';
    case 'grimoires':
      return albumCount > 0
        ? `Você já descobriu ${albumCount} ${albumCount === 1 ? 'grimório' : 'grimórios'}.`
        : 'Encha a barra de energia para ganhar seu primeiro grimório.';
    case 'achievements':
      return `${achievements.earned} de ${achievements.total} conquistas ganhas. Elas contam do primeiro toque em diante.`;
    case 'tree':
      return collapses > 0 ? 'Gaste seus Fragmentos nos ramos da árvore.' : 'Os ramos se abrem depois do seu primeiro colapso.';
  }
}

/** A tela de jogo: HUD, botão, energia, dock, páginas e a escolha de grimório (spec 038, 3.4 e 3.5). */
export function GameScreen({ controller, onExit }: Props) {
  const { state, now, paused, saveFailures } = useGameSnapshot(controller);
  const [page, setPage] = useState<PageName | null>(null);
  const [pressed, setPressed] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [achNotice, setAchNotice] = useState<{ id: number; title: string; text: string } | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [freshGrimoire, setFreshGrimoire] = useState(false);
  const [collapseOpen, setCollapseOpen] = useState(false);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const [flash, setFlash] = useState<number | null>(null);

  const pending = state.run.pending;
  const tutorial = state.tutorial === 'done' ? null : state.tutorial;
  // Os handlers de teclado e toque leem isto sem refazer os listeners a cada render.
  const blocked = useRef(false);
  blocked.current = page !== null || pending !== null || collapseOpen || regionsOpen;
  const pageRef = useRef(page);
  pageRef.current = page;
  const tutorialRef = useRef(tutorial);
  tutorialRef.current = tutorial;
  const timers = useRef(new Set<number>());
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);
  useEffect(() => {
    const live = timers.current;
    return () => {
      for (const id of live) window.clearTimeout(id);
    };
  }, []);

  const noticeTimer = useRef<number | null>(null);
  const achTimer = useRef<number | null>(null);
  useEffect(() => {
    return controller.onEvent((e: GameEvent) => {
      if (e.type === 'press') {
        apertaSfx.clack(e.combo);
        apertaVibrate(8);
        setBursts((list) => [
          ...list.slice(-(MAX_BURSTS - 1)),
          { id: e.id, gain: e.gain, turn: (e.id * 37) % 45, drift: ((e.id * 53) % 61) - 30 },
        ]);
        later(() => setBursts((list) => list.filter((b) => b.id !== e.id)), BURST_MS);
      } else if (e.type === 'achievement') {
        apertaSfx.win();
        apertaVibrate([12, 40, 12]);
        if (achTimer.current !== null) window.clearTimeout(achTimer.current);
        setAchNotice({ id: Date.now(), title: 'Conquista', text: e.name });
        achTimer.current = later(() => setAchNotice(null), NOTICE_MS * 1.4);
      } else if (e.type === 'choice-open') {
        apertaSfx.flip();
      } else if (e.type === 'capture') {
        const art = objectArt(e.kind);
        apertaSfx.ding(art === 'asteroid' || art === 'probe' ? art : undefined);
        apertaVibrate(14);
        const text = rewardText(e.preview);
        const slot = objectSlot(e.objectId);
        setCaptures((list) => [...list.slice(-3), { id: e.objectId, x: slot.x, y: slot.y, kind: art, text: floatText(e.preview) }]);
        later(() => setCaptures((list) => list.filter((c) => c.id !== e.objectId)), CAPTURE_MS);
        if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
        setNotice({ id: Date.now(), title: capturedTitle(e.kind), text, object: art });
        noticeTimer.current = later(() => setNotice(null), NOTICE_MS);
      } else if (e.type === 'collapse') {
        apertaSfx.collapse();
        apertaVibrate([30, 60, 30, 60, 90]);
        setFlash(Date.now());
        later(() => setFlash(null), 1200);
        setCollapseOpen(false);
        setPage(null);
        if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
        setNotice({
          id: Date.now(),
          title: 'Estrela colapsada',
          text: `Página guardada no Atlas: ${e.pageName}. +${e.fragments} Fragmentos`,
          astro: astroFor(e.pageId, GRIMOIRES.find((g) => g.id === e.pageId)?.family ?? 'planets'),
        });
        noticeTimer.current = later(() => setNotice(null), NOTICE_MS * 2);
      } else {
        apertaSfx.thunk();
        setFreshGrimoire(true);
        const def = GRIMOIRES.find((g) => g.id === e.id);
        if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
        setNotice({
          id: Date.now(),
          title: 'Novo grimório',
          text: e.level > 1 ? `${e.name} subiu para o nível ${e.level}` : e.name,
          astro: astroFor(e.id, def?.family ?? 'planets'),
        });
        noticeTimer.current = later(() => setNotice(null), NOTICE_MS);
      }
    });
  }, [controller, later]);

  // Objeto novo no campo: whoosh. O primeiro render só registra os que já estavam (retomar o save não faz barulho).
  const seenObjects = useRef<Set<number> | null>(null);
  const objects = state.run.objects;
  useEffect(() => {
    const seen = seenObjects.current;
    const ids = new Set(objects.map((o) => o.id));
    seenObjects.current = ids;
    const fresh = seen ? objects.find((o) => !seen.has(o.id)) : undefined;
    if (fresh) {
      const art = objectArt(fresh.kind);
      apertaSfx.whoosh(art === 'asteroid' || art === 'probe' ? art : undefined);
    }
  }, [objects]);

  const doPress = useCallback(() => {
    if (blocked.current) return;
    controller.press();
  }, [controller]);

  const openPage = useCallback((target: PageName) => {
    // No tutorial só abre a página do passo (a dock fora do alvo já está bloqueada; isto cobre o teclado).
    const step = tutorialRef.current;
    if (step !== null && !tutorialPageAllowed(step, target)) return;
    setPage((current) => togglePage(current, target));
    if (target === 'grimoires') {
      setFreshGrimoire(false);
      if (pageRef.current !== 'grimoires') apertaSfx.flip();
    } else if (pageRef.current !== target) {
      apertaSfx.page();
    }
  }, []);

  // Teclado: Espaço/Enter tocam (segurar repete a 6/s), G e M abrem páginas, Esc fecha.
  useEffect(() => {
    const limiter = createHoldLimiter();
    const isOtherControl = (t: EventTarget | null) =>
      t instanceof Element &&
      !!t.closest('button, a, input, select, textarea, [role="button"]') &&
      !t.closest('.ap-bigbtn');
    const isPressKey = (e: KeyboardEvent) => e.code === 'Space' || e.key === ' ' || e.key === 'Enter';
    let flash: number | null = null;

    const onDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isPressKey(e)) {
        if (blocked.current || isOtherControl(e.target)) return;
        // Sem isto o botão focado também clicaria sozinho (Enter repete, Espaço clica ao soltar).
        e.preventDefault();
        if (!limiter.allow(e.repeat, performance.now())) return;
        setPressed(true);
        if (flash !== null) window.clearTimeout(flash);
        flash = window.setTimeout(() => setPressed(false), 90);
        controller.press();
        return;
      }
      if (e.key === 'Escape') {
        if (pageRef.current && tutorialRef.current === null) setPage(null);
        return;
      }
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (k === 'g') openPage('grimoires');
      else if (k === 'm') openPage('upgrades');
    };
    const onUp = (e: KeyboardEvent) => {
      if (isPressKey(e) && !isOtherControl(e.target) && !blocked.current) e.preventDefault();
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      if (flash !== null) window.clearTimeout(flash);
    };
  }, [controller, openPage]);

  // Passo 3 -> 4 quando a página de Melhorias abre; o passo fica salvo.
  useEffect(() => {
    if (tutorial === 3 && page === 'upgrades') controller.tutorialStep(3, 4);
  }, [tutorial, page, controller]);

  const energy = energyView(state);
  const affordable = affordableCount(state);
  const combo = comboView(state, now);
  const signal = signalView(state, now);
  const fragments = fragmentsAvailable(state);
  const albumCount = state.album.length;
  const starReady = tutorial === null && collapseView(state).ready;
  const fresh = pending ? null : newInSpaceView(state);
  const mission = missionView(state);
  const liveEvent = eventView(state, now);
  const regions = regionMenuItems(state);

  // Sons de transição (estrela pronta, evento, missão, região, faixa nova): só na mudança, nunca ao montar.
  const lastCue = useRef<CueInput | null>(null);
  const cReady = starReady;
  const cEvent = liveEvent?.id ?? null;
  const cMission = mission?.done ?? false;
  const cRegion = state.regionId;
  // Sem olhar o modal de escolha aberto: a faixa some e volta, e isso não é novidade.
  const cFresh = newInSpaceView(state)?.key ?? null;
  useEffect(() => {
    const next: CueInput = { starReady: cReady, eventId: cEvent, missionDone: cMission, region: cRegion, freshKey: cFresh };
    const cues = cuesFor(lastCue.current, next);
    lastCue.current = next;
    cues.forEach((cue, i) => (cue === 'chime' ? later(() => playCue(cue), 700) : i === 0 ? playCue(cue) : later(() => playCue(cue), 250 * i)));
  }, [cReady, cEvent, cMission, cRegion, cFresh, later]);

  function exit() {
    void controller.save(true).then(onExit);
  }

  return (
    <section className={`ap-game space-theme ap-screen-in${LOW_END ? ' is-lite' : ''}`} aria-label="Jogo">
      <SpaceArtSprite />
      <RegionBackdrop key={state.regionId} region={state.regionId} paused={paused} />
      {liveEvent && !paused && <EventFx key={liveEvent.id} id={liveEvent.id} lite={LOW_END} />}

      <header className="ap-hud">
        <div className="ap-panel ap-hudp">
          <p className="ap-hudrow">
            <i className="ap-ico ap-ico-coin" aria-hidden="true" />
            <b key={state.stats.clicks} className="ap-bump">
              {formatNumber(state.run.dust)}
            </b>
            <small>poeira</small>
          </p>
          {regions.length > 1 && tutorial === null ? (
            <button
              type="button"
              className="ap-hudrow ap-hudrow-2 ap-hudrow-btn"
              aria-label={`${state.collapses} ${state.collapses === 1 ? 'colapso' : 'colapsos'}. Abrir o menu de regiões`}
              onClick={() => setRegionsOpen(true)}
            >
              <i className="ap-ico ap-ico-swirl" aria-hidden="true" />
              <b>{state.collapses}</b>
              <small>
                {state.collapses === 1 ? 'colapso' : 'colapsos'} <em>Regiões</em>
              </small>
            </button>
          ) : (
            <p className="ap-hudrow ap-hudrow-2">
              <i className="ap-ico ap-ico-swirl" aria-hidden="true" />
              <b>{state.collapses}</b>
              <small>{state.collapses === 1 ? 'colapso' : 'colapsos'}</small>
            </p>
          )}
        </div>
        <button type="button" className="ap-hbtn ap-hbtn-ghost ap-hbtn-exit" onClick={exit}>
          Sair
        </button>
        <button
          type="button"
          className={`ap-hbtn ap-hbtn-tree${state.collapses < 1 ? ' is-dim' : ''}`}
          aria-pressed={page === 'tree'}
          aria-label={fragments > 0 ? `Árvore de Habilidades, ${fragments} Fragmentos` : 'Árvore de Habilidades'}
          onClick={() => openPage('tree')}
        >
          Árvore de Habilidades
          {fragments > 0 && (
            <span className="ap-badge" aria-hidden="true">
              {fragments}
            </span>
          )}
        </button>
      </header>

      <div className="ap-banners">
        {fresh && <NewInSpace view={fresh} onDismiss={() => controller.dismissNew(fresh.key)} />}
        {liveEvent && <EventChip view={liveEvent} />}
        {mission && tutorial === null && <MissionChip view={mission} />}
        {signal && <SignalChip key={state.run.boostUntil} signal={signal} paused={paused} />}
        <div className="ap-pickup-slot" role="status" aria-live="polite">
          {notice && (
            <div key={notice.id} className="ap-pickup">
              <span className="ap-pickup-medal">
                {notice.object ? <SpaceObject kind={notice.object} size={40} /> : notice.astro && <AstroMedal astro={notice.astro} />}
              </span>
              <span>
                <b>{notice.title}</b>
                <small>{notice.text}</small>
              </span>
            </div>
          )}
        </div>
        <div className="ap-pickup-slot" role="status" aria-live="polite">
          {achNotice && (
            <div key={achNotice.id} className="ap-pickup ap-pickup-ach">
              <span className="ap-pickup-medal">
                <AstroMedal astro="galaxy" />
              </span>
              <span>
                <b>{achNotice.title}</b>
                <small>{achNotice.text}</small>
              </span>
            </div>
          )}
        </div>
        {starReady && !pending && (
          <button type="button" className="ap-hbtn ap-hbtn-go ap-ready" onClick={() => setCollapseOpen(true)}>
            Estrela pronta: colapsar
          </button>
        )}
        {saveFailures >= 3 && (
          <div className="ap-savewarn" role="alert">
            <span>Não deu para salvar seu progresso.</span>
            <button type="button" className="ap-hbtn" onClick={() => void controller.save(true)}>
              Tentar de novo
            </button>
          </div>
        )}
      </div>

      <div className="ap-field">
        <div className="ap-stage" data-tut="press">
          <BigButton
            size="100%"
            pressed={pressed}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              setPressed(true);
              doPress();
            }}
            onPointerUp={() => setPressed(false)}
            onPointerCancel={() => setPressed(false)}
            onPointerLeave={() => setPressed(false)}
            // Pointer já tocou; o clique sem posição (detail 0) vem de leitor de tela ou ativação assistiva.
            onClick={(e) => {
              if (e.detail === 0) doPress();
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div className="ap-fx" aria-hidden="true">
            {bursts.map((b) => (
              <span key={b.id} className="ap-burst" style={{ '--turn': `${b.turn}deg`, '--drift': `${b.drift}px` } as CSSProperties}>
                <i className="ap-ring" />
                {SPARK_ANGLES.map((a) => (
                  <i key={a} className="ap-spark" style={{ '--a': `${a}deg` } as CSSProperties} />
                ))}
                <b className="ap-gain">+{formatNumber(b.gain)}</b>
              </span>
            ))}
          </div>
          {combo.points > 0 && (
            <p className="ap-combo">
              <small>Combo</small> x{formatDecimal(combo.mult, 1)}
            </p>
          )}
        </div>
      </div>

      <div className="ap-field ap-field-over">
        <FieldObjects state={state} now={now} paused={paused} onCapture={controller.capture} />
        <div className="ap-capfx" aria-hidden="true">
          {captures.map((c) => (
            <span key={c.id} className="ap-cap" style={{ left: `${c.x}%`, top: `${c.y}%` }} data-kind={c.kind}>
              <i className="ap-cap-ring" />
              <b>{c.text}</b>
            </span>
          ))}
        </div>
      </div>

      <aside className="ap-energy" aria-label="Energia">
        <small>Energia</small>
        <div className="ap-evwrap">
          <div
            className="ap-evbar"
            role="progressbar"
            aria-label="Energia para o próximo grimório"
            aria-valuemin={0}
            aria-valuemax={energy.cap}
            aria-valuenow={energy.value}
          >
            <i className="ap-evfill" style={{ transform: `scaleY(${energy.fill})` }} />
            <i className="ap-evsegs" />
          </div>
          {energy.hot && <span className="ap-evglow" aria-hidden="true" />}
        </div>
        <b className={energy.hot ? 'is-hot' : undefined}>{energy.label}</b>
      </aside>

      <nav className="ap-dock" aria-label="Menu do jogo">
        <button
          type="button"
          className={`ap-dockb${page === 'achievements' ? ' on' : ''}`}
          aria-label={PAGE_TITLE.achievements}
          aria-pressed={page === 'achievements'}
          onClick={() => openPage('achievements')}
        >
          <PageIcon name="achievements" className="ap-dock-i" />
        </button>
        <button
          type="button"
          data-tut="dock-grimoires"
          className={`ap-dockb${page === 'grimoires' ? ' on' : ''}`}
          aria-label={freshGrimoire ? 'Grimórios, tem novidade' : PAGE_TITLE.grimoires}
          aria-pressed={page === 'grimoires'}
          onClick={() => openPage('grimoires')}
        >
          <PageIcon name="grimoires" className="ap-dock-i" />
          {freshGrimoire && (
            <span className="ap-badge" aria-hidden="true">
              !
            </span>
          )}
        </button>
        <button
          type="button"
          data-tut="dock-upgrades"
          className={`ap-dockb ap-dockb-big${page === 'upgrades' ? ' on' : ''}`}
          aria-label={affordable > 0 ? `Melhorias, ${affordable} para comprar` : PAGE_TITLE.upgrades}
          aria-pressed={page === 'upgrades'}
          onClick={() => openPage('upgrades')}
        >
          Melhorias
          {affordable > 0 && (
            <span className="ap-badge" aria-hidden="true">
              {affordable}
            </span>
          )}
        </button>
      </nav>

      {page && (
        <GamePage
          key={page}
          name={page}
          notice={pageNotice(page, affordable, albumCount, state.collapses, achievementCounts(state))}
          onClose={() => setPage(null)}
        >
          {page === 'upgrades' && <UpgradesPage state={state} onBuy={controller.buy} />}
          {page === 'achievements' && <AchievementsPage state={state} />}
          {page === 'tree' && <TreePage state={state} onBuy={controller.buyTree} onRespec={controller.respec} />}
          {page === 'grimoires' ? <GrimoiresPage state={state} onCollapse={() => setCollapseOpen(true)} onFavorite={controller.setFavorite} /> : undefined}
        </GamePage>
      )}

      {pending && (
        <ChoiceModal
          key={pending.openedAt}
          pending={pending}
          lockRemaining={choiceLockRemaining(state, now)}
          build={state.run.build}
          paused={paused}
          onSelect={controller.select}
          onConfirm={controller.choose}
          onReroll={controller.reroll}
          gain={gaiaPreviews(state, pending.offers)}
        />
      )}

      {regionsOpen && (
        <RegionMenu
          items={regions}
          onPick={(id) => {
            if (id !== state.regionId) controller.setRegion(id);
            setRegionsOpen(false);
          }}
          onClose={() => setRegionsOpen(false)}
        />
      )}

      {collapseOpen && starReady && !pending && (
        <CollapseModal state={state} onCancel={() => setCollapseOpen(false)} onConfirm={controller.collapse} />
      )}

      {flash !== null && (
        <div key={flash} className="ap-flash" aria-hidden="true">
          <i />
        </div>
      )}

      {tutorial === 2 && <FirstGrimoireModal onDone={() => controller.tutorialStep(2, 3)} />}
      {tutorial !== null && (
        <TutorialOverlay
          view={tutorialView(tutorial, page)}
          onSkip={controller.tutorialSkip}
          onFinish={() => {
            apertaSfx.win();
            controller.tutorialSkip();
          }}
        />
      )}
    </section>
  );
}
