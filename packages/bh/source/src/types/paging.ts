/**
 * How a source pages, in its own words: numbered by skip and take, or by a
 * page number and size (then a skip is a whole page's), and after a cursor
 * of its own. Names and places differ by source (a query param, a body, a
 * header), so each is a function.
 */
export interface Paging<Request, Answer> {
  /** The most rows a page takes, 500 at most. */
  max: number;
  /** '?offset=40&limit=20' */
  offset?: (skip: number, take: number) => Request;
  /** '?page=3&per_page=20': the page counts from 1. */
  page?: (page: number, size: number) => Request;
  /** After the source's own cursor, which its answer gives (`next`): undefined for the first page. */
  cursor?: {
    send: (cursor: string | undefined, take: number) => Request;
    next: (answer: Answer) => string | null;
  };
  /** Whether a page follows, where the source says so (a Link header's rel="next") and doesn't count. */
  more?: (answer: Answer) => boolean;
}
