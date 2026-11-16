/**
 * Compact, note-centric wording for proposals shown inside a note.
 */
import type {
  GraphProposal,
  MergeProposalPayload,
  NewEntityPayload,
  RelationProposalPayload,
  TypeCorrectionPayload,
} from './proposals';

export interface PresentedProposal {
  label: string;
  detail: string;
  /** Text to highlight in the note, if the proposal is grounded in a quote. */
  quote: string | null;
}

export function presentProposal(proposal: GraphProposal, noteId: string): PresentedProposal {
  switch (proposal.kind) {
    case 'new_entity': {
      const payload = proposal.payload as NewEntityPayload;
      return { label: payload.name, detail: payload.type, quote: payload.name };
    }
    case 'relation': {
      const payload = proposal.payload as RelationProposalPayload;
      if (proposal.source === 'cooccurrence') {
        return { label: `${payload.fromName} ↔ ${payload.toName}`, detail: 'often together', quote: null };
      }
      const quote =
        payload.provenance.find((item) => item.noteId === noteId && item.excerpt)?.excerpt ??
        payload.provenance.find((item) => item.excerpt)?.excerpt ??
        null;
      return { label: `${payload.fromName} → ${payload.type.replace(/_/g, ' ')} → ${payload.toName}`, detail: 'link', quote };
    }
    case 'merge': {
      const payload = proposal.payload as MergeProposalPayload;
      return { label: `${payload.removeName} = ${payload.keepName}`, detail: 'same thing', quote: null };
    }
    case 'type_correction': {
      const payload = proposal.payload as TypeCorrectionPayload;
      return { label: payload.name, detail: `${payload.oldType} → ${payload.newType}`, quote: payload.name };
    }
  }
}
