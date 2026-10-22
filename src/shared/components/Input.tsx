type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps) {
  const { className, ...inputProps } = props;

  return (
    <input
      {...inputProps}
      className={`w-full px-4 py-3 rounded-xl border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-primary) ${className ?? ""}`}
    />
  );
}