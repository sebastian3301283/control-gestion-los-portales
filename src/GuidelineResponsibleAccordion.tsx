import { useState } from 'react'
import { ChevronDown, UsersRound } from 'lucide-react'
import GuidelineResponsibleConfiguration from './GuidelineResponsibleConfiguration'
import './catalog-configuration.css'
import './guideline-responsible-accordion.css'

type Unit = { code: string; name: string }
type Props = { units?: Unit[]; canManage: boolean }

export default function GuidelineResponsibleAccordion({ units, canManage }: Props) {
  const [open, setOpen] = useState(false)

  return <section className={`guideline-responsible-accordion config-accordion ${open ? 'open' : ''}`}>
    <button className="config-accordion-head" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <span className="config-accordion-icon"><UsersRound size={21}/></span>
      <div>
        <small>Plan de Acción</small>
        <h2>Gerentes responsables por lineamiento</h2>
        <p>Configura uno o varios nombres para cada lineamiento de HU, VS, Departamentos y Hoteles.</p>
      </div>
      <ChevronDown className={open ? 'rotated' : ''} size={20}/>
    </button>

    {open && <div className="config-accordion-body guideline-responsible-accordion-body">
      <GuidelineResponsibleConfiguration units={units} canManage={canManage} />
    </div>}
  </section>
}
