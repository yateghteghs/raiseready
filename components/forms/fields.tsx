import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/lib/forms";
import type { Option } from "@/lib/startups/options";
import { cn } from "@/lib/utils";

type BaseProps = {
  name: string;
  label: string;
  hint?: string;
  errors?: FieldErrors;
  optional?: boolean;
  className?: string;
};

/** Accessible ids for a field's hint and error text. */
function describe(name: string, hint: string | undefined, error: string | undefined) {
  const ids = [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function FieldShell({
  name,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: Omit<BaseProps, "errors"> & { error?: string; children: React.ReactNode }) {
  return (
    <div className={cn("grid content-start gap-2", className)}>
      <Label htmlFor={name}>
        {label}
        {optional ? <span className="text-muted-foreground font-normal">(optional)</span> : null}
      </Label>
      {children}
      {hint ? (
        <p id={`${name}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  name,
  label,
  hint,
  errors,
  optional,
  className,
  ...input
}: BaseProps & Omit<React.ComponentProps<"input">, "name">) {
  const error = errors?.[name]?.[0];
  return (
    <FieldShell {...{ name, label, hint, error, optional, className }}>
      <Input
        id={name}
        name={name}
        required={!optional}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(name, hint, error)}
        {...input}
      />
    </FieldShell>
  );
}

export function TextareaField({
  name,
  label,
  hint,
  errors,
  optional,
  className,
  ...textarea
}: BaseProps & Omit<React.ComponentProps<"textarea">, "name">) {
  const error = errors?.[name]?.[0];
  return (
    <FieldShell {...{ name, label, hint, error, optional, className }}>
      <Textarea
        id={name}
        name={name}
        required={!optional}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(name, hint, error)}
        {...textarea}
      />
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  hint,
  errors,
  optional,
  className,
  options,
  placeholder = "Choose…",
  ...select
}: BaseProps & Omit<React.ComponentProps<"select">, "name"> & {
  options: Option[];
  placeholder?: string | null;
}) {
  const error = errors?.[name]?.[0];
  return (
    <FieldShell {...{ name, label, hint, error, optional, className }}>
      <NativeSelect
        id={name}
        name={name}
        required={!optional}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe(name, hint, error)}
        {...select}
      >
        {placeholder !== null ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </FieldShell>
  );
}

/** Yes / No radio pair. `defaultValue` is "yes", "no" or "" (unanswered). */
export function YesNoField({
  name,
  label,
  hint,
  errors,
  optional,
  className,
  defaultValue,
}: BaseProps & { defaultValue?: string }) {
  const error = errors?.[name]?.[0];
  return (
    <fieldset
      className={cn("grid gap-2", className)}
      aria-describedby={describe(name, hint, error)}
    >
      <legend className="mb-2 text-sm font-medium">
        {label}
        {optional ? <span className="text-muted-foreground ml-2 font-normal">(optional)</span> : null}
      </legend>
      <div className="flex gap-3">
        {(["yes", "no"] as const).map((v) => (
          <label
            key={v}
            className="has-checked:border-primary has-checked:bg-accent has-focus-visible:ring-ring/50 flex h-9 min-w-20 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm has-focus-visible:ring-[3px]"
          >
            <input
              type="radio"
              name={name}
              value={v}
              defaultChecked={defaultValue === v}
              className="accent-primary"
            />
            {v === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </div>
      {hint ? (
        <p id={`${name}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${name}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** A labelled number input paired with a currency picker. */
export function MoneyField({
  name,
  currencyName,
  label,
  hint,
  errors,
  optional,
  className,
  defaultValue,
  defaultCurrency,
  currencyOptions,
}: BaseProps & {
  currencyName: string;
  defaultValue?: string;
  defaultCurrency?: string;
  currencyOptions: Option[];
}) {
  const error = errors?.[name]?.[0] ?? errors?.[currencyName]?.[0];
  return (
    <FieldShell {...{ name, label, hint, error, optional, className }}>
      <div className="flex gap-2">
        <div className="w-32 shrink-0">
          <NativeSelect
            name={currencyName}
            aria-label={`${label} currency`}
            defaultValue={defaultCurrency ?? "NGN"}
          >
            {currencyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Input
          id={name}
          name={name}
          inputMode="decimal"
          autoComplete="off"
          required={!optional}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={describe(name, hint, error)}
        />
      </div>
    </FieldShell>
  );
}

export function FormMessage({
  status,
  message,
  action,
}: {
  status: string;
  message?: string;
  action?: { href: string; label: string };
}) {
  if (!message) return null;
  return (
    <p
      role={status === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        status === "error"
          ? "border-destructive/40 text-destructive"
          : "border-primary/30 bg-accent text-accent-foreground",
      )}
    >
      {message}
      {action ? (
        <>
          {" "}
          <a href={action.href} className="font-medium underline underline-offset-4">
            {action.label}
          </a>
        </>
      ) : null}
    </p>
  );
}
