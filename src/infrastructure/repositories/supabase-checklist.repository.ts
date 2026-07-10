import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChecklistRepository } from '@/domain/repositories';
import type { ChecklistSection } from '@/domain/entities';

export class SupabaseChecklistRepository implements ChecklistRepository {
  constructor(private readonly db: SupabaseClient) {}

  async getActiveSections(): Promise<ChecklistSection[]> {
    const [{ data: sections, error: sErr }, { data: items, error: iErr }] = await Promise.all([
      this.db.from('checklist_sections').select('*').eq('is_active', true).order('sort_order'),
      this.db.from('checklist_items').select('*').eq('is_active', true).order('item_no'),
    ]);
    if (sErr) throw sErr;
    if (iErr) throw iErr;

    return (sections ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      sortOrder: s.sort_order,
      isActive: s.is_active,
      items: (items ?? [])
        .filter((it) => it.section_id === s.id)
        .map((it) => ({
          id: it.id,
          sectionId: it.section_id,
          itemNo: it.item_no,
          content: it.content,
          hasTempFacilityField: it.has_temp_facility_field,
          sortOrder: it.sort_order,
          isActive: it.is_active,
        })),
    }));
  }
}
