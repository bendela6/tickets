// GENERATED from tokens/colors.tokens.json — do not edit.
// The tone vocabulary and the resolved ramp values.
//
// A tone is a NAME for a ramp. Roles come first so `primary` reads before
// `red`, then the hues. TONE_RAMP is named for what it RETURNS — a ramp
// name, which goes straight into `bg-${…}-9`, never a tone name.
export const TONE_NAMES = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral', 'red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'gray'] as const;

export type Tone = (typeof TONE_NAMES)[number];

export const ROLE_TONES = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;

export type RoleTone = (typeof ROLE_TONES)[number];

export const HUE_TONES = ['red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'gray'] as const;

export type HueTone = (typeof HUE_TONES)[number];

export const TONE_RAMP: Record<Tone, HueTone> = {
  "primary": "indigo",
  "secondary": "gray",
  "success": "green",
  "warning": "orange",
  "danger": "red",
  "neutral": "gray",
  "red": "red",
  "orange": "orange",
  "yellow": "yellow",
  "green": "green",
  "teal": "teal",
  "cyan": "cyan",
  "blue": "blue",
  "indigo": "indigo",
  "purple": "purple",
  "pink": "pink",
  "gray": "gray"
};

export interface Themed { light: string; dark: string }

export const RAMPS: Record<string, Record<string, Themed>> = {
  "red": {
    "1": {
      "light": "#fff6f4",
      "dark": "#200e0c"
    },
    "2": {
      "light": "#ffede9",
      "dark": "#2d1411"
    },
    "3": {
      "light": "#ffe2db",
      "dark": "#3c1815"
    },
    "4": {
      "light": "#ffd6cd",
      "dark": "#4c1d19"
    },
    "5": {
      "light": "#ffc9bf",
      "dark": "#5d221d"
    },
    "6": {
      "light": "#ffbbaf",
      "dark": "#732b25"
    },
    "7": {
      "light": "#ffa99b",
      "dark": "#8d352e"
    },
    "8": {
      "light": "#ff9080",
      "dark": "#b1483f"
    },
    "9": {
      "light": "#c0382e",
      "dark": "#e26a5f"
    },
    "10": {
      "light": "#b22922",
      "dark": "#f2786c"
    },
    "11": {
      "light": "#9e1a15",
      "dark": "#fe8f83"
    },
    "12": {
      "light": "#590e0a",
      "dark": "#ffbbb2"
    },
    "contrast": {
      "light": "#ffffff",
      "dark": "#2b0f0b"
    }
  },
  "orange": {
    "1": {
      "light": "#fff8f3",
      "dark": "#1c110a"
    },
    "2": {
      "light": "#fff0e7",
      "dark": "#28180d"
    },
    "3": {
      "light": "#ffe7d9",
      "dark": "#351f0e"
    },
    "4": {
      "light": "#ffdcca",
      "dark": "#432610"
    },
    "5": {
      "light": "#ffd2ba",
      "dark": "#522e11"
    },
    "6": {
      "light": "#fdc6a9",
      "dark": "#653916"
    },
    "7": {
      "light": "#f9b794",
      "dark": "#7c471c"
    },
    "8": {
      "light": "#f1a177",
      "dark": "#9d5d2a"
    },
    "9": {
      "light": "#a44e14",
      "dark": "#efa36c"
    },
    "10": {
      "light": "#974200",
      "dark": "#feb17a"
    },
    "11": {
      "light": "#853500",
      "dark": "#ffc594"
    },
    "12": {
      "light": "#4b1c00",
      "dark": "#ffeacc"
    },
    "contrast": {
      "light": "#ffffff",
      "dark": "#371b06"
    }
  },
  "yellow": {
    "1": {
      "light": "#fdfaf2",
      "dark": "#181307"
    },
    "2": {
      "light": "#f9f4e7",
      "dark": "#221b08"
    },
    "3": {
      "light": "#f5ecd8",
      "dark": "#2d2406"
    },
    "4": {
      "light": "#f1e4c8",
      "dark": "#382c04"
    },
    "5": {
      "light": "#ecdcb8",
      "dark": "#453600"
    },
    "6": {
      "light": "#e5d2a7",
      "dark": "#564300"
    },
    "7": {
      "light": "#ddc591",
      "dark": "#695300"
    },
    "8": {
      "light": "#d1b473",
      "dark": "#866b00"
    },
    "9": {
      "light": "#8a6a10",
      "dark": "#dfc060"
    },
    "10": {
      "light": "#7e5e00",
      "dark": "#eecf6f"
    },
    "11": {
      "light": "#6e5100",
      "dark": "#f8dc88"
    },
    "12": {
      "light": "#3d2c00",
      "dark": "#fff5c3"
    },
    "contrast": {
      "light": "#ffffff",
      "dark": "#33290a"
    }
  },
  "green": {
    "1": {
      "light": "#f6fcf7",
      "dark": "#0c170f"
    },
    "2": {
      "light": "#ecf8ee",
      "dark": "#112015"
    },
    "3": {
      "light": "#e1f2e4",
      "dark": "#142a1b"
    },
    "4": {
      "light": "#d4edd9",
      "dark": "#173522"
    },
    "5": {
      "light": "#c8e6ce",
      "dark": "#1b4129"
    },
    "6": {
      "light": "#b9dfc1",
      "dark": "#225133"
    },
    "7": {
      "light": "#a8d5b1",
      "dark": "#2a633f"
    },
    "8": {
      "light": "#8fc79c",
      "dark": "#3b7f53"
    },
    "9": {
      "light": "#2e7042",
      "dark": "#7fcb97"
    },
    "10": {
      "light": "#216437",
      "dark": "#8ddaa5"
    },
    "11": {
      "light": "#13562b",
      "dark": "#a5eaba"
    },
    "12": {
      "light": "#0a3017",
      "dark": "#d8ffe3"
    },
    "contrast": {
      "light": "#ffffff",
      "dark": "#122c1a"
    }
  },
  "teal": {
    "1": {
      "light": "#f5fcfa",
      "dark": "#0a1714"
    },
    "2": {
      "light": "#ebf7f4",
      "dark": "#0d201c"
    },
    "3": {
      "light": "#def2ec",
      "dark": "#0e2a24"
    },
    "4": {
      "light": "#d1ece4",
      "dark": "#0f352d"
    },
    "5": {
      "light": "#c3e6dc",
      "dark": "#0f4137"
    },
    "6": {
      "light": "#b4ded2",
      "dark": "#135145"
    },
    "7": {
      "light": "#a1d5c6",
      "dark": "#176355"
    },
    "8": {
      "light": "#86c7b5",
      "dark": "#267f6e"
    },
    "9": {
      "light": "#176d5c",
      "dark": "#6cc9b4"
    },
    "10": {
      "light": "#006151",
      "dark": "#7bd8c2"
    },
    "11": {
      "light": "#005344",
      "dark": "#96e8d4"
    },
    "12": {
      "light": "#002e25",
      "dark": "#cefff2"
    },
    "contrast": {
      "light": "#ffffff",
      "dark": "#102d26"
    }
  },
  "cyan": {
    "1": {
      "light": "#f4fcfe",
      "dark": "#0b1619"
    },
    "2": {
      "light": "#ebf7fb",
      "dark": "#0e1f24"
    },
    "3": {
      "light": "#def1f7",
      "dark": "#10282f"
    },
    "4": {
      "light": "#d0eaf4",
      "dark": "#12333c"
    },
    "5": {
      "light": "#c2e4ef",
      "dark": "#143e49"
    },
    "6": {
      "light": "#b3dbe9",
      "dark": "#1a4d5b"
    },
    "7": {
      "light": "#a0d1e2",
      "dark": "#1f5f70"
    },
    "8": {
      "light": "#84c2d7",
      "dark": "#2f798e"
    },
    "9": {
      "light": "#14687e",
      "dark": "#74c4dc"
    },
    "10": {
      "light": "#005c72",
      "dark": "#82d3eb"
    },
    "11": {
      "light": "#004e62",
      "dark": "#9ce3fa"
    },
    "12": {
      "light": "#002c37",
      "dark": "#d2fdff"
    },
    "contrast": {
      "light": "#ffffff",
      "dark": "#0c2831"
    }
  },
  "blue": {
    "1": {
      "light": "#f5fbff",
      "dark": "#0e141c"
    },
    "2": {
      "light": "#ebf5ff",
      "dark": "#141c29"
    },
    "3": {
      "light": "#deeeff",
      "dark": "#192536"
    },
    "4": {
      "light": "#d1e7ff",
      "dark": "#1f2e45"
    },
    "5": {
      "light": "#c3dfff",
      "dark": "#253955"
    },
    "6": {
      "light": "#b5d5ff",
      "dark": "#2e4668"
    },
    "7": {
      "light": "#a2caff",
      "dark": "#3a5780"
    },
    "8": {
      "light": "#89b8ff",
      "dark": "#4d70a2"
    },
    "9": {
      "light": "#2a5dae",
      "dark": "#8bb4ef"
    },
    "10": {
      "light": "#1e51a1",
      "dark": "#99c2fe"
    },
    "11": {
      "light": "#12438e",
      "dark": "#aed4ff"
    },
    "12": {
      "light": "#092551",
      "dark": "#daf1ff"
    },
    "contrast": {
      "light": "#ffffff",
      "dark": "#071a36"
    }
  },
  "indigo": {
    "1": {
      "light": "#f7f9ff",
      "dark": "#121220"
    },
    "2": {
      "light": "#eff2ff",
      "dark": "#1a192e"
    },
    "3": {
      "light": "#e5eaff",
      "dark": "#22203d"
    },
    "4": {
      "light": "#dbe1ff",
      "dark": "#2b284e"
    },
    "5": {
      "light": "#d0d7ff",
      "dark": "#343060"
    },
    "6": {
      "light": "#c4ccff",
      "dark": "#413c77"
    },
    "7": {
      "light": "#b6beff",
      "dark": "#514a92"
    },
    "8": {
      "light": "#a3aaff",
      "dark": "#6961b7"
    },
    "9": {
      "light": "#4e46c6",
      "dark": "#918aec"
    },
    "10": {
      "light": "#4439b8",
      "dark": "#9e98fb"
    },
    "11": {
      "light": "#392aa4",
      "dark": "#b0abff"
    },
    "12": {
      "light": "#1f185e",
      "dark": "#cfceff"
    },
    "contrast": {
      "light": "#ffffff",
      "dark": "#16143c"
    }
  },
  "purple": {
    "1": {
      "light": "#fdf7ff",
      "dark": "#18101d"
    },
    "2": {
      "light": "#faf0ff",
      "dark": "#221729"
    },
    "3": {
      "light": "#f6e5ff",
      "dark": "#2c1d37"
    },
    "4": {
      "light": "#f1dbff",
      "dark": "#382445"
    },
    "5": {
      "light": "#ecd0ff",
      "dark": "#452b55"
    },
    "6": {
      "light": "#e6c4ff",
      "dark": "#553669"
    },
    "7": {
      "light": "#deb4fd",
      "dark": "#694381"
    },
    "8": {
      "light": "#d29ef7",
      "dark": "#8558a3"
    },
    "9": {
      "light": "#7b3fa0",
      "dark": "#c591e8"
    },
    "10": {
      "light": "#6f3393",
      "dark": "#d49ff7"
    },
    "11": {
      "light": "#602681",
      "dark": "#e3b4ff"
    },
    "12": {
      "light": "#361449",
      "dark": "#f7daff"
    },
    "contrast": {
      "light": "#ffffff",
      "dark": "#230b33"
    }
  },
  "pink": {
    "1": {
      "light": "#fff6fa",
      "dark": "#1c0f15"
    },
    "2": {
      "light": "#ffedf5",
      "dark": "#28151e"
    },
    "3": {
      "light": "#ffe2ee",
      "dark": "#351b27"
    },
    "4": {
      "light": "#ffd6e6",
      "dark": "#432131"
    },
    "5": {
      "light": "#ffc9df",
      "dark": "#52283c"
    },
    "6": {
      "light": "#ffbbd5",
      "dark": "#65324a"
    },
    "7": {
      "light": "#ffaaca",
      "dark": "#7d3e5b"
    },
    "8": {
      "light": "#fa91ba",
      "dark": "#9e5275"
    },
    "9": {
      "light": "#a63368",
      "dark": "#ee94bc"
    },
    "10": {
      "light": "#99255d",
      "dark": "#fea2ca"
    },
    "11": {
      "light": "#86174f",
      "dark": "#ffb7db"
    },
    "12": {
      "light": "#4c0d2b",
      "dark": "#ffe1f6"
    },
    "contrast": {
      "light": "#ffffff",
      "dark": "#35081c"
    }
  },
  "gray": {
    "1": {
      "light": "#f7f6f2",
      "dark": "#1b1a17"
    },
    "2": {
      "light": "#f2f1ec",
      "dark": "#201e1a"
    },
    "3": {
      "light": "#edece6",
      "dark": "#25231e"
    },
    "4": {
      "light": "#e9e7e1",
      "dark": "#2a2821"
    },
    "5": {
      "light": "#e4e2db",
      "dark": "#2f2c25"
    },
    "6": {
      "light": "#e0ddd5",
      "dark": "#343128"
    },
    "7": {
      "light": "#c9c5ba",
      "dark": "#4c483d"
    },
    "8": {
      "light": "#ada89d",
      "dark": "#625e53"
    },
    "9": {
      "light": "#777368",
      "dark": "#79756a"
    },
    "10": {
      "light": "#6a665b",
      "dark": "#8f8b80"
    },
    "11": {
      "light": "#5d5a50",
      "dark": "#a6a296"
    },
    "12": {
      "light": "#25231d",
      "dark": "#edebe3"
    },
    "contrast": {
      "light": "#ffffff",
      "dark": "#ffffff"
    }
  }
};

export const SURFACES: Record<string, Themed> = {
  "raised": {
    "light": "#ffffff",
    "dark": "#252320"
  },
  "inset": {
    "light": "#eceae3",
    "dark": "#141310"
  }
};

export const LITERALS: Record<string, Themed> = {
  "highlight": {
    "light": "#f1dfa0",
    "dark": "#4a4020"
  },
  "black": {
    "light": "#000000",
    "dark": "#000000"
  },
  "white": {
    "light": "#ffffff",
    "dark": "#ffffff"
  }
};

