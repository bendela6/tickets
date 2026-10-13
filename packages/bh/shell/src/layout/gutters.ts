// The page's gutters: 16 pixels on a phone, 32 across and 24 down from md.
// PageHeader pads its band by the same across, so a body's content lines up
// with the title over it; PageBody and CardGrid take them from here, so a page
// of cards and a page of anything else line up with each other too.
//
// Not exported from the package: a page takes the gutters by using one of the
// two bodies, not by spelling them.
export const PAGE_GUTTERS = 'px-16 py-16 md:px-32 md:py-24';
