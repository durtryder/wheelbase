/**
 * MediaReorderGrid (web)
 *
 * Drag-and-drop sortable grid powered by @dnd-kit. Pointer + keyboard
 * sensors so it's mouse, touch, and a11y-friendly. Renders DOM elements
 * directly because @dnd-kit hooks into native browser DnD; Metro picks
 * this file over media-reorder-grid.tsx on the web bundle.
 */

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { MediaItem } from '@/types/vehicle';

type Props = {
  media: MediaItem[];
  onReorder: (orderedIds: string[]) => void;
};

export function MediaReorderGrid({ media, onReorder }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = media.findIndex((m) => m.id === active.id);
    const newIndex = media.findIndex((m) => m.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(media, oldIndex, newIndex);
    onReorder(next.map((m) => m.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}>
      <SortableContext items={media.map((m) => m.id)} strategy={rectSortingStrategy}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 8,
          }}>
          {media.map((item, idx) => (
            <SortableThumb
              key={item.id}
              item={item}
              index={idx}
              borderColor={palette.border}
              tintColor={palette.tint}
              tileBg={palette.surfaceDim}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableThumb({
  item,
  index,
  borderColor,
  tintColor,
  tileBg,
}: {
  item: MediaItem;
  index: number;
  borderColor: string;
  tintColor: string;
  tileBg: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    aspectRatio: '1 / 1',
    borderRadius: 4,
    border: `1px solid ${borderColor}`,
    overflow: 'hidden',
    position: 'relative',
    cursor: isDragging ? 'grabbing' : 'grab',
    opacity: isDragging ? 0.4 : 1,
    backgroundColor: tileBg,
    touchAction: 'none',
  };

  const isPhoto = item.kind === 'photo' && !!item.downloadUrl;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`Item ${index + 1}: drag to reorder`}>
      {isPhoto ? (
        <img
          src={item.downloadUrl}
          alt={item.caption ?? ''}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            color: '#f4e4bc',
            fontSize: 11,
            letterSpacing: 1.4,
            fontWeight: 700,
            pointerEvents: 'none',
          }}>
          VIDEO
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          left: 6,
          padding: '2px 7px',
          borderRadius: 2,
          backgroundColor: tintColor,
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1,
          pointerEvents: 'none',
        }}>
        {index + 1}
      </div>
    </div>
  );
}
