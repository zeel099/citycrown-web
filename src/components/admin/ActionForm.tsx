"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";

export type ActionState = { error?: string; ok?: string } | null;

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  id?: string;
  className?: string;
  resetOnSuccess?: boolean;
  children?: React.ReactNode;
};

/**
 * A server-action form that shows the action's validation message. Submits through
 * onSubmit so a failed save keeps what was typed (React resets action forms otherwise).
 * Inputs in other table cells can join it with form={id}.
 */
export function ActionForm({ action, submitLabel, id, className, resetOnSuccess, children }: Props) {
  const [state, dispatch, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      id={id}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => dispatch(data));
      }}
    >
      {children}
      <button className="btn btn-primary btn-sm" type="submit" disabled={pending}>
        {submitLabel}
      </button>
      {state?.error && <p className="admin-msg field-error" role="alert">{state.error}</p>}
      {state?.ok && <p className="admin-msg field-hint" role="status">{state.ok}</p>}
    </form>
  );
}
