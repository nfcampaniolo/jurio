type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input(props: InputProps) {
  return (
    <input
      {...props}
      className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-yellow-500"
    />
  );
}