const DELETE_RE = /(delete|remove|rm\b|trash|destroy)/;
const TRADE_RE = /(trade|swap|transfer|pay|payment|wire|purchase|buy|sell|money|funds?)/;
const SEND_RE = /(send|email|reply|message|notify|dm|mail|compose)/;
const PUBLISH_RE = /(publish|post|push|(^|[_-])pr($|[_-])|pull[_-]?request|deploy|release)/;
const EXPORT_RE = /(export|download|upload|share)/;
const WRITE_RE = /(write|edit|patch|draft|create|move|rename|chmod|save|update)/;
const EXEC_RE = /(bash|shell|exec|run|command|terminal|spawn|process)/;
const NETWORK_RE = /(curl|http|fetch|web|network|request|api|gh\b|git|download|upload|browse)/;
// Only genuine read verbs keep the muted "reads" label + always-allow. Anything
// the classifier cannot place falls through to a neutral "review parameters"
// warning rather than being whitewashed as a safe read.
const READ_RE =
  /(read|get|list|show|view|inspect|search|find|lookup|fetch|preview|open|describe|status|summar)/;

/* Heuristic risk classification. Tool name is the primary signal for high-risk
   write/exec categories. SEND/PUBLISH are checked before WRITE so that a tool
   whose name carries both a send verb and a generic create/save verb is labeled
   by its riskier egress meaning. Description/parameters are only used as
   fallback for exec/network hints, preventing safe read tools whose description
   mentions "edit" from turning into a red write badge. */
export function classifyRisk(toolName, description, parameters) {
  const name = String(toolName || '').toLowerCase();
  const context = [description, parameters].filter(Boolean).join(' ').toLowerCase();

  if (DELETE_RE.test(name)) return risk('danger', 'tool.riskDelete');
  if (TRADE_RE.test(name)) return risk('danger', 'tool.riskTrade');
  if (SEND_RE.test(name)) return risk('danger', 'tool.riskSend');
  if (PUBLISH_RE.test(name)) return risk('danger', 'tool.riskPublish');
  if (EXPORT_RE.test(name)) return risk('danger', 'tool.riskExport');
  if (WRITE_RE.test(name)) return risk('danger', 'tool.riskWrite');
  if (EXEC_RE.test(name)) return risk('warning', 'tool.riskExec');
  if (NETWORK_RE.test(name)) return risk('info', 'tool.riskNetwork');

  if (EXEC_RE.test(context)) return risk('warning', 'tool.riskExec');
  if (NETWORK_RE.test(context)) return risk('info', 'tool.riskNetwork');

  // A recognizable read verb is safe to label muted "reads" and offer always-allow.
  if (READ_RE.test(name)) return { tone: 'muted', key: 'tool.riskRead', allowAlways: true };

  // Unknown tool name: do not whitewash as a read. Flag it for manual review and
  // never offer "always allow" for an action we cannot classify.
  return { tone: 'warning', key: 'tool.riskUnknown', allowAlways: false };
}

function risk(tone, key) {
  return { tone, key, allowAlways: false };
}
