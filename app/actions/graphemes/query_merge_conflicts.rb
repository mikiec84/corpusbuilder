module Graphemes
  class QueryMergeConflicts < Action::Base
    attr_accessor :branch_left, :branch_right

    validates :branch_left, presence: true
    validates :branch_right, presence: true

    def execute
      @_conflicts ||= -> {
        sql = <<-SQL
          select array[diff1.id, diff2.id] as conflicting_ids,
                diff2.value,
                diff2.area,
                diff2.zone_id,
                diff2.position_weight,
                diff2.parent_ids,
                diff2.surface_number
          from (
            select g.grapheme_id as id,
                g.inclusion[1],
                graphemes.status,
                graphemes.value,
                graphemes.area,
                graphemes.zone_id,
              graphemes.position_weight,
              graphemes.parent_ids,
              surfaces.number as surface_number
            from (
              select gs.grapheme_id, array_agg(gs.inclusion) as inclusion
              from (
                select grapheme_id, 'left' as inclusion
                from #{root.graphemes_revisions_partition_table_name}
                union all
                select grapheme_id, 'right' as inclusion
                from #{left.graphemes_revisions_partition_table_name}
              ) gs
              group by grapheme_id
              having array_length(array_agg(gs.inclusion), 1) < 2
            ) g
            inner join graphemes
                    on graphemes.id = g.grapheme_id
            inner join zones
                      on zones.id = graphemes.zone_id
            inner join surfaces
                    on surfaces.id = zones.surface_id
            order by surfaces.number, graphemes.position_weight
          ) diff1
          inner join (
            select g.grapheme_id as id,
                g.inclusion[1],
                graphemes.status,
                graphemes.value,
                graphemes.area,
                graphemes.zone_id,
              graphemes.position_weight,
              graphemes.parent_ids,
              surfaces.number as surface_number
            from (
              select gs.grapheme_id, array_agg(gs.inclusion) as inclusion
              from (
                select grapheme_id, 'left' as inclusion
                from #{root.graphemes_revisions_partition_table_name}
                union all
                select grapheme_id, 'right' as inclusion
                from #{right.graphemes_revisions_partition_table_name}
              ) gs
              group by grapheme_id
              having array_length(array_agg(gs.inclusion), 1) < 2
            ) g
            inner join graphemes
                    on graphemes.id = g.grapheme_id
            inner join zones
                      on zones.id = graphemes.zone_id
            inner join surfaces
                    on surfaces.id = zones.surface_id
            order by surfaces.number, graphemes.position_weight
          ) diff2
          on   ( diff1.inclusion = 'right' and ( diff1.area && diff2.area ) )
            or ( diff2.inclusion = 'right' and ( diff1.area && diff2.area ) )
        SQL

        Grapheme.find_by_sql sql
      }.call
    end

    private

    def root
      @_root ||= Revisions::QueryClosestRoot.run!(
        revision1: left,
        revision2: right
      ).result
    end

    def left
      branch_left.revision
    end

    def right
      branch_right.revision
    end
  end
end