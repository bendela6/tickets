import { useId, type ReactNode } from 'react';
import { cn } from '../../../../style';
import { Card, CardBody, type Padding } from '../card';
import { FoldRow, useFoldOpen } from '../disclosure/fold';

interface FoldCardProps {
  /** The card's title, in its header beside the chevron. */
  title: ReactNode;
  /**
   * Beside the title while folded: what the card holds, cut to one line, and
   * cut first in a narrow card, so the title keeps its words. Gone once open.
   */
  summary?: ReactNode;
  /**
   * Whether it is open. Leave it out and the card holds its own, from
   * `defaultOpen`.
   */
  open?: boolean;
  /** Whether it starts open, when `open` is left out. */
  defaultOpen?: boolean;
  /** Called with the new state on every click, whether `open` is given or not. */
  onOpenChange?: (open: boolean) => void;
  /** Space around the content, in steps of 4 pixels, as CardBody's: 0 for content that runs to the edges. */
  padding?: Padding;
  /** Added to the card's classes. */
  className?: string;
  /** What the card holds, under its header, drawn only while open. */
  children: ReactNode;
}

/**
 * A Card whose header folds it: a chevron, the title, and a summary while
 * folded.
 *
 * Open, it is a card with a CardHeader and a CardTitle over a CardBody: the
 * same padding, rule and type. Folded, the header is the whole card. The
 * title is an `h3` around the button, as CardTitle is always an `h3`, so the
 * card is a heading to jump to either way.
 */
export function FoldCard({
  title,
  summary,
  open,
  defaultOpen = false,
  onOpenChange,
  padding = 4,
  className,
  children,
}: FoldCardProps) {
  const contentId = `${useId()}content`;
  const [isOpen, toggle] = useFoldOpen(open, defaultOpen, onOpenChange);
  return (
    <Card className={className}>
      <h3>
        <FoldRow
          open={isOpen}
          onToggle={toggle}
          title={title}
          summary={summary}
          contentId={contentId}
          chevron="lg"
          className={cn(
            'hover:bg-gray-2 text-gray-11 w-full gap-8 px-16 py-12',
            // The card clips at its border's inner edge, 11px round; the
            // header's focus rim follows the same curve rather than being cut
            // off at the corners. Open, the rule squares its lower edge.
            isOpen ? 'border-gray-6 rounded-t-11 border-b-1' : 'rounded-11',
          )}
          titleClassName="text-13/19 font-600 text-gray-12 font-sans"
          summaryClassName="text-12/17"
        />
      </h3>
      {isOpen ? (
        <CardBody id={contentId} padding={padding}>
          {children}
        </CardBody>
      ) : null}
    </Card>
  );
}
