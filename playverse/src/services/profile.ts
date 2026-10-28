import { createPersistedStore, useStore } from './store';
import { v, type Validator } from './storage/schema';
import { GAME_IDS, type GameId } from '../types/game';

export const AVATARS = [
  { id: 'fox', emoji: '🦊' },
  { id: 'panda', emoji: '🐼' },
  { id: 'owl', emoji: '🦉' },
  { id: 'octopus', emoji: '🐙' },
  { id: 'tiger', emoji: '🐯' },
  { id: 'frog', emoji: '🐸' },
  { id: 'penguin', emoji: '🐧' },
  { id: 'unicorn', emoji: '🦄' },
  { id: 'whale', emoji: '🐳' },
  { id: 'robot', emoji: '🤖' },
  { id: 'alien', emoji: '👾' },
  { id: 'cat', emoji: '🐱' },
] as const;

export type AvatarId = (typeof AVATARS)[number]['id'];
const AVATAR_IDS = AVATARS.map((a) => a.id) as AvatarId[];

export interface RecentEntry {
  id: GameId;
  at: number;
}

/** Local player profile. No personal data beyond an optional nickname is stored. */
export interface Profile {
  /** Empty string means "use the default localized name". */
  name: string;
  avatar: AvatarId;
  createdAt: number;
  favorites: GameId[];
  recent: RecentEntry[];
}

export const MAX_RECENT = 6;
export const MAX_NAME_LENGTH = 20;

const gameId = v.literal(...GAME_IDS);

const profileValidator: Validator<Profile> = (input, path) =>
  v.object({
    name: v.withDefault(v.string({ maxLength: MAX_NAME_LENGTH }), ''),
    avatar: v.withDefault(v.literal(...AVATAR_IDS), 'fox'),
    createdAt: v.withDefault(v.number({ min: 0 }), Date.now()),
    favorites: v.withDefault(v.array(gameId, { maxLength: GAME_IDS.length }), []),
    recent: v.withDefault(v.array(v.object({ id: gameId, at: v.number({ min: 0 }) }), { maxLength: MAX_RECENT }), []),
  })(input, path);

export const defaultProfile = (): Profile => ({
  name: '',
  avatar: 'fox',
  createdAt: Date.now(),
  favorites: [],
  recent: [],
});

export const profileStore = createPersistedStore<Profile>('profile', { validate: profileValidator, version: 1 }, defaultProfile);

export function useProfile(): Profile {
  return useStore(profileStore);
}

export function updateProfile(patch: Partial<Pick<Profile, 'name' | 'avatar'>>): void {
  profileStore.set((p) => ({
    ...p,
    ...patch,
    name: patch.name !== undefined ? patch.name.slice(0, MAX_NAME_LENGTH) : p.name,
  }));
}

export function toggleFavorite(id: GameId): void {
  profileStore.set((p) => ({
    ...p,
    favorites: p.favorites.includes(id) ? p.favorites.filter((f) => f !== id) : [...p.favorites, id],
  }));
}

/** Marks a game as opened (most recent first, de-duplicated). */
export function markPlayed(id: GameId, at = Date.now()): void {
  profileStore.set((p) => ({
    ...p,
    recent: [{ id, at }, ...p.recent.filter((r) => r.id !== id)].slice(0, MAX_RECENT),
  }));
}

export function avatarEmoji(id: AvatarId): string {
  return AVATARS.find((a) => a.id === id)?.emoji ?? '🦊';
}
