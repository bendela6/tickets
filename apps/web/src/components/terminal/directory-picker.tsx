import { useWorkdirRoots } from '../../api/use-workdir-dirs';
import { DirectoryTree } from '../../ui/directory-tree';
import { Input } from '../../ui/input';

export function DirectoryPicker({ value, onChange }: { value: string; onChange: (path: string) => void }) {
  const roots = useWorkdirRoots();
  return (
    <div className="overflow-hidden rounded-[10px] border border-gray-7 bg-gray-1">
      <div className="flex h-8 items-center gap-2 border-b border-gray-6 bg-surface-inset px-2.5">
        <span aria-hidden className="size-3 shrink-0 rounded-[2px] border border-folder" />
        {value ? (
          <span className="truncate font-mono text-meta font-medium text-indigo-9">{value}</span>
        ) : (
          <span className="font-mono text-meta italic text-gray-9">no folder selected</span>
        )}
      </div>
      <DirectoryTree roots={roots.data ?? []} selected={value || null} onSelect={onChange} />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="/absolute path — or pick above"
        className="rounded-none border-0 border-t border-gray-6 font-mono text-[13px]"
      />
    </div>
  );
}
