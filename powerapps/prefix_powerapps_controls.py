from __future__ import annotations

import re
import sys
from pathlib import Path

CONTROL_DEF = re.compile(r'^(\s*)-\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*$', re.M)

PREFIXES = {
    'scrInicio.pa.yaml': 'ini_',
    'scrPeriodos.pa.yaml': 'per_',
    'scrUnidades.pa.yaml': 'uni_',
    'scrLineamientos.pa.yaml': 'lin_',
    'scrMatriz.pa.yaml': 'mat_',
    'scrSoportes.pa.yaml': 'sop_',
    'scrPermisos.pa.yaml': 'perm_',
}


def prefix_file(path: Path, prefix: str) -> None:
    text = path.read_text(encoding='utf-8')
    names = CONTROL_DEF.findall(text)
    control_names = [name for _, name in names]
    mapping = {name: prefix + name for name in control_names if not name.startswith(prefix)}
    for old in sorted(mapping, key=len, reverse=True):
        new = mapping[old]
        text = re.sub(rf'(?<![A-Za-z0-9_]){re.escape(old)}(?![A-Za-z0-9_])', new, text)
    path.write_text(text, encoding='utf-8')


def main(src_dir: str) -> None:
    src = Path(src_dir)
    for file_name, prefix in PREFIXES.items():
        path = src / file_name
        if not path.exists():
            raise FileNotFoundError(path)
        prefix_file(path, prefix)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('usage: prefix_powerapps_controls.py <Src dir>')
    main(sys.argv[1])
