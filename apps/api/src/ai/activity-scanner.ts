export interface ActivityEvent {
  busy: boolean;
  command?: string;
  exitCode?: number;
}

// Full OSC 133 marker: ESC ] 133 ; <A-D> [ ; <params> ] (ESC\ | BEL).
const OSC133 = /\x1b\]133;([A-D])(?:;([^\x1b\x07]*))?(?:\x1b\\|\x07)/g;

export function createActivityScanner(): {
  push(chunk: string): { clean: string; event?: ActivityEvent };
} {
  let pending = '';
  return {
    push(chunk) {
      const buf = pending + chunk;
      let clean = '';
      let last = 0;
      let event: ActivityEvent | undefined;
      OSC133.lastIndex = 0;
      for (let m = OSC133.exec(buf); m; m = OSC133.exec(buf)) {
        clean += buf.slice(last, m.index);
        last = OSC133.lastIndex;
        const kind = m[1]!;
        const param = m[2];
        if (kind === 'C') event = { busy: true, ...(param ? { command: param } : {}) };
        else event = { busy: false, ...(kind === 'D' && param ? { exitCode: Number(param) } : {}) };
      }
      let rest = buf.slice(last);
      // Hold back a trailing partial "ESC]133…" so a split marker isn't emitted:
      // find the last ESC in the remainder and check whether the tail starting
      // there is a strict prefix of a well-formed marker (and reasonably short).
      const esc = rest.lastIndexOf('\x1b');
      if (esc !== -1 && rest.length - esc < 64 && /^\x1b(\](1(3(3(;[A-D]?[^\x1b\x07]*)?)?)?)?)?$/.test(rest.slice(esc))) {
        pending = rest.slice(esc);
        rest = rest.slice(0, esc);
      } else {
        pending = '';
      }
      clean += rest;
      return event ? { clean, event } : { clean };
    },
  };
}
