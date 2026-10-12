import type { ReactElement } from 'react'
import type { ArmoryItemRecord, ArmoryStateRecord } from '@app/api/armory_schema.pure.lib.ts'
import { DenButton } from '@app/den/den_button.pure.ui.tsx'
import type { QueryState } from '@app/query/query_state.pure.lib.ts'
import { GRENADE, bulletById, hitsToDefeat, loadoutFor, shotPower, weaponById } from './horde_armory.pure.lib.ts'

/**
 * The armory on Zombie Horde's start screen: the points balance, and every
 * weapon, bullet, and grenade pack with what it does, its price, and whether
 * it's owned. Owned weapons and bullets can be equipped for the next round.
 * Props only: the feature component owns loading, buying, and the selection.
 */

export interface LoadoutChoice {
  readonly weaponId: string
  readonly bulletId: string
}

export interface ArmoryShopProps {
  readonly armory: QueryState<ArmoryStateRecord>
  readonly choice: LoadoutChoice
  readonly onChoose: (choice: LoadoutChoice) => void
  readonly onBuy: (itemId: string) => void
  /** The item a purchase is in flight for, if any. */
  readonly buying: string | null
  /** The item the last purchase bought, to say so on its card; null until something is bought. */
  readonly bought: string | null
  readonly buyError: string | null
}

const plural = (n: number, one: string): string => `${String(n)} ${one}${n === 1 ? '' : 's'}`

/** What an item does, in a kid's words, with the currently chosen gear. */
function effectLine(item: ArmoryItemRecord, choice: LoadoutChoice, owned: readonly string[]): string {
  if (item.kind === 'grenade') return `${plural(item.quantity, 'grenade')}. Blast reach ${String(GRENADE.radius)}m.`
  const weapon = item.kind === 'weapon' ? item.id : choice.weaponId
  const bullet = item.kind === 'bullet' ? item.id : choice.bulletId
  // Show the item's own numbers even before it's owned.
  const power = shotPower(loadoutFor(weapon, bullet, [...owned, item.id]))
  const hits = `Head ${plural(hitsToDefeat(power, 'head'), 'hit')} · Body ${plural(hitsToDefeat(power, 'body'), 'hit')} · Leg ${plural(hitsToDefeat(power, 'leg'), 'hit')}`
  const reload = item.kind === 'weapon' ? weaponById(item.id)?.cooldownMs : undefined
  return reload === undefined ? hits : `Reload ${(reload / 1000).toFixed(2)}s · ${hits}`
}

/** What a kid just got, said right on the card they bought it from. */
function boughtLine(item: ArmoryItemRecord): string {
  if (item.kind === 'grenade') return `Bought ${plural(item.quantity, 'grenade')}!`
  if (item.kind === 'bullet' && item.consumable) return `Bought ${plural(item.quantity, 'round')}!`
  return `Bought! ${item.kind === 'bullet' ? 'Load' : 'Equip'} it to use it.`
}

/** Weapons and standard rounds once owned, plus any special rounds with some left: what a loadout may use. */
export function usableGear(armory: ArmoryStateRecord): readonly string[] {
  return [...armory.owned, ...Object.entries(armory.ammo).flatMap(([id, left]) => (left > 0 ? [id] : []))]
}

function ItemCard({ item, armory, choice, onChoose, onBuy, buying, bought }: { readonly item: ArmoryItemRecord; readonly armory: ArmoryStateRecord; readonly choice: LoadoutChoice; readonly onChoose: (choice: LoadoutChoice) => void; readonly onBuy: (itemId: string) => void; readonly buying: string | null; readonly bought: string | null }): ReactElement {
  const rounds = item.kind === 'bullet' && item.consumable ? (armory.ammo[item.id] ?? 0) : null
  const grenades = item.kind === 'grenade' ? armory.grenades : null
  const usable = rounds === null ? !item.consumable && armory.owned.includes(item.id) : rounds > 0
  const equipped = (item.kind === 'weapon' && choice.weaponId === item.id) || (item.kind === 'bullet' && choice.bulletId === item.id)
  const locked = item.requires !== null && !armory.owned.includes(item.requires)
  const affordable = item.price <= armory.balance
  const known = item.kind === 'grenade' || weaponById(item.id) !== null || bulletById(item.id) !== null
  const needs = item.requires === null ? null : (armory.catalog.find((other) => other.id === item.requires)?.name ?? item.requires)
  const verb = item.kind === 'bullet' ? 'Load' : 'Equip'

  function loadButton(): ReactElement | null {
    if (!usable) return null
    if (equipped) return <span style={{ fontWeight: 800, color: '#3F7A22', fontSize: 14 }}>{item.kind === 'bullet' ? 'Loaded' : 'Equipped'}</span>
    return (
      <DenButton
        label={verb}
        ariaLabel={`${verb} ${item.name}`}
        variant="softGreen"
        shape="pill"
        size="sm"
        onClick={() => {
          onChoose(item.kind === 'weapon' ? { ...choice, weaponId: item.id } : { ...choice, bulletId: item.id })
        }}
      />
    )
  }

  function buyButton(): ReactElement | null {
    // Weapons and standard rounds are bought once; packs again and again.
    if (!item.consumable && usable) return null
    if (locked) return <span style={{ fontSize: 13, color: '#8896AA' }}>Needs {needs}</span>
    return (
      <DenButton
        label={buying === item.id ? 'Buying…' : `Buy · ${String(item.price)}`}
        ariaLabel={`Buy ${item.name} for ${String(item.price)} points`}
        variant="blue"
        shape="pill"
        size="sm"
        disabled={!affordable || buying !== null || !known}
        onClick={() => {
          onBuy(item.id)
        }}
      />
    )
  }

  return (
    <li style={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 18, background: equipped ? '#EEF8E8' : '#FFFFFF', border: `1px solid ${equipped ? '#B9E3A3' : '#EEE4D2'}` }}>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: '#2A2E37' }}>
          {item.name}
          {rounds !== null && <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, color: rounds > 0 ? '#7F5305' : '#98A2B3' }}>{rounds > 0 ? `${String(rounds)} left` : 'none left'}</span>}
          {grenades !== null && <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, color: grenades > 0 ? '#0037DB' : '#98A2B3' }}>{grenades > 0 ? `You have ${String(grenades)}` : 'none yet'}</span>}
        </div>
        <div style={{ fontSize: 13, color: '#5B6576', marginTop: 2 }}>{item.description}</div>
        <div style={{ fontSize: 12, color: '#8896AA', marginTop: 4 }}>{effectLine(item, choice, usableGear(armory))}</div>
        {bought === item.id && (
          <div role="status" style={{ display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 9999, background: '#EEF8E8', color: '#3F7A22', fontSize: 13, fontWeight: 800 }}>
            ✓ {boughtLine(item)}
          </div>
        )}
      </div>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
        {loadButton()}
        {buyButton()}
      </div>
    </li>
  )
}

const SECTIONS = [
  { kind: 'weapon', title: 'Blasters' },
  { kind: 'bullet', title: 'Rounds' },
  { kind: 'grenade', title: 'Grenades' },
] as const

export function ArmoryShop({ armory, choice, onChoose, onBuy, buying, bought, buyError }: ArmoryShopProps): ReactElement {
  if (armory.kind === 'loading') return <p style={{ color: '#8896AA' }}>Opening the armory…</p>
  if (armory.kind === 'failed') {
    return (
      <p role="alert" style={{ color: '#CD2A20' }}>
        The armory couldn&apos;t load ({armory.message}). You can still play with the starter blaster.
      </p>
    )
  }
  const data = armory.data
  return (
    <section aria-label="Armory" style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#2A2E37' }}>Armory</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <span role="status" aria-label="Points" style={{ padding: '6px 14px', borderRadius: 9999, background: '#FDECCE', color: '#7F5305', fontWeight: 800 }}>
            ⭐ {data.balance} points
          </span>
          <span role="status" aria-label="Grenades" style={{ padding: '6px 14px', borderRadius: 9999, background: '#E9F1FF', color: '#0037DB', fontWeight: 800 }}>
            💣 {data.grenades}
          </span>
        </div>
      </div>
      {buyError !== null && (
        <p role="alert" style={{ color: '#CD2A20', margin: '0 0 10px' }}>
          {buyError}
        </p>
      )}
      {SECTIONS.map((section) => (
        <div key={section.kind} style={{ marginBottom: 14 }}>
          <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.09em', textTransform: 'uppercase', color: '#98A2B3' }}>{section.title}</h3>
          <ul aria-label={section.title} style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.catalog
              .filter((item) => item.kind === section.kind)
              .map((item) => (
                <ItemCard key={item.id} item={item} armory={data} choice={choice} onChoose={onChoose} onBuy={onBuy} buying={buying} bought={bought} />
              ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
