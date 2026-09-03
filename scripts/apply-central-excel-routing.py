from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'No se encontró: {label}')
    return text.replace(old, new, 1)

# Route only Central through the new Excel workspace while preserving V11 locks/presence.
path = Path('src/MatrixWorkspaceV11.tsx')
source = path.read_text()
source = replace_once(
    source,
    "import MatrixWorkspaceV10 from './MatrixWorkspaceV10'\n",
    "import MatrixWorkspaceV10 from './MatrixWorkspaceV10'\nimport CentralExcelWorkspace from './CentralExcelWorkspace'\n",
    'import CentralExcelWorkspace',
)
source = replace_once(
    source,
    '    <MatrixWorkspaceV10 key={revision} {...workspaceProps} />',
    "    {props.unitCode === 'CENTRAL' ? <CentralExcelWorkspace key={revision} {...workspaceProps} unitCode=\"CENTRAL\" /> : <MatrixWorkspaceV10 key={revision} {...workspaceProps} />}",
    'render CentralExcelWorkspace',
)
path.write_text(source)

# Keep valid table markup: grouped rows use keyed React fragments, never nested tbody elements.
path = Path('src/CentralExcelWorkspace.tsx')
source = path.read_text()
source = replace_once(
    source,
    "import { ChangeEvent, CSSProperties, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'",
    "import { ChangeEvent, CSSProperties, Fragment, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'",
    'Fragment import',
)
source = source.replace("return <tbody key={row.id}>{renderEditRows(`edit-${row.id}`)}</tbody>", "return <Fragment key={row.id}>{renderEditRows(`edit-${row.id}`)}</Fragment>")
source = source.replace("return <tbody key={row.id}>\n            {showGroup", "return <Fragment key={row.id}>\n            {showGroup")
source = source.replace("            </tr>\n          </tbody>\n        })}", "            </tr>\n          </Fragment>\n        })}")
path.write_text(source)
