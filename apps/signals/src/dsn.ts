import { environment } from './environment';

export function composeDsn(ingestKey: string, appId: number): string {
  return `sgl://${ingestKey}@${environment.publicAddress}/${appId}`;
}
