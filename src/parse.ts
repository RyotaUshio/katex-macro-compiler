import { regex } from 'arkregex';

/** Parse LaTeX macro definitions and transpile them to a KaTeX-compatible macro object */
export function parseMacros(source: string): Record<string, string> {
    const lines = source.split('\n');
    const cmdsWithOptionalArgs = getCmdsWithOptionalArg(lines);
    const macros = Object.fromEntries(
        lines
            .map(
                line =>
                    processNewCommand(line, cmdsWithOptionalArgs) ??
                    processDeclareMathOperator(line),
            )
            .filter(line => !!line),
    );
    return macros;
}

const trim = (line: string) => line.replace(/(?<!\\)%.*$/, '').trim();

const newCommand = regex(
    '^\\s*\\\\(re)?newcommand{(?<cmd>[^}]*)}(\\[(?<nargs>\\d+)\\](\\[(?<optional>[^\\]]*)\\])?)?{(?<def>.*)}',
);

interface CmdsWithOptionalArgs {
    cmd: string;
    nargs: number;
    def: (optionalArg: string, ...args: string[]) => string;
}

const getCmdsWithOptionalArg = (lines: string[]) => {
    const cmdsWithOptionalArgs = lines
        .map(processNewCommandWithOptionalArg)
        .filter(cmd => !!cmd);
    return cmdsWithOptionalArgs;
};

const processNewCommandWithOptionalArg = (
    line: string,
): CmdsWithOptionalArgs | null => {
    const result = newCommand.exec(trim(line));
    if (!result) return null;
    const { cmd, def, nargs, optional } = result.groups;
    if (typeof optional !== 'string') return null;
    return {
        cmd,
        nargs: parseInt(nargs),
        def: (optionalArg, ...args) =>
            def.replace(/#(\d+)/g, (_, iarg) => {
                return iarg === '1' ? optionalArg : args[parseInt(iarg) - 2];
            }),
    };
};

// KaTeX's \newcommand does not support optional argument, so we need some work
// See:
// - https://github.com/KaTeX/KaTeX/issues/2228
// - https://github.com/KaTeX/KaTeX/pull/4058
const processNewCommand = (
    line: string,
    cmdsWithOptionalArgs: CmdsWithOptionalArgs[],
) => {
    const result = newCommand.exec(trim(line));
    if (!result) return null;
    const { cmd, optional } = result.groups;
    let { def } = result.groups;

    // If a macro with optional arg is used, recursively expand it
    // until no macro with optional arg is used.

    // No fancy logic; just repeat until it's done. It's already fast enough.
    // TODO: use some cool graph stuff (e.g. A is used by B)
    // so that people think I'm smart
    while (true) {
        let changed = false;
        for (const cmdWithOptionalArgs of cmdsWithOptionalArgs) {
            const pattern = new RegExp(
                `${'\\' + cmdWithOptionalArgs.cmd}\\[(.*)\\]{(.*)}{${
                    cmdWithOptionalArgs.nargs - 1
                }}`,
                'g',
            );
            def = def.replace(pattern, (_, optionalArg, ...args) => {
                changed = true;
                return cmdWithOptionalArgs.def(optionalArg, ...args);
            });
        }
        if (!changed) break;
    }

    if (typeof optional === 'string') {
        // This \newcommand line defines a macro with an optional arg,
        // just replace the first argument with the default value
        def = def.replace(/#(\d+)/g, (_, iarg) => {
            return iarg === '1' ? optional : `#${parseInt(iarg) - 1}`;
        });
    }
    return [cmd, def];
};

const declareMathOperator = regex(
    '\\DeclareMathOperator(?<limits>\\*?){(?<operator>[^}]*)}{(?<def>.*)}',
);

// KaTeX does not support \DeclareMathOperator, so rewrite the line
// using \operatorname
const processDeclareMathOperator = (line: string) => {
    const result = declareMathOperator.exec(trim(line));
    if (!result) return null;
    const { operator, def, limits } = result.groups;
    const operatorName = '\\operatorname' + (limits ? '*' : '');
    return [operator, operatorName + '{' + def + '}'];
};
