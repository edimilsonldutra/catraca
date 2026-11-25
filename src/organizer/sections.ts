import type { SessionUser } from '../auth/session.js'
import type { EventRecord } from '../events/repository.js'
import type { Html } from '../shared/html.js'

// F2.P2: seções da página de gestão. Cada feature registra a sua aqui, com a ordem em que
// aparece, sem editar a página: features paralelas não disputam o mesmo trecho.
export type ManageFlash = { section: string; message: string; kind: 'msg' | 'erro' }

export type SectionContext = {
  event: EventRecord
  user: SessionUser
  flash: ManageFlash | null
}

type Section = { key: string; order: number; render: (ctx: SectionContext) => Promise<Html> }

const sections: Section[] = []

export function registerSection(section: Section) {
  if (!sections.some((s) => s.key === section.key)) sections.push(section)
  sections.sort((a, b) => a.order - b.order)
}

export function listSections() {
  return [...sections]
}
