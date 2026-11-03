import { useEffect, useState } from 'react';
import { FS_SHOP, type FsShopItem } from '@nocap/games';
import { WeaponIcon } from './fs-icons';
import { bindLabel, useFsSettings } from './fs-settings';

/**
 * A loja (tecla B), no desenho do CS: uma coluna por categoria. Números escolhem a coluna e depois o item; também dá para
 * clicar. O dinheiro é infinito neste modo, então nada é cobrado. Itens que ainda não existem aparecem apagados.
 */
export function FsShop({
  onBuy,
  onClose,
  owned,
}: {
  onBuy: (item: FsShopItem) => void;
  onClose: () => void;
  /** Ids dos itens que a pessoa já tem em uso (aparecem marcados). */
  owned: string[];
}) {
  const buyKey = useFsSettings((st) => st.binds.buy);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  const [col, setCol] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const buy = (item: FsShopItem) => {
    if (item.soon) return;
    onBuy(item);
    setFlash(item.id);
    const key = Date.now();
    setToast({ key, text: `Comprou: ${item.name}` });
    window.setTimeout(() => setToast((t) => (t && t.key === key ? null : t)), 1650);
    window.setTimeout(() => setFlash((f) => (f === item.id ? null : f)), 350);
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
  }, [col, buyKey]);

  return (
    <div className="fss" role="dialog" aria-label="Loja" data-testid="fs-shop">
      {toast && (
        <div key={toast.key} className="fss-toast" role="status" data-testid="fs-shop-toast">
          {toast.text}
        </div>
      )}
      <div className="fss-head">
        <b>Loja</b>
        <span className="mono">Dinheiro: $ ∞</span>
        <span className="mono fss-key">
          {col === null ? 'Aperte 1 a 5 para escolher a coluna' : 'Aperte o número do item'} · {bindLabel(buyKey)} fecha
        </span>
      </div>
      <div className="fss-cols">
        {FS_SHOP.map((c, ci) => (
          <section
            key={c.id}
            className={`fss-col${col === ci ? ' on' : ''}`}
            data-testid={`fs-shop-col-${c.id}`}
          >
            <h4 onClick={() => setCol(ci)}>
              <i>{ci + 1}</i> {c.label}
            </h4>
            <ul>
              {c.items.map((it, ii) => (
                <li key={it.id}>
                  <button
                    type="button"
                    className={`fss-item${it.soon ? ' soon' : ''}${owned.includes(it.id) ? ' own' : ''}${flash === it.id ? ' bought' : ''}`}
                    disabled={it.soon}
                    onClick={() => buy(it)}
                    data-testid={`fs-buy-${it.id}`}
                  >
                    <i>{ii + 1}</i>
                    <span>{it.name}</span>
                    {it.weapon && <WeaponIcon id={it.weapon} className="fss-ico" />}
                    <em className="mono">
                      {it.soon ? 'em breve' : owned.includes(it.id) ? 'em uso' : `$${it.price}`}
                    </em>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <button type="button" className="fss-close" onClick={onClose} data-testid="fs-shop-close">
        Fechar
      </button>
    </div>
  );
}
