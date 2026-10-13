import { useState } from 'react';
import { Page, PageBody, PageHeader, TabNav } from '@bh/shell/layout';
import { Button, Icon } from '@bh/ui';

// Each list is a tab and a route; New list follows them in the row, and is not one.
const LISTS = [
  { to: '/lists/to-read', label: 'To read', badge: 14 },
  { to: '/lists/reading', label: 'Reading', badge: 2 },
  { to: '/lists/read', label: 'Read', badge: 81 },
];

export function ANewList() {
  const [lists, setLists] = useState(LISTS);
  const add = () => {
    const n = lists.length + 1;
    setLists([...lists, { to: `/lists/list-${n}`, label: `List ${n}`, badge: 0 }]);
  };
  return (
    <Page
      header={
        <PageHeader
          title="Reading lists"
          tabs={
            <TabNav
              tabs={lists}
              label="Lists"
              trailing={
                <Button variant="ghost" size="sm" onClick={add}>
                  <Icon name="plus" size="sm" />
                  New list
                </Button>
              }
            />
          }
        />
      }
    >
      <PageBody>
        <p className="text-13/19 text-gray-11">
          New list sits after the last tab, on the row&apos;s rule, but it is not a tab: it is never
          lit, and pressing it adds a list rather than going to one.
        </p>
      </PageBody>
    </Page>
  );
}
