import { Marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

const marked = new Marked();
marked.setOptions({
  renderer: new (TerminalRenderer as any)({ reflowText: false }),
});

export function renderMarkdown(s: string): string {
  try {
    return String(marked.parse(s, { async: false }));
  } catch {
    return s;
  }
}
