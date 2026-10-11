import { useState } from 'react';
import { Button, Dropdown } from '@bh/ui';

const COLOURS = ['Red', 'Green', 'Blue'];

export function ClosingFromTheBody() {
  const [colour, setColour] = useState('Red');
  return (
    <Dropdown trigger={<Button chevron>Colour: {colour}</Button>}>
      {(close) => {
        return (
          <div className="flex w-160 flex-col p-4">
            {COLOURS.map((option) => {
              return (
                <Button
                  key={option}
                  variant="ghost"
                  className="justify-start"
                  onClick={() => {
                    setColour(option);
                    close();
                  }}
                >
                  {option}
                </Button>
              );
            })}
          </div>
        );
      }}
    </Dropdown>
  );
}
