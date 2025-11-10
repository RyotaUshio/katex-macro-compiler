import { parseMacros } from './parse';
import * as fs from 'node:fs';

it('works', () => {
    const source = fs.readFileSync('./tests/macros.sty', 'utf-8');
    expect(parseMacros(source)).toMatchSnapshot();
});
