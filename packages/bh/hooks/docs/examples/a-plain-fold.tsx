import { useDisclosure } from '@bh/hooks';

// Questions that fold their answers: a heading with a button inside it, and
// the paragraph it folds, with no component of bh's between them.

const BUTTON = 'rounded-6 hover:bg-gray-3 -mx-8 w-full px-8 py-6 text-left';

function Question({ question, answer }: { question: string; answer: string }) {
  const fold = useDisclosure();
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-13/19 font-500 text-gray-12">
        <button {...fold.getTriggerProps({ className: BUTTON })}>
          {fold.isOpen ? '−' : '+'} {question}
        </button>
      </h3>
      <p {...fold.getRegionProps({ className: 'text-13/19 text-gray-11' })}>{answer}</p>
    </div>
  );
}

export function APlainFold() {
  return (
    <div className="flex w-320 flex-col gap-8">
      <Question question="How long does shipping take?" answer="Two days, in one box." />
      <Question question="Can I return it?" answer="Yes, free for thirty days." />
    </div>
  );
}
