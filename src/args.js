// Tiny argv parser: positional args + --flag / --key value.
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

/** "1", "1,3", "2-5", "all" -> sorted unique numbers (all = 1..max). */
function parseModuleList(tokens, max) {
  const set = new Set();
  for (const t of tokens.join(',').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (t === 'all') for (let i = 1; i <= max; i++) set.add(i);
    else if (/^\d+-\d+$/.test(t)) { const [a, b] = t.split('-').map(Number); for (let i = a; i <= b; i++) set.add(i); }
    else if (/^\d+$/.test(t)) set.add(Number(t));
    else throw new Error(`Bad module selector "${t}" (use e.g. 1 | 1,3 | 2-5 | all)`);
  }
  return [...set].sort((a, b) => a - b);
}

module.exports = { parseArgs, parseModuleList };
