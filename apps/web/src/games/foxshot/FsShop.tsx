import { useEffect, useState } from 'react';
import { FS_SHOP, fsShopPrice, type FsShopItem, type FsWeaponId } from '@nocap/games';
import { HeartIcon, KitIcon, VestIcon, WeaponIcon } from './fs-icons';
import { bindLabel, useFsSettings } from './fs-settings';
import './fs-mobile.css';

/** Cor de cada seção (faixa do título e brilho do que você já tem). */
const TONE: Record<string, string> = {
  equipment: '#2f5bff',
  pistols: '#ff7d26',
  mid: '#8a5cff',
  rifles: '#3fae5c',
  grenades: '#e0457b',
};

interface Equipped {
  key: number;
  id: FsWeaponId | null;
  name: string;
}

/**
 * A loja (tecla B), dividida em seções como as lojas de tiro táticas: Equipamento, Pistolas, Intermediárias, Fuzis e Granadas.
 * Cada item é um cartão com a silhueta da arma, o nome e o preço; o que você já tem fica destacado ("em uso") e o que ainda
 * não existe aparece apagado ("em breve"). Números escolhem a seção e depois o item; dá para clicar também. O dinheiro é
 * infinito neste modo, então nada é cobrado.
 */
export function FsShop({
  onBuy,
  onClose,
  owned,
  equipped,
  armor,
  helmet,
  nades = [],
  money = null,
  kit = 'na',
}: {
  /** Dinheiro (modo Bomba); sem valor = infinito. */
  money?: number | null;
  /** Alicate de desarme: 'ok' dá para comprar, 'owned' já tem, 'na' não vale aqui. */
  kit?: 'ok' | 'owned' | 'na';
  onBuy: (item: FsShopItem) => void;
  onClose: () => void;
  /** Ids dos itens que a pessoa já tem em uso. */
  owned: string[];
  /** As três armas na mão (para a faixa "Seu equipamento"). */
  equipped: Equipped[];
  armor: number;
  helmet: boolean;
  /** Granadas que tem (aparecem na faixa Seu equipamento). */
  nades?: { id: 'frag' | 'flash' | 'smoke'; name: string; count: number }[];
}) {
  const buyKey = useFsSettings((st) => st.binds.buy);
  const [toast, setToast] = useState<{ key: number; text: string; warn?: boolean } | null>(null);
  const [col, setCol] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // celular: outro desenho (abas na lateral, grade de cartões pequenos); o PC mantém as cinco colunas
  const [compact] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
  );
  const tab = col ?? 0;

  const buy = (item: FsShopItem) => {
    if (item.soon) return;
    const key = Date.now();
    // quem já tem o item não compra de novo
    if (owned.includes(item.id)) {
      setToast({ key, text: `Você já tem: ${item.name}`, warn: true });
      window.setTimeout(() => setToast((t) => (t && t.key === key ? null : t)), 1650);
      return;
    }
    onBuy(item);
    setFlash(item.id);
    setToast({ key, text: `Comprou: ${item.name}` });
    window.setTimeout(() => setToast((t) => (t && t.key === key ? null : t)), 1650);
    window.setTimeout(() => setFlash((f) => (f === item.id ? null : f)), 600);
  };

  const itemRow = (raw: FsShopItem, ii: number) => {
    // o alicate só existe no modo Bomba e só para contra-terrorista
    const it = raw.kit ? { ...raw, soon: kit === 'na' } : raw;
    const own = owned.includes(it.id) || (it.kit === true && kit === 'owned');
    const price = fsShopPrice(it, armor, helmet);
    const poor = money !== null && !it.soon && !own && price > money;
    return (
      <li key={it.id}>
        <button
          type="button"
          className={`fss-item${it.soon ? ' soon' : ''}${poor ? ' poor' : ''}${own ? ' own' : ''}${flash === it.id ? ' bought' : ''}`}
          disabled={it.soon}
          onClick={() => buy(it)}
          data-testid={`fs-buy-${it.id}`}
        >
          <i className="fss-n">{ii + 1}</i>
          <span className="fss-art" aria-hidden="true">
            {it.weapon || it.grenade ? (
              <WeaponIcon id={(it.weapon ?? it.grenade)!} className="fss-ico" />
            ) : it.kit ? (
              <KitIcon className="fss-ico vest" />
            ) : it.armor ? (
              <VestIcon className="fss-ico vest" />
            ) : (
              <span className="fss-blank" />
            )}
          </span>
          <span className="fss-name">{it.name}</span>
          <em className="fss-price mono">{it.soon ? 'em breve' : own ? 'em uso' : `$${price}`}</em>
          {own && <span className="fss-tag">em uso</span>}
        </button>
      </li>
    );
  };

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const n = e.code.startsWith('Digit') ? Number(e.code.slice(5)) : NaN;
      if (e.code === buyKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (!Number.isFinite(n) || n < 1) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (col === null) {
        if (n <= FS_SHOP.length) setCol(n - 1);
      } else {
        const item = FS_SHOP[col]!.items[n - 1];
        if (item) buy(item);
      }
    };
    window.addEventListener('keydown', kd, true);
    return () => window.removeEventListener('keydown', kd, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [col, buyKey, owned]);

  const mineChips = (
    <>
      {equipped.map((w) =>
        w.id ? (
          <span key={w.key} className="fss-chip">
            <i>{w.key}</i>
            <WeaponIcon id={w.id} className="fss-chip-ico" />
            <b>{w.name}</b>
          </span>
        ) : (
          <span key={w.key} className="fss-chip empty">
            <i>{w.key}</i>
            <b>vazio</b>
          </span>
        ),
      )}
      {nades.map((n) => (
        <span key={n.id} className="fss-chip" data-testid={`fs-shop-nade-${n.id}`}>
          <WeaponIcon id={n.id} className="fss-chip-ico" />
          <b>
            {n.name} x{n.count}
          </b>
        </span>
      ))}
      <span className={`fss-chip${armor > 0 ? '' : ' empty'}`}>
        <VestIcon className="fss-chip-ico" />
        <b>{armor > 0 ? 'Colete' : 'Sem colete'}</b>
      </span>
      <span className={`fss-chip${helmet ? '' : ' empty'}`}>
        <HeartIcon className="fss-chip-ico" />
        <b>{helmet ? 'Capacete' : 'Sem capacete'}</b>
      </span>
    </>
  );

  if (compact) {
    const cur = FS_SHOP[tab]!;
    return (
      <div
        className="fss fss-m"
        role="dialog"
        aria-label="Loja"
        data-testid="fs-shop"
        style={{ ['--tone' as string]: TONE[cur.id] }}
      >
        {toast && (
          <div
            key={toast.key}
            className={`fss-toast${toast.warn ? ' warn' : ''}`}
            role="status"
            data-testid="fs-shop-toast"
          >
            {toast.text}
          </div>
        )}
        <header className="fssm-head">
          <b>Loja</b>
          <span className="fss-money mono" data-testid="fs-shop-money">
            {money === null ? '$ ∞' : `$ ${money}`}
          </span>
          <button type="button" className="fss-close" onClick={onClose} data-testid="fs-shop-close">
            Fechar
          </button>
        </header>
        <div className="fssm-body">
          <nav className="fssm-tabs" aria-label="Seções">
            {FS_SHOP.map((c, ci) => (
              <button
                key={c.id}
                type="button"
                className={ci === tab ? 'on' : ''}
                style={{ ['--tone' as string]: TONE[c.id] }}
                onClick={() => setCol(ci)}
                data-testid={`fs-shop-tab-${c.id}`}
              >
                {c.label}
              </button>
            ))}
          </nav>
          <ul className="fssm-grid" data-testid={`fs-shop-col-${cur.id}`}>
            {cur.items.map((raw, ii) => itemRow(raw, ii))}
          </ul>
        </div>
        <footer className="fssm-mine" aria-label="Seu equipamento" data-testid="fs-shop-mine">
          {mineChips}
        </footer>
      </div>
    );
  }

  return (
    <div className="fss" role="dialog" aria-label="Loja" data-testid="fs-shop">
      {toast && (
        <div
          key={toast.key}
          className={`fss-toast${toast.warn ? ' warn' : ''}`}
          role="status"
          data-testid="fs-shop-toast"
        >
          {toast.text}
        </div>
      )}
      <header className="fss-head">
        <b>Loja</b>
        <span className="fss-money mono" data-testid="fs-shop-money">
          {money === null ? '$ ∞' : `$ ${money}`}
        </span>
        <span className="mono fss-key">
          {col === null ? 'Aperte 1 a 5 para escolher a seção' : 'Aperte o número do item'} ·{' '}
          {bindLabel(buyKey)} fecha
        </span>
      </header>

      <div className="fss-cols">
        {FS_SHOP.map((c, ci) => (
          <section
            key={c.id}
            className={`fss-col${col === ci ? ' on' : ''}`}
            style={{ ['--tone' as string]: TONE[c.id] }}
            data-testid={`fs-shop-col-${c.id}`}
          >
            <h4 onClick={() => setCol(ci)}>
              <i>{ci + 1}</i>
              {c.label}
            </h4>
            <ul>{c.items.map((raw, ii) => itemRow(raw, ii))}</ul>
          </section>
        ))}
      </div>

      <footer className="fss-mine" aria-label="Seu equipamento" data-testid="fs-shop-mine">
        <span className="fss-mine-t mono">Seu equipamento</span>
        {mineChips}
        <button type="button" className="fss-close" onClick={onClose} data-testid="fs-shop-close">
          Fechar
        </button>
      </footer>
    </div>
  );
}
