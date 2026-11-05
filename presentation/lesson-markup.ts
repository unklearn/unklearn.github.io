import type { TeachingStep } from './teaching.ts';
export type Excerpts = Record<string, { code: string; file: string; line: number }>;

export const escape = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const inline = (s: string) => escape(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
function markdown(text: string, excerpts: Excerpts) {
  return text.trim().split(/\n\s*\n/).map(block => {
    const ref = block.trim().match(/^\{\{source:([\w-]+)\}\}$/);
    if (ref) {
      const source = excerpts[ref[1]]; if (!source) throw new Error(`Missing source ${ref[1]}`);
      const code = source.code.split('\n').map(line => `<span class="code-line ${line.includes('// +') ? 'addition' : ''}">${escape(line.replace(/ \/\/ \+ .*/, ''))}</span>`).join('');
      return `<figure class="source"><pre><code>${code}</code></pre><figcaption>${escape(source.file)}:${source.line}</figcaption></figure>`;
    }
    if (block.startsWith('> ')) return `<blockquote>${inline(block.slice(2))}</blockquote>`;
    return `<p>${inline(block.replace(/\n/g, ' '))}</p>`;
  }).join('');
}

// One source for the visible slides and the complete static HTML read by crawlers.
export function renderSlides(steps: readonly TeachingStep[], excerpts: Excerpts, articleId = 'lesson') {
  return steps.map((step, index) => {
    const content = markdown(step.markdown, excerpts);
    let boundary = content.indexOf('</p>') + 4;
    if (content.slice(boundary).startsWith('<figure')) boundary = content.indexOf('</figure>', boundary) + 9;
    const heading = index === 0 ? 'h1' : 'h2';
    const titleId = escape(`${articleId}-${step.id}`);
    return `<section class="teaching-step${index === 0 ? ' selected' : ''}" data-step="${index}" aria-labelledby="${titleId}"><span class="step-kicker">Step ${index+1}</span><${heading} id="${titleId}">${escape(step.title)}</${heading}><div class="lesson-copy">${content.slice(0,boundary)}</div><div class="interaction lesson-copy"><p class="stage-instruction">${escape(step.stages[0].instruction)}</p><div class="actions"></div></div><div class="lesson-copy lesson-detail">${content.slice(boundary)}</div>${step.narration ? `<details class="narration"><summary>Lesson narration / transcript</summary>${step.narration.audio ? `<audio controls preload="none" src="${escape(step.narration.audio)}"></audio>` : ''}<p>${escape(step.narration.transcript)}</p></details>` : ''}</section>`;
  }).join('');
}
