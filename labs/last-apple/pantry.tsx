import type { InventoryState, Stock } from './experiment.ts';

function Apple({ x, y }: { x: number; y: number }) {
  return (
    <g transform={'translate(' + x + ' ' + y + ')'}>
      <path
        d="M0 2C-14-7-22 8-16 21c4 9 11 11 16 7 6 4 13 2 17-7C23 8 14-7 0 2Z"
        fill="#ad543e"
      />
      <path
        d="M0 1c1-6 4-10 8-11"
        fill="none"
        stroke="#675440"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M3-4c2-7 10-8 15-5-4 5-8 7-15 5Z" fill="#6a886b" />
      <path
        d="M-11 6c-3 2-4 6-3 8"
        fill="none"
        stroke="#df9169"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

function Carrot({ x, y }: { x: number; y: number }) {
  return (
    <g transform={'translate(' + x + ' ' + y + ') rotate(23)'}>
      <path
        d="M0 2-5-10m5 12 4-14M0 2l10-8"
        stroke="#6e8765"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M-8 3c4-6 14-6 17 0 2 5-3 23-9 27-5-5-11-22-8-27Z"
        fill="#c97b44"
      />
      <path d="m-6 9 5 1m0 7 5 1" stroke="#9e5a36" strokeWidth="1.5" />
    </g>
  );
}

function PantryIllustration({ state }: { state: InventoryState }) {
  return (
    <svg
      className="pantry-art"
      viewBox="0 0 480 244"
      aria-hidden="true"
      focusable="false"
    >
      <path fill="#e4e9dc" d="M0 0h480v244H0z" />
      <path fill="#d4dacc" d="M0 183h480v61H0z" />
      <path
        d="M0 183h480M0 213h480m-437 31 35-61m59 61 22-61m59 61 4-61m72 61-11-61m85 61-29-61m109 61-49-61"
        fill="none"
        stroke="#b9c5b6"
      />
      <path fill="#b9c5b6" d="m51 194 255 2 57 21-267 6Z" />
      <path fill="#ccbc9f" d="M74 39 102 27h214v169l-28 13H74z" />
      <path fill="#e5d7ba" d="M74 39h214v170H74z" />
      <path d="M103 184V92a77 67 0 0 1 154 0v92Z" fill="#476962" />
      <path d="M120 184V95a60 53 0 0 1 120 0v89Z" fill="#37544e" />
      <path
        d="M74 123h28m157 0h29M74 155h28m157 0h29M74 185h214m-192-61v30m170 1v29"
        stroke="#ccbc9f"
        fill="none"
      />
      <path fill="#849c8a" d="m58 33 39-17h227l-35 18Z" />
      <path fill="#668677" d="M58 33h231v12H58zm231 1 35-18v12l-35 17Z" />
      <path fill="#bf9970" d="m96 113 14-7h155l-13 7zm0 60 14-7h155l-13 7Z" />
      <path fill="#a17e5c" d="M96 113h156v8H96zm0 60h156v8H96z" />
      {Array.from({ length: state.pantry.apple }, (_, i) => (
        <Apple key={i} x={133 + i * 47} y={81} />
      ))}
      {Array.from({ length: state.pantry.carrot }, (_, i) => (
        <Carrot key={i} x={151 + i * 57} y={135} />
      ))}
      <ellipse cx="376" cy="211" rx="40" ry="10" fill="#b9c5b6" />
      <path d="M361 177h13v29h-15zm18 0h13l3 29h-15z" fill="#415b53" />
      <path d="m355 145 17-13 19 5 12 45-51 2Z" fill="#78998a" />
      <path d="m363 151 25 32" stroke="#c29067" strokeWidth="6" />
      <rect x="384" y="171" width="23" height="20" rx="4" fill="#ab6c4e" />
      <path d="M386 176h19" stroke="#d7a17b" strokeWidth="2" />
      <circle cx="371" cy="128" r="20" fill="#dfb98e" />
      <path d="M350 125c-3-28 43-30 43-2l-16-7-6 7Z" fill="#eee2c6" />
      <path
        d="m348 126 47-4"
        stroke="#ae8060"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="367" cy="130" r="1.6" fill="#3d4d43" />
      <path
        d="m354 150-14 13"
        stroke="#dfb98e"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {state.scout.apple > 0 && (
        <g transform="translate(333 147) scale(.56)">
          <Apple x={0} y={0} />
        </g>
      )}
      {state.scout.carrot > 0 && (
        <g transform="translate(333 147) scale(.64)">
          <Carrot x={0} y={0} />
        </g>
      )}
    </svg>
  );
}

function stockText(stock: Stock) {
  return (
    stock.apple +
    ' apple' +
    (stock.apple === 1 ? '' : 's') +
    ' · ' +
    stock.carrot +
    ' carrot' +
    (stock.carrot === 1 ? '' : 's')
  );
}

export function Pantry({
  state,
  notice,
}: {
  state: InventoryState;
  notice: string;
}) {
  return (
    <div className="pantry-panel">
      <PantryIllustration state={state} />
      <dl className="pantry-inventory">
        <div>
          <dt>Pantry</dt>
          <dd>{stockText(state.pantry)}</dd>
        </div>
        <div>
          <dt>Scout</dt>
          <dd>
            {state.scout.apple + state.scout.carrot
              ? stockText(state.scout)
              : 'Empty hands'}
          </dd>
        </div>
        {state.basket && (
          <div>
            <dt>Basket</dt>
            <dd>{stockText(state.basket)}</dd>
          </div>
        )}
      </dl>
      <div className="lab-notice">
        <p className="lab-label">Noticeboard</p>
        <blockquote>{notice}</blockquote>
      </div>
    </div>
  );
}
