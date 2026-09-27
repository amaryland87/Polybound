import React, { useEffect, useRef } from 'react';

const RulesModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus the dialog while it's open, close on Escape, then hand focus back
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md fade-in" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="rules-title"
        className="w-full max-w-lg glass-card p-6 rounded-3xl border border-white/15 max-h-[90vh] overflow-y-auto pop-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 id="rules-title" className="text-2xl font-orbitron font-bold text-white">HOW TO PLAY</h2>
          <button ref={closeRef} onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close rules">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <section>
            <h3 className="rule-h">Starting</h3>
            <p>Your first piece must touch your home row: <span className="text-red-400">Crimson</span> starts on the bottom row, <span className="text-blue-400">Cobalt</span> on the top row.</p>
          </section>
          <section>
            <h3 className="rule-h">Placement</h3>
            <p>Every new piece must touch one of your own pieces <b>corner to corner</b>. Your pieces may never share an edge with each other. Diamond markers show where you can connect.</p>
          </section>
          <section className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl">
            <h3 className="rule-h text-amber-300">Neutral zone (centre 4×4)</h3>
            <p>Inside the glowing zone your own pieces <b>may</b> share edges, so you can pack it tightly. Each square you hold there is worth +1.</p>
          </section>
          <section className="p-3 bg-violet-500/10 border border-violet-500/25 rounded-xl">
            <h3 className="rule-h text-violet-300">Bridge pieces</h3>
            <p>Two pieces have dashed <b>bridge</b> squares. A bridge square can hop over an opponent's square to reach the other side of their wall. It doesn't capture the square; the enemy keeps it.</p>
          </section>
          <section>
            <h3 className="rule-h">Turns & ending</h3>
            <p>If you have no legal move your turn is skipped and your opponent keeps playing. The game ends when neither player can move, when someone resigns, or when a clock runs out.</p>
          </section>
          <section>
            <h3 className="rule-h">Scoring</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>−1</b> for each square left in your hand.</li>
              <li><b>+1</b> for each of your squares in the neutral zone.</li>
              <li><b>+2</b> for each opponent piece that ends up enclosed, with every edge touching a square or the board edge. Careful: if one of <i>your</i> pieces gets boxed in, even by your own move, your opponent scores it.</li>
              <li><b>+3</b> bonus for placing all of your pieces.</li>
            </ul>
          </section>
          <section className="text-xs text-slate-400">
            <h3 className="rule-h">Controls</h3>
            <p className="mb-1">Drag a piece onto the board, or pick it and tap a square. Drag it to adjust, tap it to rotate, then press <b>Confirm</b> to lock it in.</p>
            <p className="mb-1"><kbd>R</kbd>, right-click or tap: rotate · <kbd>F</kbd>: flip · arrows: move · <kbd>Enter</kbd>: confirm · <kbd>Esc</kbd>: cancel · <kbd>U</kbd>: undo · <kbd>H</kbd>: toggle hints</p>
            <p>Keyboard only: <kbd>Tab</kbd> to a piece in your tray and press <kbd>Space</kbd>, then use the arrow keys and <kbd>Enter</kbd>. Crimson squares carry a dot and Cobalt squares a ring.</p>
          </section>
        </div>
        <button onClick={onClose} className="w-full mt-8 py-3 bg-white text-slate-950 hover:bg-blue-50 font-orbitron font-bold rounded-xl transition-all">GOT IT</button>
      </div>
    </div>
  );
};

export default RulesModal;
