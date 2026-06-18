import { VoyageShip } from 'argus';

// Ink-linework ship illustration with one prop — `state` — that re-rigs the
// vessel (sails, tilt, waterline) to narrate a voyage phase. Sweeping every
// state is the story: it's the whole point of the component.
const states = [
  ['sailing', '항해 중'],
  ['docked', '정박'],
  ['arrived', '입항'],
  ['verified', '검증됨'],
  ['adrift', '표류'],
  ['wrecked', '난파'],
] as const;

export const States = () => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, alignItems: 'flex-end' }}>
    {states.map(([state, label]) => (
      <figure key={state} style={{ margin: 0, textAlign: 'center' }}>
        <VoyageShip state={state} size={108} title={label} />
        <figcaption
          className="bp-mono"
          style={{ marginTop: 8, fontSize: 11, letterSpacing: '0.08em', opacity: 0.7 }}
        >
          {state}
        </figcaption>
      </figure>
    ))}
  </div>
);
