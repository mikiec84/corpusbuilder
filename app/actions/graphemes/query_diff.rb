module Graphemes
  class QueryDiff < Action::Base
    attr_accessor :revision_left, :revision_right

    validates :revision_right, presence: true

    def execute
      all_diffs.reject { |g| has_mirrored?(g) }
    end

    def all_diffs
      @_all_diffs ||= -> {
        sql = <<-sql
          select g.grapheme_id as id,
                g.inclusion[1],
                graphemes.status,
                graphemes.value,
                graphemes.area,
                graphemes.status,
                graphemes.zone_id,
              graphemes.position_weight,
              graphemes.parent_ids,
              surfaces.number as surface_number
          from (
            select gs.grapheme_id, array_agg(gs.inclusion) as inclusion
            from (
              select grapheme_id, 'left' as inclusion
              from #{revision_left.graphemes_revisions_partition_table_name}
              union all
              select grapheme_id, 'right' as inclusion
              from #{revision_right.graphemes_revisions_partition_table_name}
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
        sql

        Grapheme.find_by_sql sql
      }.call
    end

    def has_mirrored?(grapheme)
      all_diffs.any? do |other|
        grapheme.inclusion != other.inclusion &&
          grapheme.value == other.value &&
          grapheme.area == other.area &&
          grapheme.surface_number == other.surface_number
      end
    end
  end
end
