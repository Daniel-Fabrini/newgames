import { useState } from 'react';
import { GameLayout, GameSetup } from '../../components/GameLayout';
import { HelpDialog } from '../../components/GameDialogs';
import { ConfirmDialog } from '../../components/Modal';
import { Button } from '../../components/Button';
import { SegmentedControl } from '../../components/Controls';
import { LevelSelect } from '../../components/LevelSelect';
import { Crown } from '../../components/brand/Crown';
import { Icon } from '../../components/Icon';
import { useI18n } from '../../i18n';
import { loadGame, saveGame, type SaveSpec } from '../../services/saves';
import { recordMatch, useGameStats } from '../../services/stats';
import { totalStars, useLevelProgress } from '../../services/progress';
import { readValue, writeValue } from '../../services/storage/storage';
import { v } from '../../services/storage/schema';
import { randomSeed } from '../../utils/random';
import { CLASSIC_ADDS, CLASSIC_HINTS, newChallenge, newClassic, type Mode } from './engine';
import { CLASSIC_START_DIGITS } from './generator';
import { challengeSave, classicSave, saveSpecFor, type SavedNumberMatch } from './save';
import { meta } from './meta';
import { PlayScreen } from './PlayScreen';
import './number-match.css';

/** Last mode played: reopening the game resumes it directly when it has a save. */
const MODE_PREF = 'pref:number-match:mode';
const modeValidator = v.literal('classic', 'challenge');

type Screen = { kind: 'setup'; tab: Mode } | { kind: 'play'; mode: Mode; boot: SavedNumberMatch; key: number };

/** A saved game that can be continued (finished games are never resumed). */
function loadResumable(spec: SaveSpec<SavedNumberMatch>): SavedNumberMatch | null {
  const saved = loadGame(spec);
  if (!saved) return null;
  const { status, mode } = saved.game;
  if (status === 'over' || (mode === 'challenge' && status === 'cleared')) return null;
  return saved;
}

/** Resumes the last mode played when it has a save, otherwise the other mode's save; else shows the setup screen. */
function initialScreen(): Screen {
  const pref = readValue<Mode | null>(MODE_PREF, { validate: modeValidator }, null);
  const order: Mode[] = pref === 'challenge' ? ['challenge', 'classic'] : ['classic', 'challenge'];
  for (const mode of order) {
    const saved = loadResumable(saveSpecFor(mode));
    if (saved) return { kind: 'play', mode, boot: saved, key: 0 };
  }
  return { kind: 'setup', tab: pref ?? 'classic' };
}

export default function NumberMatch() {
  const [screen, setScreen] = useState<Screen>(initialScreen);

  const start = (mode: Mode, boot: SavedNumberMatch) => {
    writeValue(MODE_PREF, mode);
    saveGame(saveSpecFor(mode), boot);
    setScreen((prev) => ({ kind: 'play', mode, boot, key: (prev.kind === 'play' ? prev.key : 0) + 1 }));
  };

  if (screen.kind === 'setup') {
    return <SetupScreen tab={screen.tab} onTab={(tab) => setScreen({ kind: 'setup', tab })} onStart={start} />;
  }
  return (
    <PlayScreen
      key={screen.key}
      mode={screen.mode}
      boot={screen.boot}
      onChangeMode={() => setScreen({ kind: 'setup', tab: screen.mode })}
      onLevels={() => setScreen({ kind: 'setup', tab: 'challenge' })}
    />
  );
}

interface SetupScreenProps {
  tab: Mode;
  onTab: (tab: Mode) => void;
  onStart: (mode: Mode, boot: SavedNumberMatch) => void;
}

type Confirm = { kind: 'abandon' } | { kind: 'level'; level: number } | null;

function SetupScreen({ tab, onTab, onStart }: SetupScreenProps) {
  const { m, fmt } = useI18n();
  const t = m.numberMatch;
  const stats = useGameStats('number-match');
  const progress = useLevelProgress('number-match', 'challenges');
  const [classicSaved] = useState(() => loadResumable(classicSave));
  const [challengeSaved] = useState(() => loadResumable(challengeSave));
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [help, setHelp] = useState(false);

  const fresh = (mode: Mode, level = 1): SavedNumberMatch => ({ game: mode === 'classic' ? newClassic(randomSeed()) : newChallenge(level), elapsedMs: 0 });

  const newClassicGame = () => {
    const old = classicSaved?.game;
    if (old && old.status === 'playing' && (old.moves > 0 || old.stage > 1 || old.score > 0)) {
      // Abandoning a run still counts: its score so far is recorded.
      recordMatch(
        'number-match',
        {
          outcome: 'ended',
          score: old.score,
          durationMs: classicSaved.elapsedMs,
          variant: 'classic',
          metrics: { pairsCleared: old.pairsCleared, highestStage: old.stage, rowsCleared: old.rowsCleared },
        },
        meta.metricRules,
      );
    }
    onStart('classic', fresh('classic'));
  };

  const requestNewClassic = () => {
    const old = classicSaved?.game;
    if (old && (old.moves > 0 || old.stage > 1 || old.score > 0)) setConfirm({ kind: 'abandon' });
    else newClassicGame();
  };

  const pickLevel = (level: number) => {
    if (challengeSaved && challengeSaved.game.stage === level) {
      onStart('challenge', challengeSaved);
      return;
    }
    if (challengeSaved && challengeSaved.game.moves > 0) {
      setConfirm({ kind: 'level', level });
      return;
    }
    onStart('challenge', fresh('challenge', level));
  };

  const done = Object.keys(progress.completed).length;

  const actions =
    tab === 'classic' ? (
      classicSaved ? (
        <>
          <Button variant="primary" size="lg" icon="play" block onClick={() => onStart('classic', classicSaved)}>
            {t.setup.continueClassic(classicSaved.game.stage, fmt.number(classicSaved.game.score))}
          </Button>
          <Button variant="secondary" size="lg" icon="restart" block onClick={requestNewClassic}>
            {t.setup.newClassic}
          </Button>
        </>
      ) : (
        <Button variant="primary" size="lg" icon="play" block onClick={newClassicGame}>
          {t.setup.startClassic}
        </Button>
      )
    ) : challengeSaved ? (
      <Button variant="primary" size="lg" icon="play" block onClick={() => onStart('challenge', challengeSaved)}>
        {t.setup.continueLevel(challengeSaved.game.stage)}
      </Button>
    ) : (
      <Button variant="primary" size="lg" icon="play" block onClick={() => pickLevel(progress.current)}>
        {t.setup.playLevel(progress.current)}
      </Button>
    );

  return (
    <GameLayout gameId="number-match" onHelp={() => setHelp(true)}>
      <GameSetup gameId="number-match" description={tab === 'classic' ? t.modeInfo.classic : t.modeInfo.challenges} actions={actions}>
        <div className="nm-setup">
          <SegmentedControl
            className="nm-setup__mode"
            label={t.modeLabel}
            value={tab}
            onChange={onTab}
            options={[
              { value: 'classic', label: t.modes.classic },
              { value: 'challenge', label: t.modes.challenges },
            ]}
          />
          {tab === 'classic' ? (
            <>
              <p className="nm-setup__rules">{t.setup.classicRules(CLASSIC_START_DIGITS, CLASSIC_ADDS, CLASSIC_HINTS)}</p>
              {stats.bestScore !== null && stats.bestScore > 0 && (
                <p className="nm-setup__note">
                  <Crown size={16} /> {t.setup.bestScore(fmt.number(stats.bestScore))}
                </p>
              )}
            </>
          ) : (
            <>
              {done > 0 && (
                <p className="nm-setup__note">
                  <Icon name="star" size={16} filled /> {t.setup.levelsDone(done, totalStars(progress))}
                </p>
              )}
              <LevelSelect progress={progress} onSelect={pickLevel} />
            </>
          )}
        </div>
      </GameSetup>

      <HelpDialog open={help} onClose={() => setHelp(false)} intro={t.help.intro} sections={t.help.sections} />
      <ConfirmDialog
        open={confirm?.kind === 'abandon'}
        title={t.setup.abandonTitle}
        body={t.setup.abandonBody}
        confirmLabel={m.common.game.newGame}
        tone="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          newClassicGame();
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'level'}
        title={t.setup.switchLevelTitle}
        body={challengeSaved ? t.setup.switchLevelBody(challengeSaved.game.stage) : undefined}
        confirmLabel={t.setup.switchLevelConfirm}
        tone="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const level = confirm?.kind === 'level' ? confirm.level : 1;
          setConfirm(null);
          onStart('challenge', fresh('challenge', level));
        }}
      />
    </GameLayout>
  );
}
