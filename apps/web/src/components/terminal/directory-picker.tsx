import { useWorkdirRoots } from '../../api/use-workdir-dirs';
import { Input } from '@tickets/ui';
import { DirectoryTree } from '../../ui/directory-tree';

export function DirectoryPicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (path: string) => void;
}) {
  const roots = useWorkdirRoots();
  return (
    <div className="overflow-hidden rounded-xl border-1 border-gray-7 bg-gray-1">
      <div className="flex h-8 items-center gap-2 border-b-1 border-gray-6 bg-surface-inset px-2.5">
        <span aria-hidden className="size-3 shrink-0 rounded-sm border-1 border-yellow-8" />
        {value ? (
          <span className="truncate font-mono text-12/17 font-500 text-indigo-9">{value}</span>
        ) : (
          <span className="font-mono text-12/17 italic text-gray-9">no folder selected</span>
        )}
      </div>
      <DirectoryTree roots={roots.data ?? []} selected={value || null} onSelect={onChange} />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/absolute path — or pick above"
        className="rounded-none border-0 border-t-1 border-gray-6 font-mono text-13"
      />
    </div>
  );
}
