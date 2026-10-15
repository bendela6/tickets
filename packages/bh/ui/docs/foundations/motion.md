---
title: Motion
summary: Three durations by the kind of change, two easings, three animations,
  and what stops for reduced motion.
order: 7
related: [Elevation]
---

[//]: # 'written from motion.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Motion

A duration says what kind of change it is: feedback, a transition or an arrival.

**Durations**

| Token          | Value | For                       |
| -------------- | ----- | ------------------------- |
| `duration-120` | 120ms | hover, press — feedback   |
| `duration-200` | 200ms | open, close — transitions |
| `duration-320` | 320ms | enter, layout — arrivals  |

**Easings**

| Token         | Value                        | For                                 |
| ------------- | ---------------------------- | ----------------------------------- |
| `ease-out`    | cubic-bezier(0.2, 0, 0, 1)   | things arriving — fast, then settle |
| `ease-in-out` | cubic-bezier(0.4, 0, 0.2, 1) | things moving between two places    |

**Animations**

| Token           | Value                                       | For                                            |
| --------------- | ------------------------------------------- | ---------------------------------------------- |
| `animate-spin`  | ai-spin 1.4s linear infinite                | a spinner, an icon at work                     |
| `animate-pulse` | ai-pulse 1.8s ease-out infinite             | a live status dot, a row still loading         |
| `animate-nudge` | ai-nudge 320ms cubic-bezier(0.2, 0, 0, 1) 1 | once, at what was refused: a tag already there |

## Durations

The class is the milliseconds: `duration-200` is 200ms. It is Tailwind's
own utility with no token behind it, so any number compiles, and the three
in the table are an agreement: 120 answers a hover or a press, 200 opens or
closes something, as a drawer slides in, and 320 brings something in.

A transition that names no duration takes Tailwind's default, 150ms, as
most of the library's colour changes do.

## Easings

`ease-out`, fast then settling, is for things arriving; `ease-in-out` for
things moving between two places. They are tokens under Tailwind's own
names, `--ease-out` and `--ease-in-out`.

## Animations

`animate-spin` and `animate-pulse` loop; `animate-nudge` plays once, a
small scale to point at what was refused, such as a tag already in the
list.

## Reduced motion

When the reader asks for less motion, a drawer appears without sliding,
and the table's refresh bar and the status dot's pulse stop. A spinner
keeps turning, but for the one in
[ScreenState](../../src/library/feedback/components/screen-state/screen-state.md)'s loading state, which
fades in place instead: a fade moves nothing, and still says the screen
is working.

In the app's own code, write `motion-safe:` on motion that only decorates,
so it plays only for readers who haven't asked for less:
`motion-safe:animate-pulse`.
