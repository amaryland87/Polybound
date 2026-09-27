import React from 'react';
import { PIECES_TEMPLATE } from '../constants';
import { FirstMove, Mode, Prefs, SavedGame, Stats } from '../utils/storage';
import { CODE_LENGTH, normalizeCode } from '../utils/online';
import { PieceGlyph } from './PieceTray';

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: 'PvP', label: 'Local 1v1', blurb: 'Pass and play' },
  { id: 'Easy', label: 'Easy', blurb: 'Casual, loose play' },
  { id: 'Medium', label: 'Medium', blurb: 'Greedy and central' },
  { id: 'Hard', label: 'Hard', blurb: 'Blocks and looks ahead' },
  { id: 'Online', label: 'Online', blurb: 'Play a friend with a room code' },
];

const TIME_OPTIONS = [
  { label: '3m', val: 180 },
  { label: '6m', val: 360 },
  { label: '10m', val: 600 },
  { label: 'Off', val: null },
];

const FIRST_LABELS: Record<'ai' | 'PvP' | 'Online', Record<FirstMove, string>> = {
  ai: { me: 'You', them: 'AI', alternate: 'Alternate' },
  PvP: { me: 'Crimson', them: 'Cobalt', alternate: 'Alternate' },
  Online: { me: 'You', them: 'Friend', alternate: 'Alternate' },
};

export const modeLabel = (mode: Mode) => (mode === 'PvP' ? 'Local 1v1' : mode === 'Online' ? 'Online' : `${mode} AI`);

export interface OnlineLobby {
  status: 'idle' | 'hosting' | 'joining' | 'playing' | 'closed';
  code?: string;
  error?: string;
  joinCode: string;
  setJoinCode: (code: string) => void;
  onHost: () => void;
  onJoin: () => void;
  onCancel: () => void;
}

interface LandingProps {
  prefs: Prefs;
  onPrefs: (patch: Partial<Prefs>) => void;
  stats: Stats;
  saved: SavedGame | null;
  online: OnlineLobby;
  onStart: () => void;
  onResume: () => void;
  onTutorial: () => void;
  onRules: () => void;
}

const sectionLabel = 'text-[10px] font-orbitron text-slate-500 uppercase tracking-widest';

// Decorative logo made of the game's own pieces
const LogoMark: React.FC = () => {
  const pieces = [PIECES_TEMPLATE[13], PIECES_TEMPLATE[16], PIECES_TEMPLATE[9]];
  return (
    <div className="flex items-end justify-center gap-3 mb-1 sm:mb-2 float-slow short:hidden [&_svg]:w-10 [&_svg]:h-10 sm:[&_svg]:w-[54px] sm:[&_svg]:h-[54px]" aria-hidden>
      <div className="rotate-[-12deg]"><PieceGlyph piece={pieces[0]} player={1} size={54} /></div>
      <div className="-translate-y-2"><PieceGlyph piece={pieces[1]} player={2} size={54} /></div>
      <div className="rotate-[10deg]"><PieceGlyph piece={pieces[2]} player={1} size={54} /></div>
    </div>
  );
};

export function recordText(mode: Mode, stats: Stats): string | null {
  const r = stats[mode];
  if (r.wins + r.losses + r.draws === 0) return null;
  if (mode === 'PvP') return `Crimson ${r.wins} · Cobalt ${r.losses} · Draws ${r.draws}`;
  return `Your record: ${r.wins}W · ${r.losses}L · ${r.draws}D`;
}

const OnlinePanel: React.FC<{ lobby: OnlineLobby }> = ({ lobby }) => {
  const inviteLink = lobby.code ? `${location.origin}${location.pathname}?join=${lobby.code}` : '';
  const copy = () => {
    const shareData = { title: 'Polybound', text: `Join my Polybound game: ${lobby.code}`, url: inviteLink };
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard?.writeText(inviteLink).catch(() => {});
    }
  };

  if (lobby.status === 'hosting') {
    return (
      <div className="text-center space-y-3" aria-live="polite">
        {lobby.code ? (
          <>
            <div className={sectionLabel}>Room code</div>
            <div className="font-orbitron text-4xl tracking-[0.3em] text-white select-all">{lobby.code}</div>
            <button onClick={copy} className="w-full py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 font-orbitron text-xs text-white">
              Share invite link
            </button>
            <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
              <span className="thinking-dot" /> Waiting for your friend to join…
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-400">Creating a room…</p>
        )}
        <button onClick={lobby.onCancel} className="text-xs font-orbitron text-slate-500 hover:text-white uppercase tracking-widest py-1">Cancel</button>
      </div>
    );
  }

  if (lobby.status === 'joining') {
    return (
      <div className="text-center space-y-3" aria-live="polite">
        <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
          <span className="thinking-dot" /> Connecting to {lobby.joinCode}…
        </p>
        <button onClick={lobby.onCancel} className="text-xs font-orbitron text-slate-500 hover:text-white uppercase tracking-widest py-1">Cancel</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button onClick={lobby.onHost} className="start-btn w-full py-3 sm:py-4 bg-white text-slate-950 font-orbitron font-bold text-lg rounded-2xl transition-all active:scale-95">
        CREATE GAME
      </button>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); lobby.onJoin(); }}>
        <label htmlFor="join-code" className="sr-only">Room code</label>
        <input id="join-code" value={lobby.joinCode} onChange={e => lobby.setJoinCode(normalizeCode(e.target.value))}
          placeholder="Room code" autoComplete="off" spellCheck={false} maxLength={CODE_LENGTH}
          className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-white/5 border border-white/15 font-orbitron tracking-[0.3em] uppercase text-white placeholder:tracking-normal placeholder:text-slate-500" />
        <button type="submit" disabled={lobby.joinCode.length !== CODE_LENGTH}
          className="px-5 rounded-xl border border-blue-400/60 bg-blue-500/20 text-blue-200 font-orbitron text-xs disabled:opacity-30">
          JOIN
        </button>
      </form>
      {lobby.error && <p role="alert" className="text-xs text-red-300">{lobby.error}</p>}
      <p className="text-[10px] text-slate-500">Moves go directly between your browsers. The time limit and first move above are set by whoever creates the game.</p>
    </div>
  );
};

const Landing: React.FC<LandingProps> = ({ prefs, onPrefs, stats, saved, online, onStart, onResume, onTutorial, onRules }) => {
  const lobbyBusy = prefs.mode === 'Online' && (online.status === 'hosting' || online.status === 'joining');
  const firstLabels = FIRST_LABELS[prefs.mode === 'PvP' || prefs.mode === 'Online' ? prefs.mode : 'ai'];
  const record = recordText(prefs.mode, stats);
  // One banner at a time keeps the menu on one screen: resuming wins over the tutorial nudge
  const nudgeTutorial = !prefs.tutorialDone && !saved;

  return (
    <div className="w-full max-w-xl text-center space-y-3 sm:space-y-8 short:space-y-3 shorter:space-y-2 rise-in">
      <div className="space-y-1 sm:space-y-3 short:space-y-1">
        <LogoMark />
        <h1 className="title-glow text-4xl sm:text-5xl md:text-7xl short:text-4xl font-orbitron font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-red-400 via-white to-blue-400 uppercase">
          POLYBOUND
        </h1>
        <p className="text-slate-400 uppercase tracking-[0.5em] text-xs shorter:hidden">Tactical Spatial Conquest</p>
      </div>

      {saved && (
        <button onClick={onResume}
          className="w-full glass-card rounded-2xl px-4 py-2.5 sm:px-5 sm:py-4 short:py-2.5 shorter:py-2 flex items-center justify-between text-left hover:bg-white/10 transition-all border !border-emerald-400/40">
          <span>
            <span className="block font-orbitron text-sm text-emerald-300">RESUME GAME</span>
            <span className="block text-[11px] text-slate-400 mt-0.5">
              {modeLabel(saved.mode)} · move {saved.state.placedHistory.length + 1} · {saved.state.scores[1]}–{saved.state.scores[2]}
            </span>
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-300" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M7.3 4.3a1 1 0 011.4 0l5 5a1 1 0 010 1.4l-5 5a1 1 0 01-1.4-1.4L11.6 10 7.3 5.7a1 1 0 010-1.4z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {nudgeTutorial && (
        <button onClick={onTutorial}
          className="w-full rounded-2xl px-4 py-2 sm:px-5 sm:py-3 text-left border border-amber-400/40 bg-amber-500/10 hover:bg-amber-500/20 transition-all">
          <span className="block font-orbitron text-xs text-amber-300">NEW HERE?</span>
          <span className="block text-[11px] text-slate-300 mt-0.5">Learn the rules in five quick practice puzzles.</span>
        </button>
      )}

      <div className="glass-card p-4 sm:p-6 md:p-8 short:p-4 rounded-3xl sm:rounded-[2rem] space-y-3 sm:space-y-6 short:space-y-3 text-left">
        <fieldset className="space-y-2 sm:space-y-3 short:space-y-2" disabled={lobbyBusy}>
          <legend className={sectionLabel}>Opponent</legend>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {MODES.map(m => (
              <button
                key={m.id}
                aria-pressed={prefs.mode === m.id}
                onClick={() => onPrefs({ mode: m.id })}
                className={`py-2 px-3 sm:py-3 sm:px-4 short:py-2 shorter:py-1.5 rounded-2xl border transition-all text-left ${m.id === 'Online' ? 'col-span-2' : ''} ${
                  prefs.mode === m.id
                    ? 'bg-white/10 border-white/40 text-white shadow-[0_0_24px_rgba(255,255,255,0.12)]'
                    : 'bg-white/[0.03] border-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <div className="font-orbitron text-xs">{m.label}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 short:hidden">{m.blurb}</div>
              </button>
            ))}
          </div>
          {record && <p className="text-[11px] text-slate-400 font-mono">{record}</p>}
        </fieldset>

        <fieldset className="space-y-2 sm:space-y-3 short:space-y-2" disabled={lobbyBusy}>
          <legend className={sectionLabel}>First move</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['me', 'them', 'alternate'] as FirstMove[]).map(f => (
              <button key={f} aria-pressed={prefs.firstMove === f} onClick={() => onPrefs({ firstMove: f })}
                className={`py-2 sm:py-3 short:py-2 rounded-xl font-orbitron text-xs border transition-all ${
                  prefs.firstMove === f ? 'bg-blue-500/20 border-blue-400 text-blue-300' : 'bg-white/[0.03] border-white/5 text-slate-500 hover:bg-white/10'
                }`}>
                {firstLabels[f]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2 sm:space-y-3 short:space-y-2" disabled={lobbyBusy}>
          <legend className={sectionLabel}>Time Limit (Per Player)</legend>
          <div className="grid grid-cols-4 gap-2">
            {TIME_OPTIONS.map(t => (
              <button
                key={t.label}
                aria-pressed={prefs.timeLimit === t.val}
                onClick={() => onPrefs({ timeLimit: t.val })}
                className={`py-2 sm:py-3 short:py-2 rounded-xl font-orbitron text-xs border transition-all ${
                  prefs.timeLimit === t.val ? 'bg-blue-500/20 border-blue-400 text-blue-300' : 'bg-white/[0.03] border-white/5 text-slate-500 hover:bg-white/10'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1 sm:gap-3 sm:pt-2 short:gap-1 short:pt-0">
          {prefs.mode === 'Online'
            ? <OnlinePanel lobby={online} />
            : <button onClick={onStart} className="start-btn w-full py-3 sm:py-4 short:py-3 shorter:py-2.5 bg-white text-slate-950 font-orbitron font-bold text-lg rounded-2xl transition-all active:scale-95">START GAME</button>}
          <div className="flex justify-center gap-6">
            <button onClick={onRules} className="text-xs font-orbitron text-slate-400 hover:text-white uppercase tracking-widest py-2">How to Play</button>
            {!nudgeTutorial && (
              <button onClick={onTutorial} className="text-xs font-orbitron text-slate-400 hover:text-white uppercase tracking-widest py-2">Tutorial</button>
            )}
          </div>
        </div>
      </div>
      <p className="hidden sm:block short:hidden text-slate-600 text-[10px] uppercase tracking-widest">14×14 Grid • 18 Pieces • 2 Bridges • 1 Neutral Zone</p>
    </div>
  );
};

export default Landing;
