const COLORS = ['#6C5CE7','#00B894','#E17055','#0984E3','#FDCB6E','#E84393'];

interface Props {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="color-picker" id="colorPicker">
      {COLORS.map(c => (
        <div
          key={c}
          className={`color-option${c === value ? ' selected' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}
