# Polybound

A tactical two-player polyomino game on a 14×14 grid. Play against a local friend or an AI (Easy, Medium, Hard).

## Run locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev` (http://localhost:3000)

## Rules in brief

- Your first piece must touch your home row (Crimson: bottom, Cobalt: top).
- Each new piece must touch your own pieces corner to corner, never edge to edge. The exception is the central 4×4 **neutral zone**, where your own pieces may share edges.
- **Bridge pieces** have dashed squares that can hop over opponent squares without capturing them.
- A player with no legal move is skipped. The game ends when neither player can move, when someone resigns, or when a clock runs out.
- Scoring: −1 per unplaced square, +1 per square in the neutral zone, +2 per opponent piece you enclose, and +3 for placing every piece.

## Controls

Click or tap a piece, then click or drag on the board to place it.
`R` or right-click rotates, `F` flips, `Esc` deselects, `U` undoes, and `H` toggles the move-hint diamonds.
