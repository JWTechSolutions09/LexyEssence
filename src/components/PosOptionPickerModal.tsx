type PickerOption = {
  value: string;
  label: string;
  hint?: string;
};

type PosOptionPickerModalProps = {
  title: string;
  description?: string;
  options: PickerOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
};

export function PosOptionPickerModal({
  title,
  description,
  options,
  selectedValue,
  onSelect,
  onClose,
}: PosOptionPickerModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel card pos-picker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="row">
          <div>
            <h2 id="pos-picker-title">{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
          <button className="ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>

        <div className="pos-picker-options">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`pos-picker-option ${selectedValue === option.value ? "is-selected" : ""}`}
              onClick={() => onSelect(option.value)}
            >
              <span className="pos-picker-option-label">{option.label}</span>
              {option.hint && <span className="pos-picker-option-hint">{option.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
