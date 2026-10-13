import { FoldCard } from '@bh/ui';

const FILES = ['index.html', 'styles.css', 'main.js'];

export function ToTheEdges() {
  return (
    <FoldCard
      title="Files"
      summary={`${FILES.length} files`}
      padding={0}
      defaultOpen
      className="w-400 max-w-full"
    >
      <ul>
        {FILES.map((file) => {
          return (
            <li
              key={file}
              className="border-gray-5 text-13/19 text-gray-12 border-b-1 px-16 py-8 font-mono last:border-b-0"
            >
              {file}
            </li>
          );
        })}
      </ul>
    </FoldCard>
  );
}
