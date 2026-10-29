// Personality profiles. All params 0..1 except skill (1..10). Difficulty = decision quality only; no card tricks.
//  tight: hand-selection tightness  aggr: bet/raise tendency  bluff: bluff frequency  position: positional awareness
//  risk: risk appetite  adapt: uses opponent stats  tiltRes: resistance to tilt  skill: estimate quality / fewer blunders
export const ARCHETYPES = {
  rookie:    { tight: 0.15, aggr: 0.25, bluff: 0.05, position: 0.1, risk: 0.5, adapt: 0.0, tiltRes: 0.2, skill: 2 },
  calling_station: { tight: 0.2, aggr: 0.15, bluff: 0.02, position: 0.2, risk: 0.6, adapt: 0.1, tiltRes: 0.4, skill: 3 },
  wall:      { tight: 0.85, aggr: 0.35, bluff: 0.05, position: 0.5, risk: 0.2, adapt: 0.3, tiltRes: 0.8, skill: 6 },
  grinder:   { tight: 0.6, aggr: 0.45, bluff: 0.12, position: 0.7, risk: 0.35, adapt: 0.5, tiltRes: 0.85, skill: 6 },
  shark:     { tight: 0.45, aggr: 0.8, bluff: 0.35, position: 0.85, risk: 0.7, adapt: 0.6, tiltRes: 0.6, skill: 8 },
  trickster: { tight: 0.35, aggr: 0.65, bluff: 0.55, position: 0.7, risk: 0.8, adapt: 0.5, tiltRes: 0.5, skill: 7 },
  professor: { tight: 0.55, aggr: 0.55, bluff: 0.2, position: 0.9, risk: 0.45, adapt: 0.9, tiltRes: 0.9, skill: 9 },
  closer:    { tight: 0.5, aggr: 0.75, bluff: 0.3, position: 0.8, risk: 0.9, adapt: 0.6, tiltRes: 0.7, skill: 8 },
  maniac:    { tight: 0.05, aggr: 0.95, bluff: 0.6, position: 0.3, risk: 0.95, adapt: 0.1, tiltRes: 0.2, skill: 4 },
  legend:    { tight: 0.5, aggr: 0.7, bluff: 0.3, position: 1.0, risk: 0.6, adapt: 1.0, tiltRes: 1.0, skill: 10 },
  balanced:  { tight: 0.5, aggr: 0.5, bluff: 0.2, position: 0.6, risk: 0.5, adapt: 0.5, tiltRes: 0.6, skill: 6 },
};
export function makeProfile(spec, overrides = {}) {
  const base = typeof spec === 'string' ? ARCHETYPES[spec] : spec;
  if (!base) throw new Error('unknown profile ' + spec);
  return { ...base, ...overrides };
}
/** Generated field filler: skill-scaled personality, deterministic from rng. */
export function randomProfile(rng, skill) {
  const names = ['rookie', 'calling_station', 'wall', 'grinder', 'shark', 'trickster', 'professor', 'closer', 'maniac', 'balanced'];
  const pool = names.filter((n) => Math.abs(ARCHETYPES[n].skill - skill) <= 2.5);
  const pick = pool.length ? pool[Math.floor(rng() * pool.length)] : 'balanced';
  const b = ARCHETYPES[pick];
  const j = () => (rng() - 0.5) * 0.2;
  return { tight: cl(b.tight + j()), aggr: cl(b.aggr + j()), bluff: cl(b.bluff + j()), position: cl(b.position + j()), risk: cl(b.risk + j()), adapt: cl(b.adapt + j()), tiltRes: cl(b.tiltRes + j()), skill: Math.max(1, Math.min(10, Math.round(skill))) , arch: pick };
}
const cl = (x) => Math.max(0, Math.min(1, x));
