---
title: Colours
summary: Twelve-step scales, the roles that pick one, and the surfaces no step can be.
order: 1
related: [Tones, Dark mode]
---

[//]: # 'written from colours.doc.yaml by pnpm docs:sync; edit that file, not this one'

# Colours

Every colour is a step on a twelve-step scale: the step says what it is for, the scale what it means.

A step does the same job on every scale, so a class names both:
`bg-indigo-3`, `border-indigo-7`, `text-indigo-11`. Nothing resolves a
colour in between, and there is no `bg-primary` or `text-muted`.

## Steps

Steps 1–2 are page backgrounds, 3–5 component fills, 6–8 borders, 9–10
solid fills and 11–12 text, on every scale:

**Steps**

| Step | Class           | For                  |
| ---- | --------------- | -------------------- |
| `1`  | bg-indigo-1     | app background       |
| `2`  | bg-indigo-2     | subtle background    |
| `3`  | bg-indigo-3     | component background |
| `4`  | bg-indigo-4     | component hover      |
| `5`  | bg-indigo-5     | component active     |
| `6`  | border-indigo-6 | subtle border        |
| `7`  | border-indigo-7 | border, focus ring   |
| `8`  | border-indigo-8 | border hover         |
| `9`  | bg-indigo-9     | solid fill           |
| `10` | bg-indigo-10    | solid fill hover     |
| `11` | text-indigo-11  | text, low contrast   |
| `12` | text-indigo-12  | text, high contrast  |

Each scale has a thirteenth colour, `contrast`: the text that sits on its
step 9, as `text-indigo-contrast` on `bg-indigo-9`.

## Scales

Eleven scales, each in both themes. Gray is most of a screen; the ten hues
carry meaning. Switch the theme to see the other half.

**Light**

| Scale    | 1       | 2       | 3       | 4       | 5       | 6       | 7       | 8       | 9       | 10      | 11      | 12      |
| -------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- |
| `gray`   | #f7f6f2 | #f2f1ec | #edece6 | #e9e7e1 | #e4e2db | #e0ddd5 | #c9c5ba | #ada89d | #777368 | #6a665b | #5d5a50 | #25231d |
| `red`    | #fff6f4 | #ffede9 | #ffe2db | #ffd6cd | #ffc9bf | #ffbbaf | #ffa99b | #ff9080 | #c0382e | #b22922 | #9e1a15 | #590e0a |
| `orange` | #fff8f3 | #fff0e7 | #ffe7d9 | #ffdcca | #ffd2ba | #fdc6a9 | #f9b794 | #f1a177 | #a44e14 | #974200 | #853500 | #4b1c00 |
| `yellow` | #fdfaf2 | #f9f4e7 | #f5ecd8 | #f1e4c8 | #ecdcb8 | #e5d2a7 | #ddc591 | #d1b473 | #8a6a10 | #7e5e00 | #6e5100 | #3d2c00 |
| `green`  | #f6fcf7 | #ecf8ee | #e1f2e4 | #d4edd9 | #c8e6ce | #b9dfc1 | #a8d5b1 | #8fc79c | #2e7042 | #216437 | #13562b | #0a3017 |
| `teal`   | #f5fcfa | #ebf7f4 | #def2ec | #d1ece4 | #c3e6dc | #b4ded2 | #a1d5c6 | #86c7b5 | #176d5c | #006151 | #005344 | #002e25 |
| `cyan`   | #f4fcfe | #ebf7fb | #def1f7 | #d0eaf4 | #c2e4ef | #b3dbe9 | #a0d1e2 | #84c2d7 | #14687e | #005c72 | #004e62 | #002c37 |
| `blue`   | #f5fbff | #ebf5ff | #deeeff | #d1e7ff | #c3dfff | #b5d5ff | #a2caff | #89b8ff | #2a5dae | #1e51a1 | #12438e | #092551 |
| `indigo` | #f7f9ff | #eff2ff | #e5eaff | #dbe1ff | #d0d7ff | #c4ccff | #b6beff | #a3aaff | #4e46c6 | #4439b8 | #392aa4 | #1f185e |
| `purple` | #fdf7ff | #faf0ff | #f6e5ff | #f1dbff | #ecd0ff | #e6c4ff | #deb4fd | #d29ef7 | #7b3fa0 | #6f3393 | #602681 | #361449 |
| `pink`   | #fff6fa | #ffedf5 | #ffe2ee | #ffd6e6 | #ffc9df | #ffbbd5 | #ffaaca | #fa91ba | #a63368 | #99255d | #86174f | #4c0d2b |

**Dark**

| Scale    | 1       | 2       | 3       | 4       | 5       | 6       | 7       | 8       | 9       | 10      | 11      | 12      |
| -------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- |
| `gray`   | #1b1a17 | #201e1a | #25231e | #2a2821 | #2f2c25 | #343128 | #4c483d | #625e53 | #79756a | #8f8b80 | #a6a296 | #edebe3 |
| `red`    | #200e0c | #2d1411 | #3c1815 | #4c1d19 | #5d221d | #732b25 | #8d352e | #b1483f | #e26a5f | #f2786c | #fe8f83 | #ffbbb2 |
| `orange` | #1c110a | #28180d | #351f0e | #432610 | #522e11 | #653916 | #7c471c | #9d5d2a | #efa36c | #feb17a | #ffc594 | #ffeacc |
| `yellow` | #181307 | #221b08 | #2d2406 | #382c04 | #453600 | #564300 | #695300 | #866b00 | #dfc060 | #eecf6f | #f8dc88 | #fff5c3 |
| `green`  | #0c170f | #112015 | #142a1b | #173522 | #1b4129 | #225133 | #2a633f | #3b7f53 | #7fcb97 | #8ddaa5 | #a5eaba | #d8ffe3 |
| `teal`   | #0a1714 | #0d201c | #0e2a24 | #0f352d | #0f4137 | #135145 | #176355 | #267f6e | #6cc9b4 | #7bd8c2 | #96e8d4 | #cefff2 |
| `cyan`   | #0b1619 | #0e1f24 | #10282f | #12333c | #143e49 | #1a4d5b | #1f5f70 | #2f798e | #74c4dc | #82d3eb | #9ce3fa | #d2fdff |
| `blue`   | #0e141c | #141c29 | #192536 | #1f2e45 | #253955 | #2e4668 | #3a5780 | #4d70a2 | #8bb4ef | #99c2fe | #aed4ff | #daf1ff |
| `indigo` | #121220 | #1a192e | #22203d | #2b284e | #343060 | #413c77 | #514a92 | #6961b7 | #918aec | #9e98fb | #b0abff | #cfceff |
| `purple` | #18101d | #221729 | #2c1d37 | #382445 | #452b55 | #553669 | #694381 | #8558a3 | #c591e8 | #d49ff7 | #e3b4ff | #f7daff |
| `pink`   | #1c0f15 | #28151e | #351b27 | #432131 | #52283c | #65324a | #7d3e5b | #9e5275 | #ee94bc | #fea2ca | #ffb7db | #ffe1f6 |

## Roles

A role is a scale picked for what it means. A component's `tone` takes a
role or a scale by name, so changing a role's scale changes every component
that uses the role.

**Roles**

| Role        | Scale  |
| ----------- | ------ |
| `primary`   | indigo |
| `secondary` | gray   |
| `success`   | green  |
| `warning`   | orange |
| `danger`    | red    |
| `neutral`   | gray   |

A role is only a name: there is no `bg-danger-9`. The component looks up its
scale and builds the class from that, as [Tones](tones.md) shows.

## Surfaces

A surface is a colour no step can be, because it is defined by what it sits
on. Each is stated once per theme.

| Class               | For                                                              |
| ------------------- | ---------------------------------------------------------------- |
| `bg-surface-raised` | what sits on the page: cards, menus, popovers, dialogs, toasts   |
| `bg-surface-inset`  | what is sunk into it: a tab list, a progress track, a code block |
| `bg-surface-field`  | a field's fill while it has focus                                |

`black` and `white` are the same in both themes, for what has to read as
black or white whatever the theme.

## Contrast

Each pairing is measured on every scale in both themes, and a test in
`@bh/ui` fails when a required one falls short of WCAG 2.2.

| Pairing                                                 | At least | Kind     |
| ------------------------------------------------------- | -------- | -------- |
| step 11 text on step 3 (subtle)                         | 4.5:1    | required |
| `contrast` text on step 9 (solid)                       | 4.5:1    | required |
| step 11 text on the page                                | 4.5:1    | required |
| gray step 7 border, on the page and on `surface-raised` | 3:1      | required |
| step 7 border on the page (outline)                     | 3:1      | advisory |

An outline's border is advisory because its label already says what it is;
a field's border can be all that shows a field is there.
