import { Notice, Stack } from '@bh/ui';

export function ATitleAndAMessage() {
  return (
    <Stack gap={3}>
      <Notice>qBittorrent has queueing off, so downloads have no order to change.</Notice>
      <Notice tone="warning" title="Coupon used">
        It was used on 3 March, so it cannot be used again.
      </Notice>
      <Notice tone="success" title="Reward ready" />
    </Stack>
  );
}
