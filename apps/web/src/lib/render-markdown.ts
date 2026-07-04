function escapeHtml(source: string): string {
  return source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(source: string): string {
  return source
    .replace(/`([^`]+)`/g, (_match: string, code: string) => '<code>' + code + '</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

export function renderMarkdown(text: string): string {
  const lines = escapeHtml(text).split(/\r?\n/);
  const output: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let table: 'started' | null = null;
  let fence = false;
  const closeList = () => {
    if (list) {
      output.push('</' + list + '>');
      list = null;
    }
  };
  const closeTable = () => {
    if (table) {
      output.push('</tbody></table></div>');
      table = null;
    }
  };
  for (const raw of lines) {
    if (raw.startsWith('```')) {
      closeList();
      closeTable();
      output.push(fence ? '</code></pre>' : '<pre><code>');
      fence = !fence;
      continue;
    }
    if (fence) {
      output.push(raw);
      continue;
    }
    const line = raw.trimEnd();
    if (/^\|.*\|$/.test(line)) {
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim());
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
        continue;
      }
      if (!table) {
        table = 'started';
        output.push(
          '<div class="tbl-scroll"><table><thead><tr>' +
            cells.map((cell) => '<th>' + inline(cell) + '</th>').join('') +
            '</tr></thead><tbody>',
        );
      } else {
        output.push(
          '<tr>' + cells.map((cell) => '<td>' + inline(cell) + '</td>').join('') + '</tr>',
        );
      }
      continue;
    }
    closeTable();
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = (heading[1] ?? '#').length;
      output.push('<h' + level + '>' + inline(heading[2] ?? '') + '</h' + level + '>');
      continue;
    }
    const unordered = line.match(/^[-*]\s+(.*)$/);
    if (unordered) {
      if (list !== 'ul') {
        closeList();
        output.push('<ul>');
        list = 'ul';
      }
      output.push('<li>' + inline(unordered[1] ?? '') + '</li>');
      continue;
    }
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (ordered) {
      if (list !== 'ol') {
        closeList();
        output.push('<ol>');
        list = 'ol';
      }
      output.push('<li>' + inline(ordered[1] ?? '') + '</li>');
      continue;
    }
    closeList();
    if (line.length > 0) {
      output.push('<p>' + inline(line) + '</p>');
    }
  }
  closeList();
  closeTable();
  if (fence) {
    output.push('</code></pre>');
  }
  return output.join('\n');
}
