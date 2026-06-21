export const WORKBENCH_RESPONSIVE_STYLE = `@media (max-width: 1120px) {
  .wb13-shell { grid-template-columns: 54px minmax(0, 1fr); grid-template-areas: "nav top" "nav main"; }
  .wb13-dock-toggle { display: inline-grid; }
  .wb13-dock {
    position: fixed;
    top: 0;
    left: 54px;
    bottom: 0;
    z-index: 52;
    width: 252px;
    transform: translateX(calc(-100% - 60px));
    transition: transform 0.18s;
  }
  .wb13-dock.is-open { transform: translateX(0); }
  .wb13-dock-close { display: grid; }
}
@media (min-width: 1121px) {
  .wb13-dock-scrim { display: none; }
}
@media (max-width: 820px) {
  .wb13-page { padding: 0 18px 60px; }
  .wb13-scene-summary { grid-template-columns: 1fr; }
  .wb13-scene-summary .wb13-button { width: 100%; }
  .wb13-scene-grid { grid-template-columns: 1fr; }
  .wb13-scene-row { grid-template-columns: auto minmax(0, 1fr); }
  .wb13-scene-state { grid-column: 2; width: fit-content; }
  .wb13-doc { grid-template-columns: 1fr; }
  .wb13-files { grid-template-columns: 1fr; }
  .wb13-files-list { border-right: 0; border-bottom: 1px solid var(--wb-line); }
  .wb13-doc-nav { display: none; }
  .wb13-head .meta { margin-left: 0; }
  .wb13-tabs { flex-wrap: nowrap; overflow-x: auto; }
  .wb13-tab { flex: none; white-space: nowrap; }
  .wb13-button.is-sm { min-height: 44px; }
  .wb13-appbar { margin-left: -18px; margin-right: -18px; padding-left: 18px; padding-right: 18px; }
  .wb13-pk-head h1 { font-size: 21px; }
}
@media (max-width: 560px) {
  .wb13-greet { font-size: 22px; }
  .wb13-wbar { flex-wrap: wrap; }
  .wb13-mode-btn {
    order: 2;
    flex: 1 0 calc(100% - 52px);
    max-width: none;
    justify-content: flex-start;
  }
  .wb13-send { order: 5; width: 100%; justify-content: center; margin-left: 0; margin-top: 8px; }
  .wb13-well textarea { min-height: 320px; padding-bottom: 178px; }
  .wb13-card { flex-wrap: wrap; }
  .wb13-card-actions { align-self: flex-start; }
  .wb13-decision-row { grid-template-columns: 1fr; }
  .wb13-decision-row .dv { text-align: left; }
  .wb13-email-head { grid-template-columns: 1fr; }
  .wb13-pk-head h1 { font-size: 19px; }
}
`;
