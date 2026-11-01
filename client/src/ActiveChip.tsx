// The "Active tickets only" filter from a dashboard card. statusGroup has no
// dropdown, so it shows as a chip with a remove button (ui-spec section 4).
export default function ActiveChip({ onRemove }: { onRemove: () => void }) {
  return (
    <div className="mt-3">
      <span
        className="badge rounded-pill d-inline-flex align-items-center gap-2 px-3 py-2"
        style={{ backgroundColor: "#EAF6EF", color: "#006B3C" }}
      >
        Active tickets only
        <button
          type="button"
          className="btn-close"
          style={{ fontSize: "0.6rem" }}
          aria-label="Remove filter: Active tickets only"
          onClick={onRemove}
        />
      </span>
    </div>
  );
}
