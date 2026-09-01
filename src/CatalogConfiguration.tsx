import CatalogConfigurationLegacy from './CatalogConfigurationLegacy'
import GuidelineCatalog from './GuidelineCatalog'

type Unit = { code: string; name: string }
type Props = { units?: Unit[]; canManage: boolean }

export default function CatalogConfiguration(props: Props) {
  return <div style={{ display: 'grid', gap: 16 }}>
    <CatalogConfigurationLegacy {...props} />
    <GuidelineCatalog {...props} />
  </div>
}
