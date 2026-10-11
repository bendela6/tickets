import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@bh/ui';
import '../api/mutation-meta';

// A failed save used to vanish: the board refetched and the edit quietly
// reverted. Every mutation that fails now says so, except where the screen
// that ran it already shows the error (meta.showsOwnError).
export function MutationErrorToasts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(
    () =>
      queryClient.getMutationCache().subscribe((event) => {
        if (event.type !== 'updated' || event.action.type !== 'error') return;
        if (event.mutation.meta?.showsOwnError) return;
        const error = event.action.error;
        toast({ title: `Couldn't save: ${error instanceof Error ? error.message : 'something went wrong'}` });
      }),
    [queryClient, toast],
  );

  return null;
}
