import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { uploadSourcemaps } from './sourcemaps';

const USAGE = `Usage: signals sourcemaps upload <dir> --release <r> --dsn <dsn>

Commands:
  sourcemaps upload <dir>   Upload source maps found under <dir> to the Signals collector

Options:
  --release <r>   Release identifier to associate with the uploaded maps (required)
  --dsn <dsn>      Signals DSN, e.g. sgl://<key>@<host>/<appId> (required)
  --help           Show this help message
`;

function printUsage(): void {
  console.log(USAGE);
}

export async function run(argv: string[]): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    return 0;
  }

  const [command, subcommand, ...rest] = argv;

  if (command !== 'sourcemaps' || subcommand !== 'upload') {
    printUsage();
    return 1;
  }

  let values: { release?: string; dsn?: string };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args: rest,
      allowPositionals: true,
      options: {
        release: { type: 'string' },
        dsn: { type: 'string' },
      },
    }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printUsage();
    return 1;
  }

  const dir = positionals[0];
  if (!dir || !values.release || !values.dsn) {
    console.error('sourcemaps upload requires <dir>, --release, and --dsn');
    printUsage();
    return 1;
  }

  try {
    const result = await uploadSourcemaps({ dir, release: values.release, dsn: values.dsn });
    console.log(`uploaded ${result.uploaded.length} source map(s) for release ${values.release}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

/* c8 ignore start */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
/* c8 ignore stop */
