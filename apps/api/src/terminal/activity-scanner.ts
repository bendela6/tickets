export interface ActivityEvent {
  busy: boolean;
  command?: string;
  exitCode?: number;
}

// Full OSC 133 marker: ESC ] 133 ; <A-D> [ ; <params> ] (ESC\ | BEL).
const OSC133 = /\x1b\]133;([A-D])(?:;([^\x1b\x07]*))?(?:\x1b\\|\x07)/g;

// A partial OSC 133 marker: ESC, optionally growing toward ESC]133;<A-D>[;params…]
// but with NO terminator (ESC\ or BEL) yet. The param body is [^\x1b\x07]* so a
// long command is held back until its terminator arrives.
const PARTIAL_133 = /^\x1b(?:\](?:1(?:3(?:3(?:;(?:[A-D](?:;[^\x1b\x07]*)?)?)?)?)?)?)?$/;

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
        event ??= { busy: false };
        if (kind === 'C') {
          event.busy = true;
          event.command = param || undefined;
        } else if (kind === 'D') {
          event.busy = false;
          event.command = undefined;
          if (param) event.exitCode = Number(param);
        } else {
          // kind === 'A'
          event.busy = false;
          event.command = undefined;
        }
      }
      let rest = buf.slice(last);
      // Hold back a trailing partial "ESC]133…" so a split marker isn't emitted:
      // find the last ESC in the remainder and check whether the tail starting
      // there is an incomplete marker prefix (no terminator yet). No length cap
      // on a legitimate prefix (long commands are valid), but a large safety
      // valve bounds memory on malformed/never-terminated streams.
      const esc = rest.lastIndexOf('\x1b');
      if (esc !== -1 && PARTIAL_133.test(rest.slice(esc)) && rest.length - esc <= 8192) {
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
