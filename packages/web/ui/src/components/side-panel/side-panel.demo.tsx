import { SidePanel } from './side-panel';

export const meta = {
  title: 'SidePanel',
  group: 'Components',
  size: 'lg',
  impl: ['./side-panel.tsx'],
};

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="flex h-64 overflow-hidden rounded-lg border-1 border-gray-6">{children}</div>;
}

const body = (
  <nav className="flex flex-col gap-1 p-3 font-sans text-13/19 text-gray-11">
    <span>First</span>
    <span>Second</span>
    <span>Third</span>
  </nav>
);

export const states = [
  {
    name: 'left, collapsible',
    render: () => (
      <Frame>
        <SidePanel label="Navigation" collapsible>
          {body}
        </SidePanel>
        <div className="flex-1 p-3 font-sans text-13/19 text-gray-9">Content</div>
      </Frame>
    ),
  },
  {
    name: 'right, collapses to a rail',
    render: () => (
      <Frame>
        <div className="flex-1 p-3 font-sans text-13/19 text-gray-9">Content</div>
        <SidePanel label="Details" side="right" collapsible defaultWidth={240} maxWidth={420}>
          {body}
        </SidePanel>
      </Frame>
    ),
  },
];
