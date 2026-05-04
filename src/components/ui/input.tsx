import * as React from "react";
import { cn } from "@/lib/utils";

type LabelledProps = {
  label: React.ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
};

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & LabelledProps;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, id, className, ...props },
  ref,
) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-fg">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "w-full h-10 px-3 rounded-lg bg-bg border border-border text-fg",
          "placeholder:text-fg-subtle",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & LabelledProps;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, id, className, ...props },
  ref,
) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-fg">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "w-full min-h-[96px] px-3 py-2 rounded-lg bg-bg border border-border text-fg",
          "placeholder:text-fg-subtle",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent",
          error && "border-danger",
          className,
        )}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

type Option = { value: string; label: string };
type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> &
  LabelledProps & { options: readonly Option[]; placeholder?: string };

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, id, className, options, placeholder, ...props },
  ref,
) {
  const autoId = React.useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-fg">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      <select
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
        className={cn(
          "w-full h-10 px-3 rounded-lg bg-bg border border-border text-fg",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:border-accent",
          error && "border-danger",
          className,
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={hintId} className="text-xs text-fg-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});
