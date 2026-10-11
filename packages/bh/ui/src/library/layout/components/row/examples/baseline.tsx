import { Row } from '@bh/ui';

export function Baseline() {
  return (
    <Row align="baseline" gap={2}>
      <span className="text-24 text-gray-12">42</span>
      <span className="text-13/19 text-gray-11">files shared</span>
    </Row>
  );
}
